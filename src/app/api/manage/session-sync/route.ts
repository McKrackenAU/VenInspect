import { NextResponse } from "next/server";
import {
  createSessionCookie,
  getCurrentUser,
  getSession,
} from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refresh the session cookie from the live DB role.
 * Fixes permission mismatches after promoting a user to Admin without re-login.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const session = await getSession();
  const role = isAdminRole(user.role, user.username) ? "ADMIN" : user.role;

  await createSessionCookie({
    id: user.id,
    role,
    name: user.name,
    username: user.username,
  });

  return NextResponse.json({
    ok: true,
    role,
    healed: Boolean(session && session.role !== role),
    previousRole: session?.role ?? null,
  });
}
