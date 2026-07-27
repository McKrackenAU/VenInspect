import type { AuthUser } from "@/lib/auth";
import {
  runClientExportJob,
  type ClientExportOpts,
} from "@/lib/client-export-assemble";

/**
 * Kick off ZIP build without holding the HTTP response open (Cloudflare timeout).
 * Safe on the long-lived Node/LXC process.
 */
export function startClientExportBuild(
  jobId: string,
  user: AuthUser,
  inspectionId: string,
  opts: ClientExportOpts,
) {
  setImmediate(() => {
    void runClientExportJob(jobId, user, inspectionId, opts);
  });
}
