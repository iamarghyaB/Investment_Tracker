export type Stock = { symbol: string; name: string; mark: string; color: string; price: number; change: number; sector: string };
export type Quote = { symbol: string; price: number; change: number; timestamp: number };
export type Article = { id: number; headline: string; source: string; url: string; datetime: number; summary: string };
export type Holding = { id: string; symbol: string; quantity: number; cost: number };

// Design fixtures only. These are not current market quotes.
export const stocks: Stock[] = [
  { symbol: "AAPL", name: "Apple Inc.", mark: "a", color: "#c5c8d4", price: 227.63, change: 1.24, sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA Corporation", mark: "n", color: "#8fd44b", price: 139.19, change: 2.85, sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corporation", mark: "m", color: "#67a7ef", price: 428.76, change: 0.68, sector: "Technology" },
  { symbol: "TSLA", name: "Tesla, Inc.", mark: "t", color: "#f06d7d", price: 248.50, change: -1.32, sector: "Consumer" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", mark: "a", color: "#f5b55b", price: 207.09, change: 1.76, sector: "Consumer" },
  { symbol: "GOOGL", name: "Alphabet Inc.", mark: "g", color: "#8c9eff", price: 176.28, change: -0.42, sector: "Communication" },
  { symbol: "META", name: "Meta Platforms, Inc.", mark: "∞", color: "#69a9ff", price: 590.42, change: 1.21, sector: "Communication" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", mark: "j", color: "#b69af1", price: 241.37, change: 0.54, sector: "Financials" },
];
export const initialHoldings: Holding[] = [
  { id: "sample-1", symbol: "AAPL", quantity: 80, cost: 181.50 },
  { id: "sample-2", symbol: "NVDA", quantity: 120, cost: 104.20 },
  { id: "sample-3", symbol: "MSFT", quantity: 35, cost: 365.80 },
  { id: "sample-4", symbol: "AMZN", quantity: 50, cost: 168.40 },
];
export const history = [39, 42, 40, 46, 45, 50, 47, 44, 52, 55, 53, 60, 57, 54, 50, 53, 49, 58, 61, 56, 64, 62, 69, 65, 68, 72, 67, 63, 69, 73, 71, 78, 74, 81, 77, 84, 82, 88, 83, 86, 90, 87, 93, 89, 95, 91, 96, 94, 99];
