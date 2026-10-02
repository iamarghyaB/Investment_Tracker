import nextEnv from '@next/env';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

nextEnv.loadEnvConfig(process.cwd());
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key || !/^(sk|rk)_test_/.test(key)) {
  console.error('Add a Stripe sandbox key to .env.local before starting webhook forwarding. Live keys are disabled.');
  process.exitCode = 1;
} else {
  const shim = fileURLToPath(new URL('../node_modules/@stripe/cli/bin/shim.js', import.meta.url));
  const destination = `${process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'}/api/billing/webhook`;
  const child = spawn(process.execPath, [shim, 'listen', '--skip-update', '--latest', '--events-from', '@self', '--events', 'checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed', '--forward-to', destination], {
    env: { ...process.env, STRIPE_API_KEY: key }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buffer = '';
  let stored = false;
  let persisting = Promise.resolve();
  function output(chunk) {
    const text = chunk.toString();
    if (!stored) {
      buffer = (buffer + text).slice(-16000);
      const match = buffer.match(/whsec_[A-Za-z0-9]+/);
      if (match) {
        stored = true;
        persisting = (async () => {
          const envPath = new URL('../.env.local', import.meta.url);
          const content = await readFile(envPath, 'utf8');
          const line = `STRIPE_WEBHOOK_SECRET=${match[0]}`;
          await writeFile(envPath, /^STRIPE_WEBHOOK_SECRET=.*$/m.test(content) ? content.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line) : content + '\n' + line + '\n');
          console.log('Webhook listener ready. Signing secret saved in .env.local without displaying it. Restart Next.js, then keep this listener running during payment tests.');
        })().catch(() => { console.error('Could not save the signing secret. Check .env.local permissions.'); child.kill(); });
      }
    }
    // Log only the endpoint response code, never event payloads or credentials.
    for (const status of text.matchAll(/\[(\d{3})\]/g)) console.log(`Webhook response: HTTP ${status[1]}`);
  }
  child.stdout.on('data', output);
  child.stderr.on('data', output);
  child.on('error', () => console.error('Unable to start Stripe CLI.'));
  child.on('exit', async code => { await persisting; if (!stored) console.error('Listener could not connect. Check the sandbox key permissions or use stripe login in this sandbox.'); process.exitCode = code || 0; });
  process.on('SIGINT', () => child.kill());
  process.on('SIGTERM', () => child.kill());
}
