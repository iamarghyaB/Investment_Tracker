"use client";

import { useId, useState } from "react";
import { history } from "@/lib/sample-data";

export function Sparkline({ positive = true, seed = 0 }: { positive?: boolean; seed?: number }) {
  const values = history.slice(seed, seed + 16);
  const points = values.map((v, i) => `${i * 4},${positive ? 35 - (v - 38) * .65 : (v - 38) * .65 + 4}`).join(" ");
  return <svg viewBox="0 0 60 36" className="sparkline" aria-hidden="true"><polyline points={points} fill="none" stroke={positive ? "#66d8a4" : "#ee7c93"} strokeWidth="1.4" /></svg>;
}

export function PerformanceChart({ range }: { range: string }) {
  const id = useId().replaceAll(":", "");
  const [hover, setHover] = useState<number | null>(null);
  const length = range === "1M" ? 18 : range === "3M" ? 28 : range === "6M" ? 38 : 49;
  const data = history.slice(-length);
  const points = data.map((value, i) => [45 + i / (data.length - 1) * 655, 215 - (value - 30) * 2.25]);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const current = hover === null ? points.length - 1 : hover;
  const [x, y] = points[current];
  const labels = range === "1M" ? ["Week 1", "Week 2", "Week 3", "Week 4"] : range === "3M" ? ["Jul", "Aug", "Sep", "Oct"] : range === "6M" ? ["May", "Jun", "Jul", "Aug", "Sep", "Oct"] : ["Nov", "Jan", "Mar", "May", "Jul", "Oct"];
  return <div className="chart-wrap">
    <svg viewBox="0 0 735 275" role="img" aria-label={`Illustrative portfolio performance over ${range}; sample data, not actual returns`} onMouseLeave={() => setHover(null)} onMouseMove={event => {
      const box = event.currentTarget.getBoundingClientRect();
      setHover(Math.max(0, Math.min(points.length - 1, Math.round(((event.clientX - box.left) / box.width * 735 - 45) / 655 * (points.length - 1)))));
    }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8761ff" stopOpacity=".3" /><stop offset="100%" stopColor="#8761ff" stopOpacity="0" /></linearGradient></defs>
      {[45, 100, 155, 210].map((yy, i) => <g key={yy}><text x="0" y={yy + 4} className="axis">${80 - i * 20}k</text><line x1="45" x2="705" y1={yy} y2={yy} className="gridline" /></g>)}
      <path d={`${path} L700,230 L45,230 Z`} fill={`url(#${id})`} />
      <path d={path} stroke="#a98bff" strokeWidth="2.4" fill="none" strokeLinejoin="round" />
      {points.map(([xx], i) => <rect key={i} x={xx - 1.5} y={226 - (i * 13 % 19)} width="3" height={10 + (i * 13 % 19)} fill="#777187" opacity=".28" />)}
      <line x1={x} x2={x} y1="20" y2="238" stroke="#a68aff" strokeDasharray="3 5" opacity=".6" />
      <circle cx={x} cy={y} r="9" fill="#8c65ff" opacity=".2" /><circle cx={x} cy={y} r="4" fill="#e5d9ff" stroke="#a68aff" strokeWidth="2" />
      {labels.map((label, i) => <text key={label} x={45 + i / (labels.length - 1) * 655} y="264" textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} className="axis">{label}</text>)}
    </svg>
    <div className="chart-tag">Sample performance <span>•</span> {range}</div>
  </div>;
}

export function ProfitChart() {
  const values = [29, 44, 37, 56, 49, 72, 86];
  return <div className="bar-chart" role="img" aria-label="Illustrative monthly gains, sample data">
    {values.map((value, i) => <div className="bar-column" key={i}><span className="bar-value">${(value * 48).toLocaleString("en-US")}</span><div className="bar-stack" style={{ height: `${value}px` }}><i /><i /><i /></div><span>{["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"][i]}</span></div>)}
  </div>;
}
