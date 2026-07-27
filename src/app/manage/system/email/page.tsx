import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { EmailConfigForm } from "@/components/EmailConfigForm";
import { getMailConfig, mailConfigStatus } from "@/lib/mail";
import { readStorageSettings } from "@/lib/paths";

export const dynamic = "force-dynamic";

export default async function ManageEmailPage() {
  await requireAdmin();
  const cfg = getMailConfig();
  const status = mailConfigStatus(cfg);
  const savedEnabled = Boolean(readStorageSettings().emailEnabled);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          <Link
            href="/manage/system"
            className="font-semibold text-[color:var(--ventia-green)] hover:underline"
          >
            ← System
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--ventia-green)]">
          Outbound email
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Send password-reset and notification mail as{" "}
          <span className="font-mono text-xs">noreply@inspect-it.online</span>{" "}
          through SMTP (Resend recommended with Cloudflare DNS).
        </p>
      </div>

      <EmailConfigForm
        initial={{
          enabled: savedEnabled,
          from: cfg.from,
          fromName: cfg.fromName,
          smtpHost: cfg.smtpHost,
          smtpPort: cfg.smtpPort,
          smtpSecure: cfg.smtpSecure,
          smtpUser: cfg.smtpUser,
          hasSmtpPassword: Boolean(cfg.smtpPassword),
          publicBaseUrl: cfg.publicBaseUrl,
          statusReason: status.reason,
          statusReady: status.ready,
        }}
      />
    </div>
  );
}
