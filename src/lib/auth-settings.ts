import { readStorageSettings, writeStorageSettings } from "@/lib/paths";
import { getMicrosoftAuthConfig } from "@/lib/microsoft-auth";

export type LoginMethodSettings = {
  /** Show / accept username+password on the login page */
  allowPassword: boolean;
  /** Show Microsoft button / accept Entra callbacks */
  allowMicrosoft: boolean;
  /** Entra client id/secret/issuer present in environment */
  microsoftConfigured: boolean;
};

/** Effective site-wide login toggles (settings.json + env). */
export function getLoginMethodSettings(): LoginMethodSettings {
  const s = readStorageSettings();
  const microsoftConfigured = getMicrosoftAuthConfig() != null;
  return {
    allowPassword: s.authAllowPassword !== false,
    allowMicrosoft: s.authAllowMicrosoft !== false,
    microsoftConfigured,
  };
}

export function saveLoginMethodSettings(opts: {
  allowPassword: boolean;
  allowMicrosoft: boolean;
}) {
  if (!opts.allowPassword && !opts.allowMicrosoft) {
    throw new Error("Keep at least one login method enabled");
  }
  writeStorageSettings({
    authAllowPassword: opts.allowPassword,
    authAllowMicrosoft: opts.allowMicrosoft,
  });
}
