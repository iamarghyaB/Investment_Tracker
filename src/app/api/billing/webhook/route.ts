import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { paidPrice, stripeClient } from "@/lib/billing";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "Webhook signing secret not configured." }, 503);
  let stripe: Stripe;
  let event: Stripe.Event;
  try {
    stripe = stripeClient();
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") || "", secret);
  } catch { return json({ error: "Invalid sandbox webhook signature or configuration." }, 400); }
  if (event.livemode) return json({ error: "Live events are disabled." }, 400);
  const watched = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"];
  if (!watched.includes(event.type)) return json({ received: true });
  try {
    const object = event.data.object;
    let subscriptionId: string | undefined;
    if (object.object === "subscription") subscriptionId = object.id;
    if (object.object === "checkout.session") {
      if (object.mode !== "subscription" || object.payment_status !== "paid") return json({ received: true });
      subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
    }
    if (object.object === "invoice") {
      const sub = object.parent?.subscription_details?.subscription;
      subscriptionId = typeof sub === "string" ? sub : sub?.id;
    }
    if (!subscriptionId) return json({ received: true });
    // Retrieve current state, not a potentially stale event snapshot.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.livemode) return json({ error: "Live subscriptions are disabled." }, 400);
    if (subscription.metadata.app !== "investment-tracker") return json({ received: true });
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const admin = createAdminClient();
    const { data: mapping, error } = await admin.from("investment_subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    if (error) throw new Error("Billing customer lookup failed.");
    if (!mapping || mapping.user_id !== subscription.metadata.supabase_user_id) return json({ received: true });
    const price = await paidPrice(stripe, false);
    const item = subscription.items.data.find(item => item.price.id === price.id && item.quantity === 1);
    const status = item && subscription.items.data.length === 1 ? subscription.status : "ineligible";
    const { error: syncError } = await admin.rpc("investment_apply_subscription", {
      p_event_id: event.id, p_event_created: event.created, p_customer_id: customerId,
      p_subscription_id: subscription.id, p_status: status, p_price_id: item?.price.id || null,
      p_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
      p_cancel_at_period_end: subscription.cancel_at_period_end,
    });
    if (syncError) throw new Error("Billing sync failed.");
    return json({ received: true });
  } catch { return json({ error: "Unable to synchronize subscription; Stripe should retry." }, 500); }
}
