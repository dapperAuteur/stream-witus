import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { genericOAuth } from "better-auth/plugins";
import { db, schema } from "@/db/client";
import { isAllowedToSignIn } from "./access";
import { env } from "./env";
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
                discoveryUrl:
                  env.WITUS_OIDC_DISCOVERY_URL ??
                  "https://accounts.witus.online/api/idp/.well-known/openid-configuration",
                clientId: env.WITUS_OIDC_CLIENT_ID,
                clientSecret: env.WITUS_OIDC_CLIENT_SECRET ?? "",
                scopes: ["openid", "email", "profile"],
                pkce: true,
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
