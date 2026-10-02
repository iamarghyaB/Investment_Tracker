"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Check, FlaskConical, ShieldCheck, Sparkles } from "lucide-react";
import { useAccount } from "@/components/account-provider";

export default function Pricing() {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [returned, setReturned] = useState("");
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("checkout");
    setReturned(result || "");
    if (result !== "success") return;
    // The return URL is only a message. The signed webhook grants access.
    const timer = setInterval(() => { void account.refresh(); }, 3000);
    const stop = setTimeout(() => clearInterval(timer), 60000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [account.refresh]);
  async function checkout(portal = false) {
    if (!account.user) { window.location.assign("/login?next=/pricing"); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(portal ? "/api/billing/portal" : "/api/billing/checkout", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to open checkout.");
      window.location.assign(data.url);
    } catch (error) { setError(error instanceof Error ? error.message : "Checkout unavailable."); setBusy(false); }
  }
  return <main className="pricing-page"><div className="pricing-header"><Link href="/" className="back-link"><ArrowLeft size={15} /> Dashboard</Link><Link href="/" className="auth-brand"><Activity size={22} /> InvestmentTracker</Link><Link href={account.user ? "/" : "/login"}>{account.user ? "My account" : "Sign in"} <ArrowRight size={13} /></Link></div><div className="pricing-intro"><span className="sandbox-badge"><FlaskConical size={13} /> STRIPE SANDBOX</span><h1>A plan for your<br /><span>next chapter.</span></h1><p>Explore the market for free. Keep your favorite stocks close with Pro.</p></div>{returned === "success" ? <div className="pricing-message" role="status">{account.paid ? "Your sandbox subscription is active. You can now save stocks." : "Checkout returned successfully. Waiting for Stripe's verified webhook to activate your plan."}<button onClick={() => void account.refresh()}>Check status</button></div> : returned === "canceled" ? <div className="pricing-message">Checkout canceled. Your plan has not changed.</div> : null}{error || account.error ? <div className="error-banner" role="alert">{error || account.error}</div> : null}<div className="plans-grid"><section className="plan-card card"><div className="plan-icon"><Activity size={22} /></div><h2>Free</h2><p>Get a feel for the market.</p><div className="plan-price">$0<span>/ forever</span></div><Link className="secondary-button full-width" href={account.user ? "/" : "/login"}>{account.user ? "Explore dashboard" : "Get started"}<ArrowRight size={15} /></Link><div className="plan-rule" />{["Browse US stock prices in USD", "Read company news", "Explore the sample portfolio", "Your own secure account"].map(item => <div className="plan-feature" key={item}><Check size={15} />{item}</div>)}<div className="plan-exclusion">Saving stocks requires Pro.</div></section><section className="plan-card card pro-plan"><span className="pro-tag"><Sparkles size={12} /> YOUR PERSONAL WATCHLIST</span><div className="plan-icon"><Sparkles size={22} /></div><h2>Pro</h2><p>Make the market personal.</p><div className="plan-price">$20<span>/ month</span><small>USD · Recurring monthly subscription</small></div><button className="primary-button full-width" disabled={busy || account.loading} onClick={() => void checkout(account.paid)}>{busy ? "Opening Stripe..." : account.paid ? "Manage subscription" : "Try Pro in sandbox"}<ArrowRight size={15} /></button><div className="plan-rule" />{["Everything in Free", "Save stocks to your watchlist", "Your watchlist syncs across devices", "Only you can see your saved stocks", "Manage or cancel your subscription"].map(item => <div className="plan-feature" key={item}><Check size={15} />{item}</div>)}<div className="plan-exclusion">Sandbox only. No real money is charged.</div></section></div><div className="pricing-assurance"><ShieldCheck size={17} /><span>Secure Stripe-hosted checkout <i>·</i> Private watchlists <i>·</i> Cancel anytime</span></div><section className="pricing-faq"><h2>A few things to know</h2><details><summary>Does this test charge real money?</summary><p>No. This integration rejects live Stripe keys and uses sandbox products and subscriptions.</p></details><details><summary>What happens if I cancel?</summary><p>Your paid access remains available until the end of the paid period when cancellation is scheduled. You can still view and remove saved stocks after your plan ends; saving new stocks requires Pro.</p></details><details><summary>When does my watchlist unlock?</summary><p>After Stripe confirms payment through a signed webhook. Returning from checkout alone does not grant access.</p></details></section><footer className="page-footer"><span>InvestmentTracker</span><span>Sandbox pricing preview · US stocks · USD</span></footer></main>;
}
