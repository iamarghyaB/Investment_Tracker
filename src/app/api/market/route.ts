import { NextResponse } from "next/server";
import { stocks, type Article, type Quote } from "@/lib/sample-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketResult = { mode: "demo" | "connected"; quotes: Quote[]; articles: Article[]; error?: string; newsError?: string };
// One bounded, fixed-symbol endpoint for the local preview. Public deployment needs
// authenticated access and a shared quota/cache across instances.
let cached: { value: MarketResult; until: number } | undefined;
let inFlight: Promise<MarketResult> | undefined;
let news: { articles: Article[]; until: number; error?: string } | undefined;

async function request(path: string, key: string) {
  const response = await fetch(`https://finnhub.io/api/v1/${path}`, {
    headers: { "X-Finnhub-Token": key },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 429 ? "Provider rate limit reached. Prices will retry after a pause." : response.status === 401 || response.status === 403 ? "Finnhub rejected the key or this endpoint is unavailable on your plan." : "The market-data provider is temporarily unavailable.");
  const body = await response.json();
  if (body?.error) throw new Error("Finnhub could not provide this data. Check your key and endpoint access.");
  return body;
}

async function loadMarket(key: string): Promise<MarketResult> {
  const results = await Promise.allSettled(stocks.map(async stock => {
    const data = await request(`quote?symbol=${stock.symbol}`, key);
    if (!Number.isFinite(data.c) || data.c <= 0 || !Number.isFinite(data.dp) || !Number.isFinite(data.t) || data.t <= 0) throw new Error(`Quote unavailable for ${stock.symbol}.`);
    return { symbol: stock.symbol, price: data.c as number, change: data.dp as number, timestamp: data.t as number };
  }));
  const quotes = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  const failures = results.filter(result => result.status === "rejected");
  if (!news || news.until <= Date.now()) {
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const data = await request(`company-news?symbol=AAPL&from=${from}&to=${to}`, key);
      if (!Array.isArray(data)) throw new Error("News unavailable on this plan.");
      const articles: Article[] = data.filter(item => typeof item.headline === "string" && typeof item.url === "string" && /^https?:\/\//i.test(item.url) && Number.isFinite(item.id) && Number.isFinite(item.datetime)).slice(0, 6).map(item => ({ id: item.id, headline: item.headline, url: item.url, source: String(item.source || "News"), datetime: item.datetime, summary: String(item.summary || "") }));
      news = { articles, until: Date.now() + 15 * 60000 };
    } catch { news = { articles: [], until: Date.now() + 60000, error: "Company news is temporarily unavailable. Check your Finnhub endpoint access." }; }
  }
  const result: MarketResult = { mode: "connected", quotes, articles: news.articles, ...(failures.length ? { error: `${failures.length} of ${stocks.length} quotes unavailable. ${failures[0].reason instanceof Error ? failures[0].reason.message : "Try again later."}` } : {}), ...(news.error ? { newsError: news.error } : {}) };
  cached = { value: result, until: Date.now() + (failures.length ? 120000 : 60000) };
  return result;
}

export async function GET() {
  const key = process.env.FINNHUB_API_KEY?.trim();
  const headers = { "Cache-Control": "no-store" };
  if (!key) return NextResponse.json({ mode: "demo", quotes: [], articles: [] }, { headers });
  if (cached && cached.until > Date.now()) return NextResponse.json(cached.value, { headers });
  inFlight ??= loadMarket(key).finally(() => { inFlight = undefined; });
  return NextResponse.json(await inFlight, { headers });
}
