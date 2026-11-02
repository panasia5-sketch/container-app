import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import {
  canPerformAction,
  DEFAULT_USER_ROLE,
  isUserRole,
  type AppAction,
  type UserRole,
} from "@/lib/auth/permissions";

export type AuthedRequest = {
  userId: string;
  email: string;
  role: UserRole;
  accessToken: string;
};

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/** Verify Supabase JWT from Authorization header and load role. */
export async function requireAuthedUser(
  request: NextRequest,
): Promise<AuthedRequest | { error: string; status: number }> {
  const token = getBearerToken(request);
  if (!token) {
    return { error: "로그인이 필요합니다.", status: 401 };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { error: "Supabase 환경 변수가 설정되지 않았습니다.", status: 500 };
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { error: "인증에 실패했습니다.", status: 401 };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const role =
    profile && isUserRole(profile.role) ? profile.role : DEFAULT_USER_ROLE;

  return {
    userId: user.id,
    email: profile?.email || user.email || "",
    role,
    accessToken: token,
  };
}

export function requireAction(
  auth: AuthedRequest,
  action: AppAction,
): { error: string; status: number } | null {
  if (!canPerformAction(auth.role, action)) {
    return { error: "권한이 없습니다.", status: 403 };
  }
  return null;
}

/** Supabase client scoped to the caller's JWT (for RLS). */
export function supabaseAsUser(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
