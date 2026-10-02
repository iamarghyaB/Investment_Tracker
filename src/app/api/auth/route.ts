import { createClient } from "@/lib/supabase/server";
import { appUrl, json, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) return json({ error: "Request is too large." }, 413);
    input = JSON.parse(body);
  } catch { return json({ error: "Invalid request." }, 400); }
  if (!input || typeof input !== "object") return json({ error: "Invalid request." }, 400);
  const { email, password, action } = input as Record<string, unknown>;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || typeof password !== "string" || password.length < 8 || password.length > 128 || (action !== "signup" && action !== "signin")) {
    return json({ error: "Enter a valid email and a password between 8 and 128 characters." }, 400);
  }
  try {
    const client = await createClient();
    const credentials = { email: email.trim(), password };
    const result = action === "signup"
      ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: `${appUrl()}/auth/callback` } })
      : await client.auth.signInWithPassword(credentials);
    if (result.error) {
      const unavailable = !result.error.status || result.error.status >= 500;
      return json({ error: unavailable ? "Authentication is temporarily unavailable. Please try again." : result.error.message }, unavailable ? 503 : result.error.status === 429 ? 429 : 400);
    }
    // The SSR client writes session/PKCE cookies. Tokens never enter the JSON response.
    return json({ confirmationRequired: action === "signup" && !result.data.session });
  } catch {
    console.error("Authentication request failed before completion.");
    return json({ error: "Authentication is temporarily unavailable. Please try again." }, 503);
  }
}
