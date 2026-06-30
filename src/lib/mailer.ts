import formData from "form-data";
import Mailgun from "mailgun.js";
import { env, hasMailgun } from "./env";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Sends via Mailgun when configured. Before Mailgun is set up (operator task 04),
// it logs to the server console so magic-link sign-in still works in local dev —
// copy the link from the terminal.
export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<void> {
  const sender = env.MAIL_FROM;

  if (!hasMailgun) {
    console.log(
      `\n[mailer:dev] (Mailgun not configured — logging instead)\n  From: ${sender}\n  To: ${to}\n  Subject: ${subject}\n  ${text}\n`,
    );
    return;
  }

  const mailgun = new Mailgun(formData);
  const mg = mailgun.client({
    username: "api",
    key: env.MAILGUN_API_KEY as string,
    url: env.MAILGUN_REGION === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net",
  });

  try {
    await mg.messages.create(env.MAILGUN_DOMAIN as string, {
      from: sender,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[mailer] Mailgun send FAILED (to=${to}, domain=${env.MAILGUN_DOMAIN}): ${detail}`);
    console.log(
      `\n[mailer:fallback] Email NOT delivered — content (copy any link here to continue):\n  Subject: ${subject}\n  To: ${to}\n  ${text}\n`,
    );
    throw new Error(`Email send failed: ${detail}`);
  }
}
