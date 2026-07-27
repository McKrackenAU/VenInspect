import type { AuthUser } from "@/lib/auth";
import {
  runClientExportJob,
  type ClientExportOpts,
} from "@/lib/client-export-assemble";

/**
 * Start ZIP build without relying on setImmediate (unreliable after the
 * HTTP response finishes in some Next.js deployments).
 * Returns the in-flight promise so callers can optionally wait a beat.
 */
export function startClientExportBuild(
  jobId: string,
  user: AuthUser,
  inspectionId: string,
  opts: ClientExportOpts,
): Promise<void> {
  // Floating promise on the long-lived Node process — do not use setImmediate.
  const running = runClientExportJob(jobId, user, inspectionId, opts);
  // Prevent unhandled rejection
  void running.catch(() => {});
  return running;
}
