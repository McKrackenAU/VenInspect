"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateUserQualifications } from "@/lib/actions";

export function UserQualificationsForm({
  user,
}: {
  user: {
    id: string;
    role: string;
    level1Qualified: boolean;
    level2Qualified: boolean;
    registrationNumber: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(user.role);
  const [l1, setL1] = useState(user.level1Qualified);
  const [l2, setL2] = useState(user.level2Qualified);
  const [reg, setReg] = useState(user.registrationNumber ?? "");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        const fd = new FormData();
        fd.set("id", user.id);
        fd.set("role", role);
        if (l1) fd.set("level1Qualified", "on");
        if (l2) fd.set("level2Qualified", "on");
        fd.set("registrationNumber", reg);
        if (password) fd.set("password", password);
        startTransition(async () => {
          try {
            await updateUserQualifications(fd);
            setPassword("");
            setSaved(true);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <select
        name="role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded-md border border-[color:var(--ventia-border)] px-2 py-1.5 text-sm"
      >
        <option value="INSPECTOR">Inspector</option>
        <option value="ADMIN">Admin</option>
      </select>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={l1}
          onChange={(e) => setL1(e.target.checked)}
          className="accent-[color:var(--ventia-green)]"
        />
        L1
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={l2}
          onChange={(e) => setL2(e.target.checked)}
          className="accent-[color:var(--ventia-green)]"
        />
        L2
      </label>
      <input
        value={reg}
        onChange={(e) => setReg(e.target.value)}
        placeholder="Registration no."
        className="min-w-[8rem] rounded-md border border-[color:var(--ventia-border)] px-2 py-1.5 text-sm font-mono"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (optional)"
        className="min-w-[10rem] flex-1 rounded-md border border-[color:var(--ventia-border)] px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[color:var(--ventia-green-tint)] px-3 py-1.5 text-xs font-medium text-[color:var(--ventia-green)] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {saved ? (
        <span className="text-xs font-semibold text-[color:var(--ventia-green)]">
          Saved
        </span>
      ) : null}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </form>
  );
}
