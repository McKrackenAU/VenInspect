"use server";

import { redirect } from "next/navigation";
import {
  authenticateLogin,
  clearSessionCookie,
  createSessionCookie,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  const { getLoginMethodSettings } = await import("@/lib/auth-settings");
  if (!getLoginMethodSettings().allowPassword) {
    redirect(`/login?error=password_disabled&next=${encodeURIComponent(next)}`);
  }

  const user = await authenticateLogin(login, password);
  if (!user) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  await createSessionCookie(user);

  if (user.role === "ADMIN" && next.startsWith("/manage")) {
    redirect(next);
  }
  if (next.startsWith("/manage") && user.role !== "ADMIN") {
    redirect("/");
  }
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
