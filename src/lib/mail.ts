import nodemailer from "nodemailer";
import { readStorageSettings, type StorageSettings } from "@/lib/paths";
import {
  DEFAULT_EMAIL_FROM,
  DEFAULT_EMAIL_FROM_NAME,
  DEFAULT_PUBLIC_BASE_URL,
} from "@/lib/mail-constants";

export {
  DEFAULT_EMAIL_FROM,
  DEFAULT_EMAIL_FROM_NAME,
  DEFAULT_PUBLIC_BASE_URL,
} from "@/lib/mail-constants";

export type MailConfig = {
  enabled: boolean;
  from: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  publicBaseUrl: string;
};

function envTrim(key: string): string {
  return process.env[key]?.trim() || "";
}

/** Resolve mail settings: env overrides settings.json. */
export function getMailConfig(): MailConfig {
  const s = readStorageSettings();
  const host = envTrim("SMTP_HOST") || s.emailSmtpHost?.trim() || "";
  const portRaw = envTrim("SMTP_PORT") || String(s.emailSmtpPort ?? "");
  const port = Number(portRaw || (host ? "465" : "0"));
  const user = envTrim("SMTP_USER") || s.emailSmtpUser?.trim() || "";
  const pass = envTrim("SMTP_PASS") || s.emailSmtpPassword?.trim() || "";
  const from =
    envTrim("EMAIL_FROM") || s.emailFrom?.trim() || DEFAULT_EMAIL_FROM;
  const fromName =
    envTrim("EMAIL_FROM_NAME") ||
    s.emailFromName?.trim() ||
    DEFAULT_EMAIL_FROM_NAME;
  const publicBaseUrl = (
    envTrim("PUBLIC_BASE_URL") ||
    s.publicBaseUrl?.trim() ||
    s.cloudflareTunnelHostname?.trim() ||
    DEFAULT_PUBLIC_BASE_URL
  ).replace(/\/+$/, "");
  const publicUrl = publicBaseUrl.startsWith("http")
    ? publicBaseUrl
    : `https://${publicBaseUrl}`;

  const secureEnv = envTrim("SMTP_SECURE");
  const smtpSecure =
    secureEnv === "1" || secureEnv.toLowerCase() === "true"
      ? true
      : secureEnv === "0" || secureEnv.toLowerCase() === "false"
        ? false
        : s.emailSmtpSecure ?? (port === 465);

  const enabledFlag =
    envTrim("EMAIL_ENABLED") === "1" ||
    envTrim("EMAIL_ENABLED").toLowerCase() === "true" ||
    s.emailEnabled === true;

  const configured = Boolean(host && port > 0);
  return {
    enabled: enabledFlag && configured,
    from,
    fromName,
    smtpHost: host,
    smtpPort: Number.isFinite(port) ? port : 465,
    smtpSecure,
    smtpUser: user,
    smtpPassword: pass,
    publicBaseUrl: publicUrl,
  };
}

export function mailConfigStatus(cfg: MailConfig = getMailConfig()): {
  ready: boolean;
  reason: string;
} {
  if (!cfg.smtpHost) {
    return {
      ready: false,
      reason: "SMTP host not set (e.g. smtp.resend.com for Resend).",
    };
  }
  if (!cfg.enabled) {
    return {
      ready: false,
      reason: "Outbound email is disabled. Turn on “Enable outbound email”.",
    };
  }
  return { ready: true, reason: "Ready to send." };
}

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(
  input: SendMailInput,
  cfg: MailConfig = getMailConfig(),
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const status = mailConfigStatus(cfg);
  if (!status.ready) {
    return { ok: false, error: status.reason };
  }

  try {
    const transport = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth:
        cfg.smtpUser || cfg.smtpPassword
          ? { user: cfg.smtpUser, pass: cfg.smtpPassword }
          : undefined,
    });

    const info = await transport.sendMail({
      from: `"${cfg.fromName.replace(/"/g, "")}" <${cfg.from}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<pre style="font-family:sans-serif">${escapeHtml(input.text)}</pre>`,
    });

    return { ok: true, messageId: info.messageId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SMTP send failed",
    };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function publicAbsoluteUrl(path: string, cfg: MailConfig = getMailConfig()) {
  const base = cfg.publicBaseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export type MailSettingsPayload = {
  emailEnabled?: boolean;
  emailFrom?: string;
  emailFromName?: string;
  emailSmtpHost?: string;
  emailSmtpPort?: number;
  emailSmtpSecure?: boolean;
  emailSmtpUser?: string;
  emailSmtpPassword?: string;
  /** When true, leave existing password unchanged if blank */
  keepExistingPassword?: boolean;
  publicBaseUrl?: string;
};

export function applyMailSettingsUpdate(
  current: StorageSettings,
  body: MailSettingsPayload,
): Partial<StorageSettings> {
  const next: Partial<StorageSettings> = {
    emailEnabled: Boolean(body.emailEnabled),
    emailFrom: String(body.emailFrom ?? "").trim() || DEFAULT_EMAIL_FROM,
    emailFromName:
      String(body.emailFromName ?? "").trim() || DEFAULT_EMAIL_FROM_NAME,
    emailSmtpHost: String(body.emailSmtpHost ?? "").trim(),
    emailSmtpPort: Number(body.emailSmtpPort) || 465,
    emailSmtpSecure: Boolean(body.emailSmtpSecure),
    emailSmtpUser: String(body.emailSmtpUser ?? "").trim(),
    publicBaseUrl:
      String(body.publicBaseUrl ?? "").trim() || DEFAULT_PUBLIC_BASE_URL,
  };

  const pass = String(body.emailSmtpPassword ?? "");
  if (pass) {
    next.emailSmtpPassword = pass;
  } else if (!body.keepExistingPassword) {
    next.emailSmtpPassword = "";
  } else {
    next.emailSmtpPassword = current.emailSmtpPassword;
  }

  return next;
}
