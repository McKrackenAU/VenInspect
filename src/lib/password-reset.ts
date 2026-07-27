import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { validateNewPassword } from "@/lib/password-policy";
import {
  getMailConfig,
  mailConfigStatus,
  publicAbsoluteUrl,
  sendMail,
} from "@/lib/mail";
import { isRootUsername } from "@/lib/roles";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function newRawToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Start a password reset. Always returns a generic ok message (no user enumeration).
 * Sends email when the account exists and mail is configured.
 */
export async function requestPasswordReset(login: string): Promise<{
  ok: true;
  message: string;
  /** Present only in development when mail is not configured */
  devResetUrl?: string;
}> {
  const key = login.trim().toLowerCase();
  const generic = {
    ok: true as const,
    message:
      "If that account exists and email is configured, we sent a reset link. Check your inbox (and spam).",
  };

  if (!key) return generic;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: key }, { username: key }] },
  });
  // Root password cannot be reset through the platform.
  if (
    !user?.passwordHash ||
    user.allowPasswordLogin === false ||
    isRootUsername(user.username)
  ) {
    return generic;
  }
  if (!user.email || user.email.endsWith("@veninspect.local")) {
    return {
      ...generic,
      message:
        "If that account exists and has a real email address, we sent a reset link.",
    };
  }

  const raw = newRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const cfg = getMailConfig();
  const resetUrl = publicAbsoluteUrl(
    `/reset-password?token=${encodeURIComponent(raw)}`,
    cfg,
  );

  const status = mailConfigStatus(cfg);
  if (!status.ready) {
    if (process.env.NODE_ENV !== "production") {
      return { ...generic, devResetUrl: resetUrl };
    }
    return generic;
  }

  const text = [
    `Hi ${user.firstName || user.name},`,
    "",
    "We received a request to reset your VenInspect password.",
    "Open this link within 1 hour to choose a new password:",
    "",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "— VenInspect",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#2A2A2A">
      <p>Hi ${escape(user.firstName || user.name)},</p>
      <p>We received a request to reset your VenInspect password.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#004825;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
      <p style="font-size:13px;color:#5c6670">Or paste this link into your browser:<br/>${escape(resetUrl)}</p>
      <p style="font-size:13px;color:#5c6670">This link expires in 1 hour. If you did not request a reset, ignore this email.</p>
    </div>
  `;

  await sendMail({
    to: user.email,
    subject: "Reset your VenInspect password",
    text,
    html,
  });

  return generic;
}

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function resetPasswordWithToken(opts: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = opts.token.trim();
  if (!raw) return { ok: false, error: "Reset link is missing or invalid." };

  const policy = validateNewPassword(opts.newPassword);
  if (policy) return { ok: false, error: policy };
  if (opts.newPassword !== opts.confirmPassword) {
    return { ok: false, error: "New password and confirmation do not match." };
  }

  const tokenHash = hashToken(raw);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }
  if (row.user.allowPasswordLogin === false) {
    return { ok: false, error: "Password login is disabled for this account." };
  }
  if (isRootUsername(row.user.username)) {
    return {
      ok: false,
      error: "The root system account password cannot be reset here.",
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: hashPassword(opts.newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: row.userId,
        id: { not: row.id },
        usedAt: null,
      },
    }),
  ]);

  return { ok: true };
}
