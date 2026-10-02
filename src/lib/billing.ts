import "server-only";
import Stripe from "stripe";

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !/^(sk|rk)_test_/.test(key)) throw new Error("Configure a Stripe sandbox API key. Live keys are disabled in this test app.");
  return new Stripe(key, { maxNetworkRetries: 2 });
}
export async function paidPrice(stripe: Stripe, requireActive = true) {
  const id = process.env.STRIPE_PRICE_ID;
  if (!id) throw new Error("Stripe sandbox price is not configured.");
  const price = await stripe.prices.retrieve(id);
  if (price.livemode || (requireActive && !price.active) || price.unit_amount !== 2000 || price.currency !== "usd" || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) throw new Error("Use a sandbox USD $20/month recurring price (active for new checkouts).");
  return price;
}
export function hasPaidAccess(subscription: { status: string; current_period_end: string | null } | null) {
  return subscription?.status === "active" && !!subscription.current_period_end && new Date(subscription.current_period_end).getTime() > Date.now();
}
