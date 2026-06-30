import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";

/**
 * The current request's user id, or null if unauthenticated.
 * Route handlers use this to gate access (401) before building a ScopedDb.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}
