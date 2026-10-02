import nextEnv from '@next/env';
import Stripe from 'stripe';
import { readFile, writeFile } from 'node:fs/promises';

nextEnv.loadEnvConfig(process.cwd());
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key || !/^(sk|rk)_test_/.test(key)) {
  console.log('Add a sandbox restricted key to STRIPE_SECRET_KEY in .env.local. Live keys are rejected.');
  process.exitCode = 1;
} else {
  try {
    const stripe = new Stripe(key);
    const existing = await stripe.prices.list({ lookup_keys: ['investmenttracker_pro_sandbox_20usd_monthly'], limit: 1 });
    let price = existing.data[0];
    if (!price) {
      const product = await stripe.products.create({ name: 'InvestmentTracker Pro (Sandbox)', description: 'Private stock watchlist. $20 USD per month. Sandbox testing only.', metadata: { app: 'investment-tracker' } }, { idempotencyKey: 'investmenttracker-pro-sandbox-product-v1' });
      if (product.livemode) throw new Error('Live mode is not allowed.');
      price = await stripe.prices.create({ product: product.id, currency: 'usd', unit_amount: 2000, recurring: { interval: 'month' }, lookup_key: 'investmenttracker_pro_sandbox_20usd_monthly' }, { idempotencyKey: 'investmenttracker-pro-sandbox-price-v1' });
    }
    if (price.livemode || !price.active || price.unit_amount !== 2000 || price.currency !== 'usd' || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) throw new Error('Sandbox price configuration does not match $20 USD/month.');
    const envPath = new URL('../.env.local', import.meta.url);
    const source = await readFile(envPath, 'utf8');
    const line = `STRIPE_PRICE_ID=${price.id}`;
    await writeFile(envPath, /^STRIPE_PRICE_ID=.*$/m.test(source) ? source.replace(/^STRIPE_PRICE_ID=.*$/m, line) : source + '\n' + line + '\n');
    const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 10 });
    if (!configs.data.some(config => config.is_default)) {
      await stripe.billingPortal.configurations.create({ business_profile: { headline: 'Manage your InvestmentTracker sandbox subscription' }, features: { subscription_cancel: { enabled: true, mode: 'at_period_end' }, payment_method_update: { enabled: true }, invoice_history: { enabled: true } } }, { idempotencyKey: 'investmenttracker-portal-sandbox-v1' });
    }
    console.log(`Sandbox recurring price ready: ${price.id} ($20 USD/month). Saved STRIPE_PRICE_ID in .env.local.`);
  } catch { console.error('Sandbox setup failed. Check the test key permissions for Products, Prices, and Billing Portal. No credentials were logged.'); process.exitCode = 1; }
}
