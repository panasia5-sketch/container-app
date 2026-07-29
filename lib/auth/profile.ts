import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_USER_ROLE,
  isUserRole,
  type UserRole,
} from "@/lib/auth/permissions";

export type UserProfile = {
  user_id: string;
  email: string;
  role: UserRole;
};

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, email, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load user profile: ${getErrorMessage(error, "Unknown error")}`,
    );
  }

  if (!data) return null;

  const role = isUserRole(data.role) ? data.role : DEFAULT_USER_ROLE;

  return {
    user_id: data.user_id,
    email: data.email,
    role,
  };
}

/** Create a profile on first login; default role is viewer until an admin changes it. */
export async function ensureUserProfile(
  userId: string,
  email: string,
): Promise<UserProfile> {
  const existing = await fetchUserProfile(userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("user_profiles")
    .insert({
      user_id: userId,
      email,
      role: DEFAULT_USER_ROLE,
    })
    .select("user_id, email, role")
    .single();

  if (error) {
    throw new Error(
      `Failed to create user profile: ${getErrorMessage(error, "Unknown error")}`,
    );
  }

  const role = isUserRole(data.role) ? data.role : DEFAULT_USER_ROLE;

  return {
    user_id: data.user_id,
    email: data.email,
    role,
  };
}
