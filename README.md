# InvestmentTracker

Next.js dashboard for US stocks in USD, with Supabase login, private persistent watchlists, and Stripe sandbox subscriptions.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. If the system npm launcher fails on Windows, use:

```powershell
node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run dev
```

## Accounts and plans

Create/confirm an account at /login. The Free plan allows browsing prices and news. Pro is $20 USD/month and unlocks saving stocks. Saved stocks belong to the authenticated account and are protected by row-level security. The watchlist is empty for new users and persists across reloads. Portfolio holdings and charts remain sample/session data.

The dedicated InvestmentTracker Supabase project is configured; its database schema is saved in database/schema.sql and database/rls_billing_events.sql. Those definitions have already been applied remotely. Existing unrelated Supabase projects were not modified.

See BILLING_SETUP.md for the webhook listener, auth redirects, and payment testing instructions. The Stripe sandbox product, $20/month price, server keys, and webhook signing secret are configured. Full sandbox verification passed; see the recorded details there. Restart the local webhook listener whenever you resume payment testing.

## Finnhub

Paste a Finnhub key into FINNHUB_API_KEY in ignored .env.local. It stays server-only. Quotes refresh every 60 seconds while visible, with a per-process cache, and display provider timestamps. Apple news is cached for 15 minutes. Missing prices are shown as unavailable when connected. Without a key, prices are labeled samples. Historical charts and sparklines are illustrative in either mode.

Search currently covers eight preview US stocks. The market-data endpoint remains appropriate for a single local demo. Verify display permissions and implement shared upstream quotas before a public rollout.

## Checks

```sh
npm run typecheck
npm run build
```

The rollback-only database/verify_rls.sql checks two-user isolation, paid-only saving, cross-user write denial, subscription tampering, expiry, anonymous denial, and billing event replay/order handling. Build and policy checks do not establish a completed real sandbox payment; that requires your keys and webhook delivery.
