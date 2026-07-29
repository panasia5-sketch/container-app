import type { TabId } from "@/lib/types";

/** Extend this list when adding new roles. */
export const USER_ROLES = ["admin", "manager", "viewer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEFAULT_USER_ROLE: UserRole = "viewer";

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

/** Menu access by role — add tabs here when new menus are introduced. */
export const TAB_ACCESS: Record<UserRole, TabId[]> = {
  admin: ["products", "purchase", "history"],
  manager: ["products", "purchase", "history"],
  viewer: ["products", "history"],
};

/** Fine-grained actions for future UI/API guards (buttons, forms, etc.). */
export type AppAction =
  | "products.read"
  | "products.create"
  | "products.update"
  | "products.export"
  | "purchase.read"
  | "purchase.create"
  | "purchase.upload"
  | "history.read"
  | "history.delete";

export const ACTION_ACCESS: Record<UserRole, AppAction[]> = {
  admin: [
    "products.read",
    "products.create",
    "products.update",
    "products.export",
    "purchase.read",
    "purchase.create",
    "purchase.upload",
    "history.read",
    "history.delete",
  ],
  manager: [
    "products.read",
    "products.create",
    "products.update",
    "products.export",
    "purchase.read",
    "purchase.create",
    "purchase.upload",
    "history.read",
    "history.delete",
  ],
  viewer: ["products.read", "products.export", "history.read"],
};

export function getAccessibleTabs(role: UserRole): TabId[] {
  return TAB_ACCESS[role];
}

export function canAccessTab(role: UserRole, tab: TabId): boolean {
  return TAB_ACCESS[role].includes(tab);
}

export function canPerformAction(role: UserRole, action: AppAction): boolean {
  return ACTION_ACCESS[role].includes(action);
}

export function getRoleLabelKey(role: UserRole): string {
  return `roles.${role}`;
}
