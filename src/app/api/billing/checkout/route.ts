import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPaidAccess, paidPrice, stripeClient } from "@/lib/billing";
import { appUrl, json, sameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in before subscribing." }, 401);
  try {
    const stripe = stripeClient();
    const price = await paidPrice(stripe);
    const admin = createAdminClient();
    const { data: existing, error: loadError } = await admin.from("investment_subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (loadError) throw new Error("Billing database unavailable.");
    if (hasPaidAccess(existing)) return json({ error: "You already have Pro. Use Manage subscription." }, 409);
    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { supabase_user_id: user.id } }, { idempotencyKey: `investment-customer-${user.id}` });
      if (customer.livemode) throw new Error("Live customers are disabled.");
      const { error } = await admin.from("investment_subscriptions").upsert({ user_id: user.id, stripe_customer_id: customer.id }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw new Error("Unable to register billing customer.");
      customerId = customer.id;
    }
    const subs = await stripe.subscriptions.list({ customer: customerId, limit: 100, status: "all" });
    if (subs.data.some(sub => ["active", "trialing", "past_due", "unpaid", "paused"].includes(sub.status))) return json({ error: "A subscription already exists. Manage it through the billing portal." }, 409);
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 20 });
    const reusable = open.data.find(session => session.mode === "subscription" && session.metadata?.app === "investment-tracker" && !session.livemode);
    if (reusable?.url) return json({ url: reusable.url });
    const suffix = Array.from(randomBytes(8), byte => String.fromCharCode(97 + byte % 26)).join("");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: user.id, metadata: { app: "investment-tracker", supabase_user_id: user.id },
      subscription_data: { metadata: { app: "investment-tracker", supabase_user_id: user.id } },
      integration_identifier: `investment-tracker-${suffix}`,
      success_url: `${appUrl()}/pricing?checkout=success`, cancel_url: `${appUrl()}/pricing?checkout=canceled`,
    }, { idempotencyKey: `investment-checkout-${user.id}-${Math.floor(Date.now() / 1800000)}` });
    if (session.livemode || !session.url) throw new Error("Sandbox checkout unavailable.");
    return json({ url: session.url });
  } catch (error) {
    const safe = error instanceof Error && /configured|sandbox API key|Live keys|active sandbox/.test(error.message) ? error.message : "Unable to create sandbox checkout. Check billing configuration and try again.";
    return json({ error: safe }, 503);
  }
}
