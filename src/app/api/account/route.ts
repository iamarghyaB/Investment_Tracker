import { createClient } from "@/lib/supabase/server";
import { hasPaidAccess } from "@/lib/billing";
import { json } from "@/lib/http";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return json({ user: null, paid: false, configured: false });
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ user: null, paid: false, configured: true });
  const { data: subscription, error } = await client.from("investment_subscriptions").select("status,current_period_end,cancel_at_period_end").eq("user_id", user.id).maybeSingle();
  if (error) return json({ error: "Unable to load your plan. Try again." }, 503);
  return json({ user: { id: user.id, email: user.email }, paid: hasPaidAccess(subscription), configured: true, subscription });
}
