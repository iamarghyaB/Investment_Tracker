"use client";

import { useState } from "react";
import { Globe, Pause, Play } from "lucide-react";
import { stocks, type Quote, type Stock } from "@/lib/sample-data";

export function MarketTicker({ quotes, history, demo, onSelect }: {
  quotes: Record<string, Quote>;
  history: Record<string, Quote[]>;
  demo: boolean;
  onSelect: (stock: Stock) => void;
}) {
  const [paused, setPaused] = useState(false);
  return <section className={`ticker-strip ${paused ? "ticker-paused" : ""}`} aria-label="US stock market ticker">
    <div className="market-label"><Globe size={14} /><div><span>US markets</span><small><i className={demo ? "purple-dot" : "green-dot"} />{demo ? "Sample quotes" : "Updates every 60s"}</small></div></div>
    <div className="ticker-window"><div className="ticker-track">
      {[0, 1].map(copy => <div className="ticker-group" key={copy} aria-hidden={copy === 1 ? true : undefined} inert={copy === 1 ? true : undefined}>
        {stocks.map(stock => {
          const quote = quotes[stock.symbol];
          const change = demo ? stock.change : quote?.change;
          const price = demo ? stock.price : quote?.price;
          const samples = demo ? [] : history[stock.symbol] || [];
          const prices = [...(quote?.previousClose ? [quote.previousClose] : []), ...samples.map(sample => sample.price)];
          const low = prices.length ? Math.min(...prices) : 0;
          const high = prices.length ? Math.max(...prices) : 0;
          const y = (value: number) => high === low ? 15 : 26 - (value - low) / (high - low) * 22;
          const points = Array.from({ length: 24 }, (_, i) => {
            const index = prices.length > 1 ? i / 23 * (prices.length - 1) : 0;
            const left = Math.floor(index);
            const value = prices.length ? prices[left] + ((prices[Math.min(left + 1, prices.length - 1)] - prices[left]) * (index - left)) : 0;
            return `${i === 0 ? "M" : "L"}${(i / 23 * 68 + 2).toFixed(2)},${y(value).toFixed(2)}`;
          }).join(" ");
          const color = change === undefined ? "muted" : change >= 0 ? "positive" : "negative";
          const last = samples[samples.length - 1];
          const previous = samples[samples.length - 2];
          const updated = previous && last.price !== previous.price;
          return <button key={stock.symbol} className="ticker" onClick={() => onSelect(stock)} title={`${stock.name} · ${demo ? "Sample quote" : quote ? `Quote ${new Date(quote.timestamp * 1000).toLocaleString()}. Graph: previous close followed by quotes collected this session; not full intraday history.` : "Waiting for quote"}`}>
            <span className="stock-mark" style={{ color: stock.color, background: `${stock.color}15` }}>{stock.mark}</span>
            <span className="ticker-company"><b>{stock.symbol}</b><small>{stock.name.replace(/,? (Inc\.|Corporation|Platforms, Inc\.|& Co\.)$/, "")}</small></span>
            <svg viewBox="0 0 72 30" className={`ticker-chart ${color}`} aria-hidden="true"><path d={points} /><circle cx="70" cy={prices.length ? y(prices[prices.length - 1]) : 15} r="2" /></svg>
            <span className="ticker-numbers"><b key={last?.timestamp} className={updated ? `quote-flash ${last.price >= previous.price ? "positive" : "negative"}` : ""}>{price === undefined ? "—" : `$${price.toFixed(2)}`}</b><small className={color}>{change === undefined ? "Unavailable" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}</small></span>
          </button>;
        })}
      </div>)}
    </div></div>
    <button className="ticker-control" onClick={() => setPaused(value => !value)} aria-label={paused ? "Resume market ticker" : "Pause market ticker"} aria-pressed={paused}>{paused ? <Play size={13} /> : <Pause size={13} />}</button>
  </section>;
}
