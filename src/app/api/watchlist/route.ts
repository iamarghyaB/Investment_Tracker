import { createClient } from "@/lib/supabase/server";
import { json, sameOrigin } from "@/lib/http";
import { stocks } from "@/lib/sample-data";

export async function GET() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in to view your watchlist." }, 401);
  const { data, error } = await client.from("watchlist_items").select("symbol").eq("user_id", user.id).order("created_at");
  return error ? json({ error: "Unable to load your saved stocks." }, 503) : json({ symbols: data.map(item => item.symbol) });
}
async function mutate(request: Request, remove: boolean) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in to save stocks." }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (!stocks.some(stock => stock.symbol === body?.symbol)) return json({ error: "Choose a supported US stock." }, 400);
  const result = remove
    ? await client.from("watchlist_items").delete().eq("user_id", user.id).eq("symbol", body.symbol)
    : await client.from("watchlist_items").insert({ user_id: user.id, symbol: body.symbol });
  if (result.error?.code === "23505") return json({ saved: true });
  if (result.error?.code === "42501") return json({ error: "The paid plan is required to save stocks." }, 403);
  return result.error ? json({ error: "Unable to update your watchlist." }, 503) : json({ saved: !remove });
}
export async function POST(request: Request) { return mutate(request, false); }
export async function DELETE(request: Request) { return mutate(request, true); }
