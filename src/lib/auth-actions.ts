"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  authenticateLogin,
  clearSessionCookie,
  createSessionCookie,
  getCurrentUser,
  hashPassword,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/passwords";
import { validateNewPassword } from "@/lib/password-policy";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/password-reset";
import { isAdminRole, isRootUsername } from "@/lib/roles";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  const user = await authenticateLogin(login, password);
  if (!user) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  await createSessionCookie(user);

  // Root is a system account for the admin panel only.
  if (isRootUsername(user.username)) {
    redirect("/manage");
  }

  if (isAdminRole(user.role, user.username) && next.startsWith("/manage")) {
    redirect(next);
  }
  if (next.startsWith("/manage") && !isAdminRole(user.role, user.username)) {
    redirect("/");
  }
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string };

/** Logged-in user changes their own password (current password required). */
export async function changePasswordAction(
  formData: FormData,
): Promise<ChangePasswordResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sign in again to change your password." };
  }
  if (isRootUsername(user.username)) {
    return {
      ok: false,
      error:
        "The root system account password cannot be changed in the app. Update it on the server.",
    };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, error: "Fill in all password fields." };
  }

  const policyError = validateNewPassword(newPassword);
  if (policyError) return { ok: false, error: policyError };

  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New password and confirmation do not match." };
  }

  if (newPassword === currentPassword) {
    return {
      ok: false,
      error: "Choose a new password that is different from your current one.",
    };
  }

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row?.passwordHash || row.allowPasswordLogin === false) {
    return {
      ok: false,
      error: "Password login is not enabled for this account. Ask an admin.",
    };
  }
  if (isRootUsername(row.username)) {
    return {
      ok: false,
      error:
        "The root system account password cannot be changed in the app. Update it on the server.",
    };
  }

  if (!verifyPassword(currentPassword, row.passwordHash)) {
    return { ok: false, error: "Current password is incorrect." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return { ok: true };
}

export async function forgotPasswordAction(formData: FormData): Promise<{
  ok: true;
  message: string;
  devResetUrl?: string;
}> {
  const login = String(formData.get("login") ?? "");
  return requestPasswordReset(login);
}

export async function resetPasswordAction(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  return resetPasswordWithToken({
    token: String(formData.get("token") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
}
