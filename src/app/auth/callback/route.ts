import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth/errors";
import { getSiteUrl } from "@/lib/auth/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const siteUrl = getSiteUrl();
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const destination = (path: string) => {
    const response = NextResponse.redirect(new URL(path, siteUrl));
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  if (params.has("error") || (!code && !tokenHash) || (code && tokenHash)) return destination("/auth/error");
  const supabase = await createSupabaseServerClient();
  let error;
  if (tokenHash && tokenHash.length <= 2048 && (type === "invite" || type === "recovery" || type === "email")) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code && code.length <= 2048) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    return destination("/auth/error");
  }
  if (error) {
    authErrorMessage(error);
    return destination("/auth/error");
  }
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) {
    authErrorMessage(userError);
    return destination("/auth/error");
  }
  if (!data.user) return destination("/auth/error");
  return destination("/set-password");
}