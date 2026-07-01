import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
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
    nextCookies(),
  ],
  databaseHooks: {
    user: {
      create: {
        // Abort account creation for any email that isn't allowed to sign up.
        before: async (user) => {
          if (!(await isAllowedToSignIn(user.email))) return false;
          return { data: user };
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
