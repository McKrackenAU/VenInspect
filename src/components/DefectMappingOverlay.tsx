"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { photoPublicUrl } from "@/lib/photo-url";

type Pin = { defectId: string; x: number; y: number; label?: string };

export function DefectMappingOverlay({
  inspectionId,
  overlay,
  defects,
  editable,
}: {
  inspectionId: string;
  overlay: {
    id: string;
    imagePath: string;
    pinsJson: string;
    label: string | null;
  } | null;
  defects: { id: string; defectCode: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const imgRef = useRef<HTMLImageElement>(null);
  const [pins, setPins] = useState<Pin[]>(() => {
    try {
      return JSON.parse(overlay?.pinsJson || "[]") as Pin[];
    } catch {
      return [];
    }
  });
  const [defectId, setDefectId] = useState(defects[0]?.id ?? "");
  const [pending, setPending] = useState(false);

  async function save(next: Pin[], imagePath?: string) {
    setPending(true);
    try {
      await fetch(`/api/inspections/${inspectionId}/mapping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overlayId: overlay?.id,
          pins: next,
          imagePath: imagePath ?? overlay?.imagePath,
        }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!overlay?.imagePath) {
    return (
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Upload a sketch/elevation under form photos, then create a mapping overlay from
        Manage (API: PUT /mapping with imagePath).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative inline-block max-w-full overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={photoPublicUrl(overlay.imagePath)}
          alt={overlay.label || "Defect map"}
          className="max-h-[28rem] max-w-full"
          onClick={(e) => {
            if (!editable || !defectId || !imgRef.current) return;
            const rect = imgRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const d = defects.find((x) => x.id === defectId);
            const next = [
              ...pins.filter((p) => p.defectId !== defectId),
              { defectId, x, y, label: d?.defectCode },
            ];
            setPins(next);
            void save(next);
          }}
        />
        {pins.map((p) => (
          <span
            key={p.defectId}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          >
            {p.label || "•"}
          </span>
        ))}
      </div>
      {editable ? (
        <div className="flex flex-wrap gap-2">
          <select
            className="field-input text-sm"
            value={defectId}
            onChange={(e) => setDefectId(e.target.value)}
          >
            {defects.map((d) => (
              <option key={d.id} value={d.id}>
                {d.defectCode}
              </option>
            ))}
          </select>
          <span className="text-xs text-[color:var(--ventia-muted)]">
            Select defect, then click the image to place a pin.
            {pending ? " Saving…" : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
