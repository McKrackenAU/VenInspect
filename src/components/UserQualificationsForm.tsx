"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateUserQualifications } from "@/lib/actions";

export function UserQualificationsForm({
  user,
}: {
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    username: string | null;
    role: string;
    level1Qualified: boolean;
    level2Qualified: boolean;
    registrationNumber: string | null;
    allowPasswordLogin?: boolean;
    allowMicrosoftLogin?: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const split = (() => {
    if (user.firstName || user.lastName) {
      return {
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
      };
    }
    const parts = user.name.trim().split(/\s+/);
    return {
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
    };
  })();

  const [firstName, setFirstName] = useState(split.firstName);
  const [lastName, setLastName] = useState(split.lastName);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username ?? "");
  const [role, setRole] = useState(user.role);
  const [l1, setL1] = useState(user.level1Qualified);
  const [l2, setL2] = useState(user.level2Qualified);
  const [reg, setReg] = useState(user.registrationNumber ?? "");
  const [allowPassword, setAllowPassword] = useState(
    user.allowPasswordLogin !== false,
  );
  const [allowMicrosoft, setAllowMicrosoft] = useState(
    user.allowMicrosoftLogin !== false,
  );
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parts =
      user.firstName || user.lastName
        ? { firstName: user.firstName ?? "", lastName: user.lastName ?? "" }
        : (() => {
            const p = user.name.trim().split(/\s+/);
            return { firstName: p[0] ?? "", lastName: p.slice(1).join(" ") };
          })();
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
    setEmail(user.email);
    setUsername(user.username ?? "");
    setRole(user.role);
    setL1(user.level1Qualified);
    setL2(user.level2Qualified);
    setReg(user.registrationNumber ?? "");
    setAllowPassword(user.allowPasswordLogin !== false);
    setAllowMicrosoft(user.allowMicrosoftLogin !== false);
  }, [user.id]);

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        if (!firstName.trim() || !lastName.trim()) {
          setError("First and last name are required");
          return;
        }
        if (!allowPassword && !allowMicrosoft) {
          setError("Enable at least one login method");
          return;
        }
        const fd = new FormData();
        fd.set("id", user.id);
        fd.set("firstName", firstName.trim());
        fd.set("lastName", lastName.trim());
        fd.set("email", email.trim());
        fd.set("username", username.trim());
        fd.set("role", role);
        if (l1) fd.set("level1Qualified", "on");
        if (l2) fd.set("level2Qualified", "on");
        if (allowPassword) fd.set("allowPasswordLogin", "on");
        if (allowMicrosoft) fd.set("allowMicrosoftLogin", "on");
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
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs font-semibold">
          First name
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="field-input mt-1 w-full text-sm"
          />
        </label>
        <label className="block text-xs font-semibold">
          Last name
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="field-input mt-1 w-full text-sm"
          />
        </label>
        <label className="block text-xs font-semibold">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="field-input mt-1 w-full text-sm"
          />
        </label>
        <label className="block text-xs font-semibold">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Optional login name"
            className="field-input mt-1 w-full text-sm font-mono"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
          Login methods
        </span>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={allowPassword}
            onChange={(e) => setAllowPassword(e.target.checked)}
            className="accent-[color:var(--ventia-green)]"
          />
          Password
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={allowMicrosoft}
            onChange={(e) => setAllowMicrosoft(e.target.checked)}
            className="accent-[color:var(--ventia-green)]"
          />
          Microsoft
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="field-input w-auto min-w-[8rem] py-1.5 text-sm"
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
          className="rounded-md bg-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved ? (
          <span className="text-xs font-semibold text-[color:var(--ventia-green)]">
            Saved
          </span>
        ) : null}
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>
    </form>
  );
}
