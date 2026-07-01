import { after } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import { badRequest } from "@/lib/api";
import { isBot, isEmail, recordInboxSubmission, submitToInbox } from "@/lib/inbox";

// Public "be on the show" form (guest / co-host). No auth.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid request");
  // Honeypot → pretend success, drop silently.
  if (isBot(body)) return NextResponse.json({ ok: true });

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const role = body.role === "co-host" ? "co-host" : "guest";
  const topic = String(body.topic ?? "").trim();
  if (!name) return badRequest("name is required");
  if (!isEmail(email)) return badRequest("a valid email is required");
  if (!topic) return badRequest("tell us what you'd talk about");

  // Local mirror is the reliable capture (owner triages it in admin); the forward
  // to witus-inbox is best-effort. Both run after() so the form always succeeds.
  const payload = { role, topic, link: String(body.link ?? "").trim() || null };
  after(async () => {
    await recordInboxSubmission("be-on-show", { name, email, payload });
    await submitToInbox("be-on-show", { name, email, payload });
  });
  return NextResponse.json({ ok: true });
}
