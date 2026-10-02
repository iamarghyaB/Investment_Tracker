"use client";
import Link from "next/link";
import { useState } from "react";
import { Activity, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <main className="auth-page"><Link href="/" className="back-link"><ArrowLeft size={15} /> Back to dashboard</Link><section className="auth-card card"><div className="auth-brand"><Activity size={27} /> InvestmentTracker</div><span className="eyebrow">YOUR MARKET, IN FOCUS</span><h1>{signup ? "Make it yours." : "Welcome back."}</h1><p className="muted">{signup ? "Create an account to start your investment journey." : "Sign in to your private investment workspace."}</p><form onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const client = createClient();
      const credentials = { email: String(form.get("email")), password: String(form.get("password")) };
      const result = signup ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } }) : await client.auth.signInWithPassword(credentials);
      if (result.error) { setError(result.error.message); return; }
      if (signup && !result.data.session) { setMessage("Check your email to confirm your account, then sign in here."); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next === "/pricing" ? "/pricing" : "/");
    } catch { setError("Unable to connect to authentication. Please try again."); }
    finally { setBusy(false); }
  }}><label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength={8} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} required /></label>{error ? <p className="negative" role="alert">{error}</p> : null}{message ? <p className="positive" role="status">{message}</p> : null}<button disabled={busy} className="primary-button full-width">{busy ? "Please wait..." : signup ? "Create account" : "Sign in"}<ArrowRight size={15} /></button></form><button className="auth-switch" onClick={() => { setSignup(!signup); setError(""); setMessage(""); }}>{signup ? "Already have an account? Sign in" : "New here? Create an account"}</button><div className="auth-security"><ShieldCheck size={14} /> Your saved stocks are private to your account.</div></section></main>;
}
