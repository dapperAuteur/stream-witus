import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { genericOAuth } from "better-auth/plugins";
import { db, schema } from "@/db/client";
import { isAllowedToSignIn } from "./access";
import { env, WITUS_OIDC_DISCOVERY_FALLBACK } from "./env";
import { sendEmail } from "./mailer";

function trustedOrigins(): string[] {
  const fromEnv = (env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL, ...fromEnv]));
}

// Personal-first v1: magic-link only, single product. Sign-up is gated — only the
// OWNER_EMAIL (or approved waitlist entries / existing members) may sign in while
// signups are closed. The sign-in page pre-checks via /api/access; these two guards
// are defence-in-depth so a direct API call can't create a non-allowed account.
export const auth = betterAuth({
  appName: "Stream.WitUS",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Never send a link to a non-allowed email (waitlisted addresses are
        // handled by /api/access/request, which doesn't send).
        if (!(await isAllowedToSignIn(email))) return;
        await sendEmail({
          to: email,
          subject: "Your Stream.WitUS sign-in link",
          text: `Sign in to Stream.WitUS:\n${url}\n\nThis link expires in 10 minutes. If you didn't request it, ignore this email.`,
        });
      },
    }),
    // "Sign in with WitUS" — the ecosystem IdP as an OIDC provider. Added only once
    // WITUS_OIDC_CLIENT_ID is set, so a missing env never breaks the build or the
    // magic-link flow. Sign-ups via this provider are STILL gated by the
    // user.create.before allow-list below — an unapproved WitUS account can't create
    // a Stream account (invite-only v1 holds across both sign-in methods).
    ...(env.WITUS_OIDC_CLIENT_ID
      ? [
          genericOAuth({
            config: [
              {
                providerId: "witus",
                // Same fallback constant the silent-check + sign-out-everywhere endpoints derive from
                // (src/lib/env.ts), so the probe can never point at a different host than the one
                // the click actually signs in against.
                discoveryUrl: env.WITUS_OIDC_DISCOVERY_URL ?? WITUS_OIDC_DISCOVERY_FALLBACK,
                clientId: env.WITUS_OIDC_CLIENT_ID,
                clientSecret: env.WITUS_OIDC_CLIENT_SECRET ?? "",
                scopes: ["openid", "email", "profile"],
                pkce: true,
                // The IdP registers /api/auth/oauth2/callback/witus (the ecosystem-wide better-auth 1.6
                // path, exact-match validated). better-auth 1.7 serves the callback at the core
                // /api/auth/callback/:id, so the authorize/token redirect_uri is pinned to the registered
                // form and src/app/api/auth/oauth2/callback/[providerId] 307s it to the core handler.
                // Same shim as vogoat.
                redirectURI: new URL("/api/auth/oauth2/callback/witus", env.BETTER_AUTH_URL).toString(),
                // "Sign out" ends ONLY this app's session (witus task 128 option (b)). better-auth
                // 1.7 made RP-initiated logout the default: without this flag, signOut() answers
                // with the IdP's end_session_endpoint + id_token_hint and the client follows it,
                // which strands the person on accounts.witus.online and ends the shared WitUS
                // session. "Sign out of WitUS everywhere" does its own handoff (signOutEverywhere()
                // in src/lib/sign-out.ts: signOut(), then a full navigation to the end-session URL
                // with client_id and post_logout_redirect_uri), so it never relied on this.
                // Pinned by tests/sign-out-local-only.test.ts.
                disableProviderLogout: true,
              },
            ],
          }),
        ]
      : []),
    nextCookies(),
  ],
  databaseHooks: {
    user: {
      create: {
        // Abort account creation for any email that isn't allowed to sign up.
        // Applies to BOTH magic-link and WitUS-SSO users — the allow-list is the
        // single chokepoint for invite-only v1.
        before: async (user) => {
          if (!(await isAllowedToSignIn(user.email))) return false;
          return { data: user };
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
