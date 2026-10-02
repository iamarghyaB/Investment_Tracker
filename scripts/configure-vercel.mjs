import nextEnv from '@next/env';
import Stripe from 'stripe';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

nextEnv.loadEnvConfig(process.cwd());
const origin = new URL(process.argv[2]).origin;
if (!origin.startsWith('https://')) throw new Error('Use the assigned HTTPS production domain.');
const key = process.env.STRIPE_SECRET_KEY;
if (!/^(rk|sk)_test_/.test(key || '')) throw new Error('Configure a sandbox Stripe key.');
const names = ['FINNHUB_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID'];
for (const name of names) if (!process.env[name]) throw new Error(`Missing ${name}`);
const stripe = new Stripe(key);
const events = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'];
const webhookUrl = origin + '/api/billing/webhook';
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
let endpoint = endpoints.data.find(endpoint => endpoint.url === webhookUrl);
if (endpoint) {
  const saved = await readFile('.env.vercel.local', 'utf8').catch(() => '');
  const savedId = saved.match(/^STRIPE_WEBHOOK_ENDPOINT_ID=(.+)$/m)?.[1];
  if (savedId !== endpoint.id) throw new Error('Existing endpoint signing secret is not stored locally. Retrieve it from Stripe before continuing.');
  endpoint.secret = saved.match(/^STRIPE_WEBHOOK_SECRET=(.+)$/m)?.[1];
} else {
  endpoint = await stripe.webhookEndpoints.create({ url: webhookUrl, enabled_events: events, description: 'InvestmentTracker Vercel sandbox subscriptions' });
}
if (endpoint.livemode || !endpoint.secret) throw new Error('Expected a sandbox endpoint with signing secret.');
// Preserve local CLI forwarding; keep the hosted endpoint secret in a separate ignored file.
await writeFile('.env.vercel.local', `NEXT_PUBLIC_APP_URL=${origin}\nSTRIPE_WEBHOOK_SECRET=${endpoint.secret}\nSTRIPE_WEBHOOK_ENDPOINT_ID=${endpoint.id}\n`);
const values = Object.fromEntries(names.map(name => [name, process.env[name]]));
values.NEXT_PUBLIC_APP_URL = origin;
values.STRIPE_WEBHOOK_SECRET = endpoint.secret;
for (const [name, value] of Object.entries(values)) {
  const sensitive = !name.startsWith('NEXT_PUBLIC_');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js', 'exec', '--yes', '--package=vercel', '--', 'vercel', 'env', 'add', name, 'production', '--yes', '--force', sensitive ? '--sensitive' : '--no-sensitive'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    // Values travel only over stdin. Never emit CLI output that might contain a value.
    child.stdout.resume(); child.stderr.resume();
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Vercel upload failed for ${name}; secret retained in ignored .env.vercel.local.`)));
    child.stdin.end(value);
  });
  console.log(`Configured ${name}`);
}
console.log(`Sandbox webhook configured: ${endpoint.id}`);
