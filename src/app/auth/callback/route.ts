import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/http";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${appUrl()}/`);
  }
  return NextResponse.redirect(`${appUrl()}/login?confirmation=failed`);
}
