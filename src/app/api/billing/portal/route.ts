import { createClient } from "@/lib/supabase/server";
import { stripeClient } from "@/lib/billing";
import { appUrl, json, sameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in to manage billing." }, 401);
  const { data, error } = await client.from("investment_subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (error || !data) return json({ error: "No billing account found." }, 404);
  try {
    const stripe = stripeClient();
    const customer = await stripe.customers.retrieve(data.stripe_customer_id);
    if (customer.deleted || customer.livemode) return json({ error: "Sandbox customer unavailable." }, 400);
    const portal = await stripe.billingPortal.sessions.create({ customer: customer.id, return_url: `${appUrl()}/pricing` });
    return json({ url: portal.url });
  } catch { return json({ error: "Billing portal unavailable. Configure the sandbox customer portal in Stripe." }, 503); }
}
