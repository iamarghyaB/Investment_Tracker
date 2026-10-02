# InvestmentTracker

Planning baseline: October 2, 2026. The Next.js dashboard, optional Finnhub feed, Supabase login/private persistent watchlists, and Stripe sandbox pricing/subscriptions are implemented. A dedicated InvestmentTracker project was created in Supabase; existing apps were not changed. Full sandbox login/payment/webhook/watchlist/cancellation verification passed. Portfolio holdings/history remain sample data.

## Agreed scope

A responsive investment tracking web app inspired by Google Finance. Built with Next.js, TypeScript, and Supabase. Anyone can sign up; each account has private watchlists and holdings. Users browse quotes and news and manually record holdings to track gains and losses. No brokerage connection, order execution, payments, or custody.

## First release

- Email/password signup, email confirmation, login, logout, and password reset.
- Dashboard with watched stocks, recent headlines, and portfolio totals.
- Search by ticker/company; identify instruments by exchange and symbol.
- Stock page with latest quote, quote timestamp, daily price change, and related news links.
- One watchlist and one portfolio per user initially.
- Add/remove watched stocks.
- Add/edit/delete holding lots: stock, quantity, unit purchase cost, purchase date, and optional fees.
- Show total cost basis, market value, and unrealized gains/losses in currency and percentage.
- Responsive layouts and explicit loading, empty, error, unavailable, and stale-data states.

Holding lots represent currently owned shares. Sales history and realized gains are a later transaction-ledger feature. Avoid implying that editing a holding records a sale.

## Decisions still needed

- Exchanges: confirmed first release is US stocks in USD.
- Supabase: user chose a separate project in Makezaastdio.inc. Created InvestmentTracker in Singapore, reference xyltxzqmtoqnmwpfkmnf.
- Credentials are supplied through ignored .env.local, never source or chat. Stripe sandbox product/price and webhook listener are configured. Verify market-data display rights before a public release.

## Current plans

Free: account, stock-price/news browsing. Pro: $20 USD/month, recurring, unlocks saving private watchlists. Sandbox billing only. Database RLS enforces paid saving and ownership. Cancellation/expiry prevents new saves but allows reading/removing existing saved stocks. Webhook sync is signed, server-only, idempotent, and ordered. Supabase security advisors returned no findings.

## Market data

Finnhub is the first candidate for quotes, symbol search, and company news. Verify actual endpoint access with a free key. Verify public multi-user display rights before publishing; free access does not by itself establish redistribution permission.

Alpha Vantage's standard free allowance is 25 requests/day. Real-time and 15-minute delayed US quote access is premium. Do not use it as the primary frequently refreshed quote feed under the free plan.

Start with roughly 60-second quote refreshes while a page is visible, subject to validated provider limits. Cache quotes across users by instrument, deduplicate simultaneous requests, debounce searches, and cache news longer. Enforce an upstream request budget shared across app instances; per-user limits alone do not protect a shared API key. Pause background polling and handle 429 responses with backoff.

Show provider/source and quote timestamp. Distinguish retrieval time from market quote time. Never label sample data as live, or replace unavailable prices with zero. Display incomplete portfolio valuation if any holding lacks a quote.

Historical charts depend on separately verified endpoint access. Do not promise free intraday/history coverage; omit the chart or label a sample preview until real history is available.

## Architecture

Browser -> Next.js server endpoints -> market-data provider.

Browser/server -> Supabase Auth and Postgres, using the user's authenticated session and row-level security.

- Next.js App Router with server-rendered pages and client components for forms and periodic refresh.
- Supabase SSR client/session handling following current documentation.
- Server-only Finnhub API key; only the Supabase URL and publishable key are public.
- Provider adapter to normalize quotes/news and allow vendor replacement.
- Shared market-data caching and a centralized rate budget before public scale.
- No service-role key for ordinary user operations.

## Database and privacy

- `watchlist_items`: id, user_id, exchange, symbol, display_name, created_at. Unique user/exchange/symbol.
- `holding_lots`: id, user_id, exchange, symbol, quantity, unit_cost, fees, acquired_on, created_at, updated_at.
- Use exact numeric columns and decimal arithmetic for money; require positive quantities and nonnegative cost/fees.
- Every personal-data table enables RLS. SELECT/DELETE require auth.uid() = user_id. INSERT checks ownership. UPDATE checks both current and resulting ownership.
- Index user_id. Grant only necessary table access to authenticated users. Verify isolation using two independent accounts, including attempted cross-account writes.
- Shared quote/news cache must not contain private holdings or watchlists.

## Portfolio calculations

Cost basis = sum(quantity * unit_cost + purchase fees).

Market value = sum(quantity * latest available quote).

Unrealized gain/loss = market value - cost basis.

Return percentage = unrealized gain/loss / cost basis * 100, undefined when cost basis is zero.

Show unavailable/incomplete results when quotes are missing. Start with a single currency; cross-currency totals require an explicit FX conversion feature. Dividends and splits are not automatically reflected in version one; manual lots need updating for corporate actions.

## Build order and acceptance checks

1. Validate market/provider scope and test quotes, search, and news with the selected key.
2. Build and review dashboard, stock detail, watchlist, portfolio, and auth screens using clearly labeled sample data.
3. Connect Supabase Auth; create schema and RLS; verify signup/login/reset and two-user isolation.
4. Connect search, watchlist persistence, and holding CRUD; verify invalid inputs, duplicate saves, refresh persistence, and decimal calculations.
5. Connect real quotes/news, caching, request budgets, stale indicators, and failure handling.
6. Verify the complete user journey on desktop/mobile, inspect accessibility and server/client errors, and run type/build checks.
7. Deploy a review preview. Public release requires verified provider display rights and adequate quota.

## Later

Transaction ledger for purchases/sales and realized gains; dividends/splits; multiple portfolios/watchlists; CSV import/export; price alerts; historical portfolio performance; benchmark comparisons; additional exchanges/currencies.

## References

- Google Finance: https://www.google.com/finance/
- Alpha Vantage free limits and quote access: https://www.alphavantage.co/support/
- Finnhub quote API: https://finnhub.io/docs/api/quote
- Finnhub news API: https://finnhub.io/docs/api/company-news
- Finnhub pricing/usage review: https://finnhub.io/pricing
- Supabase Next.js SSR: https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs
