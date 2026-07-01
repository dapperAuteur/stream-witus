import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_ROLES } from "@/db/schema/auth";
import { isOwnerEmail } from "@/lib/access";
import { getUserRow, listUsers, logAdminAction, setUserDeactivated, setUserRole } from "@/lib/admin-data";
import { badRequest, notFound } from "@/lib/api";
import { canManageUsers, requireAdmin } from "@/lib/session";

// Owner-only (managing roles/deactivation). Never allow acting on the owner, and
// never allow granting 'owner' or 'none'-invalid roles.
export async function GET() {
  if (!(await requireAdmin(canManageUsers))) return notFound();
  const users = await listUsers();
  return NextResponse.json({ users: users.map((u) => ({ ...u, isOwner: isOwnerEmail(u.email) })) });
}

export async function PATCH(request: NextRequest) {
  const owner = await requireAdmin(canManageUsers);
  if (!owner) return notFound();
  const body = await request.json();
  const id = String(body?.id ?? "");
  if (!id) return badRequest("id is required");

  const target = await getUserRow(id);
  if (!target) return notFound();
  if (isOwnerEmail(target.email)) return badRequest("The owner cannot be modified");

  if (typeof body.deactivated === "boolean") {
    await setUserDeactivated(id, body.deactivated);
    await logAdminAction(owner, body.deactivated ? "user.deactivate" : "user.reactivate", { targetType: "user", targetId: target.email });
    return NextResponse.json({ ok: true });
  }
  if (body.role !== undefined) {
    if (!(ADMIN_ROLES as readonly string[]).includes(body.role)) return badRequest("invalid role");
    await setUserRole(id, body.role);
    await logAdminAction(owner, "user.role", { targetType: "user", targetId: target.email, meta: { role: body.role } });
    return NextResponse.json({ ok: true });
  }
  return badRequest("role or deactivated is required");
}
