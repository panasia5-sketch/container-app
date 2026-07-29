import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { isUserRole, type UserRole } from "@/lib/auth/permissions";

export type UserProfileRow = {
  user_id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export async function fetchAllUserProfiles(): Promise<UserProfileRow[]> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, email, role, created_at, updated_at")
    .order("email");

  if (error) {
    throw new Error(
      `Failed to load users: ${getErrorMessage(error, "Unknown error")}`,
    );
  }

  return (data ?? [])
    .filter((row) => isUserRole(row.role))
    .map((row) => ({
      user_id: row.user_id,
      email: row.email,
      role: row.role as UserRole,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<void> {
  const { error } = await supabase
    .from("user_profiles")
    .update({ role })
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      `Failed to update role: ${getErrorMessage(error, "Unknown error")}`,
    );
  }
}
