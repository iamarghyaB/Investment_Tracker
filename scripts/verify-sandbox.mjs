import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import Stripe from 'stripe';
import { randomUUID, randomBytes } from 'node:crypto';

nextEnv.loadEnvConfig(process.cwd());
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey, SUPABASE_SECRET_KEY: databaseKey, STRIPE_SECRET_KEY: stripeKey, STRIPE_PRICE_ID: priceId } = process.env;
if (!url || !publicKey || !databaseKey || !stripeKey || !priceId || !/^(rk|sk)_test_/.test(stripeKey)) throw new Error('Configure Supabase and Stripe sandbox keys and price first.');
const base = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
const admin = createClient(url, databaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const stripe = new Stripe(stripeKey);
const users = [];
let customerId;
let subscriptionId;
let stage = 'validate sandbox price';
function assert(value, description) { if (!value) throw new Error(description); }
async function userSession() {
  const email = `sandbox-check-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!error && data.user, 'Cannot create disposable test account');
  users.push(data.user.id);
  let cookies = [];
  const client = createServerClient(url, publicKey, { cookies: { getAll: () => cookies, setAll: values => { cookies = values; } } });
  const result = await client.auth.signInWithPassword({ email, password });
  assert(!result.error && result.data.user?.id === data.user.id, 'Sign-in failed');
  return { id: data.user.id, cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') };
}
async function request(user, path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Cookie: user.cookie, Origin: base, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
async function waitForPlan(user, paid) {
  for (let i = 0; i < 25; i++) {
    const result = await request(user, '/api/account');
    if (result.status === 200 && result.body.paid === paid) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Webhook did not synchronize plan');
}
try {
  const price = await stripe.prices.retrieve(priceId);
  assert(!price.livemode && price.active && price.unit_amount === 2000 && price.currency === 'usd' && price.recurring?.interval === 'month', 'Wrong sandbox price');
  stage = 'create two disposable accounts and sign in';
  const a = await userSession(); const b = await userSession();
  stage = 'verify free plan cannot save';
  assert((await request(a, '/api/watchlist', 'POST', { symbol: 'AAPL' })).status === 403, 'Free save was allowed');
  stage = 'create authenticated sandbox Checkout Session';
  const checkout = await request(a, '/api/billing/checkout', 'POST');
  assert(checkout.status === 200 && checkout.body.url?.startsWith('https://checkout.stripe.com/'), 'Checkout did not return hosted URL');
  const mapping = await admin.from('investment_subscriptions').select('stripe_customer_id').eq('user_id', a.id).single();
  assert(!mapping.error && mapping.data, 'Checkout customer was not mapped');
  customerId = mapping.data.stripe_customer_id;
  stage = 'simulate sandbox recurring payment';
  const customer = await stripe.customers.retrieve(customerId);
  assert(!customer.deleted && !customer.livemode, 'Non-sandbox customer');
  const method = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId });
  const subscription = await stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], default_payment_method: method.id, metadata: { app: 'investment-tracker', supabase_user_id: a.id } });
  assert(!subscription.livemode, 'Non-sandbox subscription');
  subscriptionId = subscription.id;
  stage = 'wait for signed webhook to activate paid access';
  await waitForPlan(a, true);
  stage = 'save and reload own watchlist';
  assert((await request(a, '/api/watchlist', 'POST', { symbol: 'AAPL' })).status === 200, 'Paid save failed');
  assert((await request(a, '/api/watchlist')).body.symbols?.includes('AAPL'), 'Saved stock was not persisted');
  stage = 'verify second account isolation';
  const other = await request(b, '/api/watchlist');
  assert(other.status === 200 && other.body.symbols.length === 0, 'Second account saw first account stock');
  const spoof = await request(b, '/api/watchlist', 'POST', { symbol: 'NVDA', user_id: a.id });
  assert(spoof.status === 403, 'Spoofed user ID gained access');
  stage = 'verify customer portal';
  const portal = await request(a, '/api/billing/portal', 'POST');
  assert(portal.status === 200 && portal.body.url?.startsWith('https://billing.stripe.com/'), 'Portal unavailable');
  stage = 'verify cancellation webhook revokes saving';
  await stripe.subscriptions.cancel(subscriptionId);
  await waitForPlan(a, false);
  assert((await request(a, '/api/watchlist', 'POST', { symbol: 'NVDA' })).status === 403, 'Canceled plan saved stock');
  assert((await request(a, '/api/watchlist', 'DELETE', { symbol: 'AAPL' })).status === 200, 'Canceled user cannot remove own stock');
  console.log('PASS: Supabase login, authenticated Stripe sandbox Checkout, paid recurring subscription, signed webhook activation, persistent saves, two-account isolation, customer portal, and cancellation enforcement.');
} catch (error) {
  console.error(`FAIL at ${stage}. Error category: ${error?.type || error?.name || 'unknown'}. ${error?.name === 'Error' ? error.message : 'Check sandbox configuration and permissions.'}`);
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;
  if (customerId) { try { await stripe.customers.del(customerId); } catch { cleanupFailed = true; } }
  for (const id of users) { const { error } = await admin.auth.admin.deleteUser(id); if (error) cleanupFailed = true; }
  console.log(cleanupFailed ? 'Some test fixture cleanup failed; inspect the sandbox-check users and test billing customers.' : 'Disposable accounts and billing customer cleaned up. No real payments were made.');
}
