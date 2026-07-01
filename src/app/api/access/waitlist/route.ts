import { after } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import { addToWaitlist } from "@/lib/access";
import { badRequest } from "@/lib/api";
import { isBot, isEmail, submitToInbox } from "@/lib/inbox";

// Public: join the waitlist. Records the email (source of truth) and notifies the
// inbox best-effort — a failed notification never blocks the join.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid request");
  if (isBot(body)) return NextResponse.json({ ok: true }); // honeypot

  const email = String(body.email ?? "").trim();
  if (!isEmail(email)) return badRequest("a valid email is required");
  const name = String(body.name ?? "").trim() || email;

  await addToWaitlist(email);
  // Notify inbox triage after the response — never block the user on it.
  after(async () => {
    await submitToInbox("waitlist", { name, email, payload: { source: "signin" } });
  });

  return NextResponse.json({ ok: true });
}
