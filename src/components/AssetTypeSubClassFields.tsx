"use client";

import { useMemo, useState } from "react";
import type { AssetSubClassOption } from "@/lib/asset-subclasses";
import type { AssetTypeOption } from "@/lib/asset-types";

/**
 * Type + subclass selects that keep subclass options in sync with the chosen type.
 */
export function AssetTypeSubClassFields({
  assetTypes,
  subClasses,
  defaultType,
  defaultSubClass,
}: {
  assetTypes: AssetTypeOption[];
  subClasses: AssetSubClassOption[];
  defaultType?: string;
  defaultSubClass?: string | null;
}) {
  const initialType =
    defaultType || assetTypes[0]?.value || "BRIDGE";
  const [type, setType] = useState(initialType);

  const options = useMemo(() => {
    const current = (defaultSubClass ?? "").trim().toUpperCase();
    return subClasses.filter((o) => {
      if (current && o.value === current) return true;
      if (!o.forTypes || o.forTypes.length === 0) return true;
      return o.forTypes.includes(type);
    });
  }, [subClasses, type, defaultSubClass]);

  return (
    <>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-[color:var(--ventia-muted)]">Type</span>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="field-input w-full"
        >
          {assetTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-[color:var(--ventia-muted)]">
          Sub classification
        </span>
        <select
          name="subClassification"
          defaultValue={defaultSubClass ?? ""}
          key={`${type}:${defaultSubClass ?? ""}`}
          className="field-input w-full"
        >
          <option value="">— None —</option>
          {options.map((sc) => (
            <option key={sc.value} value={sc.value}>
              {sc.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
