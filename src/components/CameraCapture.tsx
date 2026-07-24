"use client";

import { useEffect, useRef, useState } from "react";

const DEVICE_KEY = "veninspect.cameraDeviceId";

export type CameraDeviceOption = {
  deviceId: string;
  label: string;
};

function isSecureEnough() {
  if (typeof window === "undefined") return true;
  return (
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

export async function listVideoDevices(): Promise<CameraDeviceOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  // Permission prompt so labels populate
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    tmp.getTracks().forEach((t) => t.stop());
  } catch {
    /* labels may be empty */
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${i + 1}`,
    }));
}

export function CameraCapturePanel({
  open,
  onClose,
  onCapture,
  filePrefix = "capture",
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, previewUrl: string) => void;
  filePrefix?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setError(null);
      if (!isSecureEnough()) {
        setError(
          "Camera needs HTTPS (or localhost). On plain HTTP LAN, use Gallery upload, or open the app via a secure tunnel.",
        );
        return;
      }
      setStarting(true);
      try {
        const list = await listVideoDevices();
        if (cancelled) return;
        setDevices(list);
        const saved =
          typeof localStorage !== "undefined"
            ? localStorage.getItem(DEVICE_KEY) || ""
            : "";
        const preferred =
          list.find((d) => d.deviceId === saved)?.deviceId ||
          list.find((d) => /gopro|hero|webcam/i.test(d.label))?.deviceId ||
          list[0]?.deviceId ||
          "";
        setDeviceId(preferred);
      } catch {
        if (!cancelled) setError("Could not list cameras.");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !deviceId) return;
    let active: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        active = s;
        setStream(s);
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            void videoRef.current.play();
          }
        });
        try {
          localStorage.setItem(DEVICE_KEY, deviceId);
        } catch {
          /* ignore */
        }
      } catch {
        // Fallback without exact constraint (some browsers)
        try {
          const s = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { ideal: deviceId } } : true,
            audio: false,
          });
          if (cancelled) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          active = s;
          setStream(s);
          requestAnimationFrame(() => {
            if (videoRef.current) {
              videoRef.current.srcObject = s;
              void videoRef.current.play();
            }
          });
        } catch {
          if (!cancelled) {
            setError(
              "Could not open camera. Put GoPro in Webcam mode (USB), allow camera permission, or use Gallery.",
            );
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      active?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [open, deviceId]);

  function stopAndClose() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    onClose();
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `${filePrefix}-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file, URL.createObjectURL(blob));
        stopAndClose();
      },
      "image/jpeg",
      0.92,
    );
  }

  if (!open) return null;

  return (
    <div className="space-y-2 rounded-lg border border-[color:var(--ventia-border)] p-3">
      {devices.length > 0 ? (
        <label className="block text-xs font-semibold">
          Camera / GoPro
          <select
            className="field-input mt-1 w-full text-sm"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-xs text-[color:var(--ventia-muted)]">
          {starting
            ? "Looking for cameras…"
            : "No cameras listed yet. Connect a GoPro in Webcam (USB) mode and allow access."}
        </p>
      )}

      <video
        ref={videoRef}
        className="max-h-56 w-full rounded-lg bg-black object-contain"
        playsInline
        muted
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-xs" onClick={captureFrame}>
          Capture still
        </button>
        <button
          type="button"
          className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs"
          onClick={stopAndClose}
        >
          Close camera
        </button>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <p className="text-[10px] text-[color:var(--ventia-muted)]">
        Tip: GoPro must be in Webcam / UVC mode over USB. Wi‑Fi GoPro app pairing is
        not supported here.
      </p>
    </div>
  );
}

/** Hidden gallery file input (no capture= — opens photo library on phones). */
export function GalleryFileButton({
  onFile,
  disabled,
  multiple = false,
  label = "Gallery",
  className,
}: {
  onFile: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          if (list.length) onFile(list);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        className={
          className ??
          "rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)] disabled:opacity-50"
        }
        onClick={() => ref.current?.click()}
      >
        {label}
      </button>
    </>
  );
}

/** Phone camera via capture attribute (separate from gallery). */
export function PhoneCameraFileButton({
  onFile,
  disabled,
  label = "Phone camera",
  className,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        className={
          className ??
          "rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs disabled:opacity-50"
        }
        onClick={() => ref.current?.click()}
      >
        {label}
      </button>
    </>
  );
}
