import "server-only";
import { headers } from "next/headers";
import { getUserFlags, isOwnerEmail } from "./access";
import { auth } from "./auth";

/**
 * The current request's user id, or null if unauthenticated.
 * Route handlers use this to gate access (401) before building a ScopedDb.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** The current user's id + email, or null. */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  return { id: session.user.id, email: session.user.email };
}

/** True when the signed-in user is the owner (email === OWNER_EMAIL). Gates admin. */
export async function isOwnerSession(): Promise<boolean> {
  const user = await getSessionUser();
  return isOwnerEmail(user?.email);
}

/** The signed-in owner ({id,email}), or null. Use in admin routes that audit-log. */
export async function getOwnerUser(): Promise<{ id: string; email: string } | null> {
  const user = await getSessionUser();
  return user && isOwnerEmail(user.email) ? user : null;
}

export type AdminRole = "owner" | "admin" | "moderator" | "monitor";
export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
}

// Capability ladder. Owner sits above admin. Higher number = more power.
const RANK: Record<AdminRole, number> = { monitor: 1, moderator: 2, admin: 3, owner: 4 };
export const canView = (r: AdminRole) => RANK[r] >= RANK.monitor; // any admin role
export const canModerate = (r: AdminRole) => RANK[r] >= RANK.moderator;
export const canManageSettings = (r: AdminRole) => RANK[r] >= RANK.admin;
export const canManageUsers = (r: AdminRole) => r === "owner";

/** The signed-in admin with their role, or null (no admin access / deactivated). */
export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (isOwnerEmail(user.email)) return { ...user, role: "owner" };
  const flags = await getUserFlags(user.id);
  if (flags.deactivated || flags.adminRole === "none") return null;
  return { ...user, role: flags.adminRole as Exclude<AdminRole, "owner"> };
}

/** The admin user if they satisfy the capability `check`, else null (caller → 404). */
export async function requireAdmin(check: (r: AdminRole) => boolean): Promise<AdminUser | null> {
  const admin = await getAdminUser();
  return admin && check(admin.role) ? admin : null;
}
