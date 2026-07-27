import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/request-auth";
import {
  applyMailSettingsUpdate,
  getMailConfig,
  mailConfigStatus,
  sendMail,
} from "@/lib/mail";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminFromRequest(req);
  if (auth.error) return auth.error;
  const cfg = getMailConfig();
  const status = mailConfigStatus(cfg);
  return NextResponse.json({
    config: {
      ...cfg,
      // Never echo the password back
      smtpPassword: cfg.smtpPassword ? "••••••••" : "",
      hasSmtpPassword: Boolean(cfg.smtpPassword),
    },
    status,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminFromRequest(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = readStorageSettings();
  const patch = applyMailSettingsUpdate(current, {
    emailEnabled: Boolean(body.emailEnabled),
    emailFrom: String(body.emailFrom ?? ""),
    emailFromName: String(body.emailFromName ?? ""),
    emailSmtpHost: String(body.emailSmtpHost ?? ""),
    emailSmtpPort: Number(body.emailSmtpPort),
    emailSmtpSecure: Boolean(body.emailSmtpSecure),
    emailSmtpUser: String(body.emailSmtpUser ?? ""),
    emailSmtpPassword: String(body.emailSmtpPassword ?? ""),
    keepExistingPassword: Boolean(body.keepExistingPassword),
    publicBaseUrl: String(body.publicBaseUrl ?? ""),
  });
  writeStorageSettings(patch);

  const cfg = getMailConfig();
  return NextResponse.json({
    ok: true,
    status: mailConfigStatus(cfg),
  });
}

/** Send a test message to the signed-in admin's email. */
export async function POST(req: NextRequest) {
  const auth = await requireAdminFromRequest(req);
  if (auth.error) return auth.error;

  let to = auth.user.email;
  try {
    const body = (await req.json()) as { to?: string };
    if (body.to?.trim()) to = body.to.trim();
  } catch {
    /* use admin email */
  }

  const result = await sendMail({
    to,
    subject: "VenInspect test email",
    text: [
      "This is a test message from VenInspect.",
      "",
      `Sent to: ${to}`,
      `From config: ${getMailConfig().from}`,
      "",
      "If you received this, outbound email is working.",
    ].join("\n"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId, to });
}
