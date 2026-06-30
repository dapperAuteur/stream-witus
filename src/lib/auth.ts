import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { db, schema } from "@/db/client";
import { env } from "./env";
import { sendEmail } from "./mailer";

function trustedOrigins(): string[] {
  const fromEnv = (env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL, ...fromEnv]));
}

// Personal-first v1: magic-link only, single product (no per-tenant branding).
// The better-auth `users` table is the FK target for media_items.user_id etc.
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
        await sendEmail({
          to: email,
          subject: "Your Stream.WitUS sign-in link",
          text: `Sign in to Stream.WitUS:\n${url}\n\nThis link expires in 10 minutes. If you didn't request it, ignore this email.`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
