"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount } from "./account-provider";
import { createClient } from "@/lib/supabase/client";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, ChevronDown, ChevronRight, CircleHelp, DollarSign, Globe, LayoutDashboard, Menu, Newspaper, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Star, TrendingUp, X } from "lucide-react";
import { PerformanceChart, ProfitChart, Sparkline } from "./charts";
import { initialHoldings, stocks, type Article, type Holding, type Quote, type Stock } from "@/lib/sample-data";

const currency = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const nav = [{ name: "Dashboard", icon: LayoutDashboard }, { name: "Watchlist", icon: Star }, { name: "Portfolio", icon: BriefcaseBusiness }, { name: "News", icon: Newspaper }];

function StockMark({ stock }: { stock: Stock }) {
  return <span className="stock-mark" style={{ color: stock.color, background: `${stock.color}15` }}>{stock.mark}</span>;
}

function Change({ value }: { value: number }) {
  return <span className={value >= 0 ? "positive change" : "negative change"}>{value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{value >= 0 ? "+" : ""}{value.toFixed(2)}%</span>;
}

export default function Dashboard() {
  const account = useAccount();
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [range, setRange] = useState("1Y");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>(initialHoldings);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Stock | null>(null);
  const [holdingModal, setHoldingModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [articles, setArticles] = useState<Article[]>([]);
  const [mode, setMode] = useState("demo");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [marketError, setMarketError] = useState("");
  const [newsError, setNewsError] = useState("");
  const [formError, setFormError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ignore = false;
    setWatchlist([]);
    if (!account.user) return;
    async function load() {
      try {
        const response = await fetch("/api/watchlist", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!ignore) setWatchlist(data.symbols);
      } catch { if (!ignore) setNotice("Unable to load saved stocks. Please try again."); }
    }
    void load();
    return () => { ignore = true; };
  }, [account.user?.id]);

  // Portfolio holdings are still sample/session data. Watchlists use Supabase.
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 5000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (holdingModal || selected) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [holdingModal, selected]);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      setRefreshing(true);
      try {
        const response = await fetch("/api/market", { signal: controller.signal });
        if (!response.ok) throw new Error("Prices are temporarily unavailable. Try again shortly.");
        const data = await response.json();
        setMode(data.mode);
        setQuotes(Object.fromEntries((data.quotes as Quote[]).map(quote => [quote.symbol, quote])));
        setArticles(data.articles);
        setMarketError(data.error || "");
        setNewsError(data.newsError || "");
      } catch (error) {
        if (!controller.signal.aborted) { setMarketError(error instanceof Error ? error.message : "Unable to refresh prices."); }
      } finally { if (!controller.signal.aborted) setRefreshing(false); }
    }
    void refresh();
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [refreshToken]);

  const isDemo = mode === "demo";
  const getPrice = (stock: Stock) => isDemo ? stock.price : quotes[stock.symbol]?.price;
  const getChange = (stock: Stock) => isDemo ? stock.change : quotes[stock.symbol]?.change;
  const costBasis = holdings.reduce((sum, holding) => sum + holding.quantity * holding.cost, 0);
  const complete = holdings.every(holding => getPrice(stocks.find(stock => stock.symbol === holding.symbol)!) !== undefined);
  const value = holdings.reduce((sum, holding) => sum + holding.quantity * (getPrice(stocks.find(stock => stock.symbol === holding.symbol)!) ?? 0), 0);
  const profit = value - costBasis;
  const gain = costBasis > 0 ? profit / costBasis * 100 : 0;
  const allocation = ["Technology", "Consumer", "Communication", "Financials"].map(sector => ({ sector, value: holdings.filter(holding => stocks.find(stock => stock.symbol === holding.symbol)?.sector === sector).reduce((sum, holding) => sum + holding.quantity * (getPrice(stocks.find(stock => stock.symbol === holding.symbol)!) ?? 0), 0) })).filter(item => item.value > 0);
  const colors = ["#8055fa", "#b197fc", "#ddd0ff", "#6d8bff"];
  const results = query.trim() ? stocks.filter(stock => `${stock.symbol} ${stock.name}`.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const closeModal = () => { setSelected(null); setHoldingModal(false); setFormError(""); };
  const navigate = (name: string) => { setActive(name); setMenuOpen(false); };
  const toggleWatch = async (symbol: string) => {
    if (saving || account.loading) return;
    if (!account.user) { window.location.assign("/login"); return; }
    const remove = watchlist.includes(symbol);
    if (!remove && !account.paid) { window.location.assign("/pricing"); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/watchlist", { method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update watchlist.");
      setWatchlist(items => remove ? items.filter(item => item !== symbol) : items.includes(symbol) ? items : [...items, symbol]);
      setNotice(remove ? "Stock removed from your watchlist." : "Stock saved to your private watchlist.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update watchlist."); }
    finally { setSaving(false); }
  };
  const stockQuote = (stock: Stock) => {
    const price = getPrice(stock);
    const change = getChange(stock);
    return <><span className="quote-price">{price === undefined ? "Unavailable" : currency(price)}</span>{change !== undefined ? <Change value={change} /> : <span className="muted">—</span>}</>;
  };

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}>
      <a href="/" className="brand"><span className="brand-icon"><Activity size={24} strokeWidth={2.8} /></span><span>Investment<span className="brand-muted">Tracker</span></span></a>
      <span className="nav-caption">WORKSPACE</span>
      <nav aria-label="Main navigation">{nav.map(item => <button className={`nav-item ${active === item.name ? "active" : ""}`} aria-current={active === item.name ? "page" : undefined} key={item.name} onClick={() => navigate(item.name)}><item.icon size={18} /><span>{item.name}</span>{item.name === "Watchlist" ? <span className="nav-count">{watchlist.length}</span> : null}{active === item.name ? <ChevronRight size={14} /> : null}</button>)}</nav>
      <Link href="/pricing" className="nav-item"><Sparkles size={18} /><span>Plans & billing</span></Link><div className="sidebar-divider" />
      <span className="nav-caption">YOUR PORTFOLIO</span>
      <button className="portfolio-nav" onClick={() => navigate("Portfolio")}><span className="portfolio-dot" /><span>My investments<small>US stocks · USD</small></span><ChevronDown size={14} /></button>
      <div className="sidebar-bottom"><div className="preview-card"><div className="preview-icon"><ShieldCheck size={19} /></div><h3>Your portfolio. Your view.</h3><p>Follow the market and keep your investments in focus.</p><span className="preview-label">Dashboard preview</span></div><button className="help-button" onClick={() => setNotice("Your watchlist is private and saved to your account. New saves require Pro. Portfolio holdings remain sample data for now.")}><CircleHelp size={17} /> Help & information <ArrowUpRight size={14} /></button><div className="sidebar-foot"><span className="purple-dot" />Tracking, made simple<span>v0.1</span></div></div>
    </aside>
    <div className="workspace">
      <div className="ticker-strip"><span className="market-label"><Globe size={14} /><span>US markets</span><small>{isDemo ? "Sample quotes" : "Finnhub quotes"}</small></span><div className="ticker-items">{stocks.slice(0, 6).map((stock, i) => <button key={stock.symbol} className="ticker" onClick={() => setSelected(stock)}><StockMark stock={stock} /><b>{stock.symbol}</b><Sparkline positive={stock.change >= 0} seed={i * 3} /><span>{getChange(stock) === undefined ? "—" : `${getChange(stock)! >= 0 ? "+" : ""}${getChange(stock)!.toFixed(2)}%`}</span></button>)}</div></div>
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button><span className="breadcrumb">Workspace <ChevronRight size={13} /> <strong>{active}</strong></span></div><div className="topbar-right"><div className="search-box"><Search size={16} /><input ref={searchRef} aria-label="Search stocks" placeholder="Search stocks..." value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); if (event.key === "Enter" && results[0]) { setSelected(results[0]); setQuery(""); } }} /><kbd>⌘ K</kbd>{query ? <div className="search-results">{results.length ? results.map(stock => <button key={stock.symbol} onClick={() => { setSelected(stock); setQuery(""); }}><StockMark stock={stock} /><span><b>{stock.symbol}</b><small>{stock.name}</small></span><ArrowUpRight size={15} /></button>) : <p>No matching stocks in this preview.</p>}</div> : null}</div><button className="icon-button notifications" aria-label="View notifications" onClick={() => setNotice("You're all caught up. Price alerts will be added in a later release.")}><Bell size={18} /><i /></button><div className="header-divider" /><div className="account-controls">{account.user ? <><Link href="/pricing" className="account-plan">{account.paid ? "Pro" : "Free"}</Link><span className="account-email">{account.user.email}</span><button className="secondary-button" onClick={async () => { const { error } = await createClient().auth.signOut(); if (error) { setNotice("Unable to sign out. Try again."); return; } window.location.assign("/"); }}>Sign out</button></> : <Link href="/login" className="secondary-button">Sign in <ArrowRight size={14} /></Link>}</div></div></header>
      <main id="main-content">
        <div className="page-heading"><div><div className="eyebrow">YOUR MARKET, IN FOCUS</div><h1>{active === "Dashboard" ? "Investment overview" : active === "Portfolio" ? "My portfolio" : active === "Watchlist" ? "My watchlist" : "Market news"}<span className="heading-dot">.</span></h1><p>{active === "Dashboard" ? "A little perspective on your investments. All in one place." : active === "Portfolio" ? "Keep track of the companies you own and how they're performing." : active === "Watchlist" ? "The companies on your radar. Ready when you are." : "Stay close to the stories behind your stocks."}</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => setRefreshToken(value => value + 1)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spinning" : ""} /> Refresh</button><button className="primary-button" onClick={() => setHoldingModal(true)}><Plus size={17} /> Add holding</button></div></div>
        <div className="data-banner"><span><span className={isDemo ? "purple-dot" : "green-dot"} />{isDemo ? "Sample data" : "Finnhub price feed"}<span className="banner-divider">/</span>{isDemo ? "Explore the dashboard with a sample portfolio." : "Quotes refresh every 60 seconds while this page is visible."}</span><span className="banner-tail">US stocks <span>·</span> USD</span></div>
        {marketError ? <div className="error-banner" role="status">{marketError} Existing quotes may be stale; check their timestamps.</div> : null}
        {active === "Dashboard" || active === "Portfolio" ? <>
          <div className="overview-grid">
            <section className="card asset-card"><div className="card-title"><span>Portfolio value <CircleHelp size={13} /></span><span className="mini-label">USD</span></div><div className="big-number">{complete ? currency(value) : "Unavailable"}</div><div className="metric-sub"><span className={`gain-badge ${profit < 0 ? "loss" : ""}`}><TrendingUp size={12} />{complete ? `${gain >= 0 ? "+" : ""}${gain.toFixed(2)}%` : "—"}</span><span>on your invested capital</span></div><div className="allocation-heading"><span>Asset allocation</span><span>{holdings.length} holdings</span></div><div className="allocation-bar">{complete && value > 0 ? allocation.map((item, i) => <span key={item.sector} style={{ width: `${item.value / value * 100}%`, background: colors[i] }} />) : <span style={{ width: "100%", background: "#353145" }} />}</div><div className="allocation-list">{complete ? allocation.map((item, i) => <div key={item.sector}><i style={{ background: colors[i] }} /><span>{item.sector}<small>{(item.value / value * 100).toFixed(1)}% of portfolio</small></span><b>{currency(item.value)}</b></div>) : <p className="muted">Waiting for all holding prices.</p>}</div><div className="asset-foot"><span><DollarSign size={14} /> Cost basis</span><b>{currency(costBasis)}</b></div></section>
            <section className="card performance-card"><div className="card-title"><span>Portfolio performance <CircleHelp size={13} /></span><span className="mini-label">ILLUSTRATIVE</span></div><div className="performance-top"><div><div className="big-number">{complete ? currency(value) : "Unavailable"}</div><div className="metric-sub"><span className={profit >= 0 ? "positive" : "negative"}>{complete ? `${profit >= 0 ? "+" : ""}${currency(profit)}` : "Incomplete valuation"}</span><span>unrealized gain / loss</span></div></div><div className="range-picker" aria-label="Sample chart period">{["1M", "3M", "6M", "1Y"].map(period => <button aria-pressed={range === period} className={range === period ? "selected" : ""} key={period} onClick={() => setRange(period)}>{period}</button>)}</div></div><PerformanceChart range={range} /><div className="chart-footer"><span><i /> Portfolio <small>sample history</small></span><span>Historical data integration coming next</span></div></section>
          </div>
          <div className="secondary-grid"><section className="card profit-card"><div className="card-title"><span>Unrealized gain / loss <CircleHelp size={13} /></span><span className="mini-label">HOLDINGS</span></div><div className="profit-top"><div className={`medium-number ${complete && profit < 0 ? "negative" : ""}`}>{complete ? currency(profit) : "Unavailable"}</div><span className="sample-label">Sample monthly breakdown</span></div><ProfitChart /></section><section className="insight-card"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="insight-icon"><Sparkles size={24} /></span><span className="insight-eyebrow">A CLEARER PICTURE</span><h2>Every investment.<br />One point of view.</h2><p>Build your watchlist and follow the companies that matter to you.</p><button onClick={() => navigate("Watchlist")}>Explore your watchlist <ArrowRight size={15} /></button></section></div>
        </> : null}
        {active === "Dashboard" || active === "Watchlist" ? <section className="card watchlist-card"><div className="section-heading"><div><h2>My watchlist <span>{watchlist.length}</span></h2><p>A closer look at your favorite companies.</p></div><button className="text-button" onClick={() => { searchRef.current?.focus(); setNotice("Search one of the preview stocks, then use its star to add it to your watchlist."); }}><Plus size={15} /> Add stock</button></div><div className="table-scroll"><table><thead><tr><th>Company</th><th>Price</th><th>Daily change</th><th>Trend <span className="muted">· sample</span></th><th>Quote time</th><th><span className="sr-only">Remove</span></th></tr></thead><tbody>{watchlist.map(symbol => { const stock = stocks.find(item => item.symbol === symbol)!; const quote = quotes[symbol]; return <tr key={symbol}><td><button className="company-cell" onClick={() => setSelected(stock)}><StockMark stock={stock} /><span><b>{stock.symbol}</b><small>{stock.name}</small></span></button></td><td>{getPrice(stock) === undefined ? <span className="muted">Unavailable</span> : currency(getPrice(stock)!)}</td><td>{getChange(stock) === undefined ? "—" : <Change value={getChange(stock)!} />}</td><td><Sparkline positive={stock.change >= 0} seed={stocks.indexOf(stock) * 3} /></td><td className="muted quote-time">{isDemo ? "Sample" : quote ? new Date(quote.timestamp * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Unavailable"}</td><td><button className="star-button saved" aria-label={`Remove ${symbol} from watchlist`} onClick={() => toggleWatch(symbol)}><Star size={16} fill="currentColor" /></button></td></tr>; })}</tbody></table>{watchlist.length === 0 ? <p className="empty-state">Your private watchlist is empty. Sign in and subscribe to Pro to save stocks.</p> : null}</div></section> : null}
        {active === "Portfolio" ? <section className="card"><div className="section-heading"><div><h2>Your holdings</h2><p>Manual entries for this preview session.</p></div></div><div className="table-scroll"><table><thead><tr><th>Stock</th><th>Shares</th><th>Purchase price</th><th>Market value</th><th>Gain / loss</th><th><span className="sr-only">Remove</span></th></tr></thead><tbody>{holdings.map(holding => { const stock = stocks.find(item => item.symbol === holding.symbol)!; const price = getPrice(stock); const pnl = price === undefined ? undefined : holding.quantity * (price - holding.cost); return <tr key={holding.id}><td><button className="company-cell" onClick={() => setSelected(stock)}><StockMark stock={stock} /><b>{holding.symbol}</b></button></td><td>{holding.quantity}</td><td>{currency(holding.cost)}</td><td>{price === undefined ? "Unavailable" : currency(price * holding.quantity)}</td><td className={pnl !== undefined && pnl >= 0 ? "positive" : "negative"}>{pnl === undefined ? "Unavailable" : currency(pnl)}</td><td><button className="icon-button" aria-label={`Remove ${holding.symbol} holding`} onClick={() => setHoldings(items => items.filter(item => item.id !== holding.id))}><X size={15} /></button></td></tr>; })}</tbody></table>{holdings.length === 0 ? <p className="empty-state">Add your first holding to begin tracking.</p> : null}</div></section> : null}
        {active === "Dashboard" || active === "News" ? <section className="news-section"><div className="section-heading"><div><h2>On your radar <span className="news-label">{isDemo ? "READING ROOM" : "AAPL NEWS"}</span></h2><p>{isDemo ? "Company updates, straight from the source." : "Latest available Apple headlines from Finnhub."}</p></div><Newspaper size={19} className="muted" /></div>{newsError ? <p className="error-banner">{newsError}</p> : null}<div className="news-grid">{isDemo ? [{ name: "Apple", symbol: "AAPL", title: "Explore the latest announcements from Apple", url: "https://www.apple.com/newsroom/", category: "COMPANY NEWSROOM", style: "apple" }, { name: "NVIDIA", symbol: "NVDA", title: "Follow what's next in accelerated computing", url: "https://nvidianews.nvidia.com/", category: "COMPANY NEWSROOM", style: "nvidia" }, { name: "Microsoft", symbol: "MSFT", title: "Stay up to date with Microsoft investor news", url: "https://www.microsoft.com/en-us/Investor", category: "INVESTOR RELATIONS", style: "microsoft" }].map(item => <a className="news-card" key={item.symbol} href={item.url} target="_blank" rel="noopener noreferrer"><div className={`news-art ${item.style}`}><span>{item.name}</span><ArrowUpRight size={20} /><i /><i /></div><div className="news-copy"><span>{item.category}</span><h3>{item.title}</h3><div><b>{item.symbol}</b><small>Visit official source <ArrowUpRight size={12} /></small></div></div></a>) : articles.length ? articles.slice(0, 6).map(article => <a className="news-card live-news" key={article.id} href={article.url} target="_blank" rel="noopener noreferrer"><div className="news-copy"><span>{article.source}</span><h3>{article.headline}</h3><p>{article.summary.slice(0, 140)}{article.summary.length > 140 ? "…" : ""}</p><div><b>AAPL</b><small>{new Date(article.datetime * 1000).toLocaleDateString("en-US")} <ArrowUpRight size={12} /></small></div></div></a>) : <p className="empty-state">No news available right now.</p>}</div></section> : null}
        <footer className="page-footer"><span><Activity size={13} /> InvestmentTracker</span><span>{isDemo ? "Sample prices & holdings · Private watchlists saved to your account" : "Finnhub quotes · Sample portfolio · Private watchlists"}</span></footer>
      </main>
    </div>
    {notice ? <div className="toast" role="status"><CircleHelp size={18} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div> : null}
    <dialog ref={dialogRef} className="modal" aria-label={selected ? selected.name : "Add a holding"} onCancel={closeModal} onClick={event => { if (event.target === event.currentTarget) closeModal(); }}><div className="modal-heading"><h2>{selected ? selected.name : "Add a holding"}</h2><button className="icon-button" aria-label="Close dialog" onClick={closeModal}><X size={18} /></button></div>{selected ? <div className="stock-details"><div className="detail-symbol"><StockMark stock={selected} /><span>{selected.symbol} · US stock · USD</span><button className={`star-button ${watchlist.includes(selected.symbol) ? "saved" : ""}`} aria-label={watchlist.includes(selected.symbol) ? `Remove ${selected.symbol} from watchlist` : `Save ${selected.symbol} to watchlist`} onClick={() => toggleWatch(selected.symbol)}><Star size={21} fill={watchlist.includes(selected.symbol) ? "currentColor" : "none"} /></button></div><div className="detail-quote">{stockQuote(selected)}</div><p className="muted">{isDemo ? "Sample price for the design preview." : quotes[selected.symbol] ? `Quote timestamp: ${new Date(quotes[selected.symbol].timestamp * 1000).toLocaleString()}.` : "Price unavailable."}</p><div className="detail-stat"><span>Sector</span><b>{selected.sector}</b></div><button className="primary-button full-width" onClick={() => { setSelected(null); setHoldingModal(true); }}>Log a holding <Plus size={16} /></button></div> : <form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const symbol = String(form.get("symbol")); const quantity = Number(form.get("quantity")); const cost = Number(form.get("cost")); if (!stocks.some(stock => stock.symbol === symbol) || !Number.isFinite(quantity) || !Number.isFinite(cost) || quantity <= 0 || cost <= 0 || quantity > 1e7 || cost > 1e7) { setFormError("Enter a valid stock, shares, and purchase price."); return; } setHoldings(items => [...items, { id: crypto.randomUUID(), symbol, quantity, cost }]); closeModal(); setNotice("Holding added to this preview session."); }}><p className="muted">Manually record shares you own. Preview entries reset on reload.</p><label>Stock<select name="symbol">{stocks.map(stock => <option key={stock.symbol} value={stock.symbol}>{stock.symbol} — {stock.name}</option>)}</select></label><div className="form-row"><label>Number of shares<input name="quantity" type="number" min="0.000001" max="10000000" step="any" placeholder="e.g. 10" required /></label><label>Purchase price (USD)<input name="cost" type="number" min="0.000001" max="10000000" step="any" placeholder="e.g. 180.00" required /></label></div>{formError ? <p className="negative" role="alert">{formError}</p> : null}<button type="submit" className="primary-button full-width"><Plus size={16} /> Add holding</button></form>}</dialog>
  </div>;
}
