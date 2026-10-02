"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Account = { user: { id: string; email: string } | null; paid: boolean; loading: boolean; error: string; subscription?: { status: string; current_period_end: string | null; cancel_at_period_end: boolean }; refresh: () => Promise<void> };
const AccountContext = createContext<Account>({ user: null, paid: false, loading: true, error: "", refresh: async () => {} });
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Omit<Account, "refresh">>({ user: null, paid: false, loading: true, error: "" });
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load account.");
      setAccount({ ...data, loading: false, error: "" });
    } catch (error) { setAccount({ user: null, paid: false, loading: false, error: error instanceof Error ? error.message : "Account unavailable." }); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <AccountContext.Provider value={{ ...account, refresh }}>{children}</AccountContext.Provider>;
}
export const useAccount = () => useContext(AccountContext);
