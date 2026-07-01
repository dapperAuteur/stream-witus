import { type NextRequest, NextResponse } from "next/server";
import { isAllowedToSignIn } from "@/lib/access";
import { badRequest } from "@/lib/api";
import { isEmail } from "@/lib/inbox";

// Public: does this email get a magic link, or the waitlist? The sign-in page
// calls this before deciding whether to request a link or offer to join.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  if (!isEmail(email)) return badRequest("a valid email is required");
  return NextResponse.json({ allowed: await isAllowedToSignIn(email) });
}
