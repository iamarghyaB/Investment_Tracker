import "server-only";
import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function appUrl() {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000");
  return url.origin;
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === appUrl();
}
