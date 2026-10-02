import type { NextConfig } from "next";

const development = process.env.NODE_ENV !== "production";
const config: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' ${development ? "'unsafe-eval'" : ""} https://js.stripe.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com ${development ? "ws://127.0.0.1:3000 ws://localhost:3000" : ""}`,
        "frame-src https://checkout.stripe.com https://js.stripe.com https://hooks.stripe.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self' https://checkout.stripe.com",
      ].join("; ") },
    ] }];
  },
};
export default config;
