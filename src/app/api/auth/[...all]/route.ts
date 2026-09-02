import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { silentSsoRecoveryPath } from "@/lib/silent-sso";

const handlers = toNextJsHandler(auth);

/**
 * Better Auth's routes, with ONE interception in front of the WitUS OIDC callback.
 *
 * When the IdP declines ("no session", "consent needed", or the visitor cancelled), Better Auth's
 * generic-OAuth callback redirects on `ctx.query.error` BEFORE it parses the OAuth state that
 * carries our `errorCallbackURL`, so the visitor lands on its raw /api/auth/error page. For those
 * five decline codes the right answer is a quiet return to /signin — and the redirect carries
 * `?sso=tried`, which is the half of the "Continue as <name>" loop guard that survives a browser
 * where sessionStorage throws or is empty.
 *
 * `silentSsoRecoveryPath` is deliberately narrow: this app's own witus callback path, those five
 * codes, nothing else. A real fault (token exchange, issuer mismatch) still surfaces exactly as it
 * does today rather than being swallowed into a blank sign-in page.
 */
export async function GET(request: Request): Promise<Response> {
  const recovery = silentSsoRecoveryPath(new URL(request.url));
  // Relative Location: the browser resolves it against whichever origin it arrived on.
  if (recovery) return new Response(null, { status: 302, headers: { location: recovery } });
  return handlers.GET(request);
}

export const POST = handlers.POST;
