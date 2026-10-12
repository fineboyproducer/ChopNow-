import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@chopnow/lib";

/**
 * Handles Supabase's email-confirmation and OAuth redirect callback.
 * Exchanges the `code` query param for a session, then sends the user
 * on to their intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/home";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
