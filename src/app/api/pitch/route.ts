import { type NextRequest, NextResponse } from "next/server";
import { badRequest } from "@/lib/api";
import { isBot, isEmail, submitToInbox } from "@/lib/inbox";

const MEDIA_TYPES = ["book", "movie", "tv_show", "podcast", "music", "other"];

// Public "pitch your media" form. No auth.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid request");
  if (isBot(body)) return NextResponse.json({ ok: true });

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const title = String(body.title ?? "").trim();
  const mediaType = MEDIA_TYPES.includes(body.media_type) ? body.media_type : "other";
  const pitch = String(body.pitch ?? "").trim();
  if (!name) return badRequest("name is required");
  if (!isEmail(email)) return badRequest("a valid email is required");
  if (!title) return badRequest("title is required");
  if (!pitch) return badRequest("a short pitch is required");

  const result = await submitToInbox("pitch-media", {
    name,
    email,
    payload: { media_type: mediaType, title, link: String(body.link ?? "").trim() || null, pitch },
  });
  if (!result.ok) return NextResponse.json({ error: "Could not send — please try again" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
