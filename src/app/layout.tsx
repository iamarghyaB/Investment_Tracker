import type { Metadata } from "next";
import "./globals.css";
import { AccountProvider } from "@/components/account-provider";

export const metadata: Metadata = {
  title: "InvestmentTracker — Your market, in focus",
  description: "A personal stock tracking dashboard for US stocks in USD.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AccountProvider>{children}</AccountProvider></body></html>;
}
