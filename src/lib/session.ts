import "server-only";
import { headers } from "next/headers";
import { isOwnerEmail } from "./access";
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
