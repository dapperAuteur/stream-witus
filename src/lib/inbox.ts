import "server-only";
import { env } from "./env";
import { sendToInbox } from "./sender-inbox";

export const hasInbox = Boolean(
  env.INBOX_INGEST_URL && env.INBOX_SOURCE_SLUG && env.INBOX_INGEST_SECRET,
);

/**
 * Forward a public form submission to witus-inbox (HMAC-signed). The secret is
 * server-only, so forms POST to our own /api routes which call this — the browser
 * never sees the secret. Until the inbox source is provisioned (task 07) this logs
 * to the console and reports success, so the forms work in local dev.
 */
export async function submitToInbox(
  formType: string,
  data: { name: string; email: string; priority?: "normal" | "high"; payload: Record<string, unknown> },
): Promise<{ ok: boolean; status: number }> {
  if (!hasInbox) {
    console.log(`[inbox:dev] (not configured — logging) ${formType} from ${data.email}`);
    return { ok: true, status: 200 };
  }
  const res = await sendToInbox({
    inboxUrl: env.INBOX_INGEST_URL as string,
    sourceSlug: env.INBOX_SOURCE_SLUG as string,
    hmacSecret: env.INBOX_INGEST_SECRET as string,
    submission: {
      form_type: formType,
      submitter_email: data.email,
      submitter_name: data.name,
      priority: data.priority,
      payload: data.payload,
    },
  });
  // Iron rule: log only source / form_type / http_status — never the body or secret.
  if (!res.ok) {
    console.error("[inbox] failed", { source: env.INBOX_SOURCE_SLUG, form_type: formType, http_status: res.status });
  }
  return { ok: res.ok, status: res.status };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (v: unknown): v is string => typeof v === "string" && EMAIL_RE.test(v);
/** Honeypot: a hidden field real users leave empty; bots fill it. */
export const isBot = (body: Record<string, unknown>) => Boolean(typeof body.company === "string" && body.company.trim());
