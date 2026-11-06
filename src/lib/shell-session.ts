import "server-only";
import { cache } from "react";
import { getAdminUser, getSessionUser } from "./session";

export interface ShellSession {
  signedIn: boolean;
  /** Shown in the account menu so the person can see which account is signed in. */
  email: string | null;
  isAdmin: boolean;
}

const SIGNED_OUT: ShellSession = { signedIn: false, email: null, isAdmin: false };

/**
 * What the site header and footer need to know about the visitor.
 *
 * NEVER THROWS. This runs in the root layout, and a root layout that throws takes every page down
 * to global-error, header and all. A failed lookup (database unreachable, a malformed cookie)
 * falls back to signed out, so the header still shows "Sign in" (the shared rule: the control is
 * shown "whenever the visitor is not authenticated", and an unknown session counts). The real gates
 * are elsewhere: the /dashboard layout and each owner-scoped route check the session themselves.
 */
export const getShellSession = cache(async (): Promise<ShellSession> => {
  try {
    const user = await getSessionUser();
    if (!user) return SIGNED_OUT;
    let isAdmin = false;
    try {
      isAdmin = Boolean(await getAdminUser());
    } catch {
      // The Admin link is a convenience; a failed role lookup hides it and nothing else.
    }
    return { signedIn: true, email: user.email, isAdmin };
  } catch {
    return SIGNED_OUT;
  }
});
