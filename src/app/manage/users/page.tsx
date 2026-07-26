import { prisma } from "@/lib/db";
import { createUser } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { UserQualificationsForm } from "@/components/UserQualificationsForm";

export const dynamic = "force-dynamic";

export default async function ManageUsersPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Users & qualifications
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Create logins for field and office staff. Default admin is{" "}
          <code className="font-mono text-xs">root</code> /{" "}
          <code className="font-mono text-xs">calvin</code>. Microsoft Entra
          sign-in matches users by work email (set env vars in{" "}
          <code className="font-mono text-xs">/etc/veninspect.env</code>
          ).
        </p>
      </div>

      <section className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm">
        <h2 className="text-lg font-medium">Add user</h2>
        <form action={createUser} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="firstName"
            required
            placeholder="First name"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="lastName"
            required
            placeholder="Last name"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="work.email@ventia.com"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="username"
            placeholder="Username (optional)"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="registrationNumber"
            placeholder="Inspector registration no. (optional)"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <select
            name="role"
            defaultValue="INSPECTOR"
            className="field-input"
          >
            <option value="INSPECTOR">Inspector</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="level1Qualified" className="accent-[color:var(--ventia-green)]" />
              Level 1 qualified
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="level2Qualified" className="accent-[color:var(--ventia-green)]" />
              Level 2 qualified
            </label>
          </div>
          <button
            type="submit"
            className="sm:col-span-2 rounded-md bg-[color:var(--ventia-green)] px-4 py-2 text-sm font-semibold text-white"
          >
            Create user
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Directory</h2>
        <ul className="space-y-3">
          {users.map((u) => {
            const showUsername =
              Boolean(u.username) &&
              u.username!.toLowerCase() !== u.email.toLowerCase();
            return (
            <li
              key={u.id}
              className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4 shadow-sm"
            >
              <p className="font-medium">{u.name}</p>
              <p className="text-sm text-[color:var(--ventia-muted)]">
                {showUsername ? (
                  <>
                    <span className="font-mono">{u.username}</span>
                    {" · "}
                  </>
                ) : null}
                {u.email}
                {u.registrationNumber ? (
                  <>
                    {" · "}
                    <span className="font-mono">Reg. {u.registrationNumber}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
                Role: {u.role}
                {u.level1Qualified ? " · L1" : ""}
                {u.level2Qualified ? " · L2" : ""}
              </p>
              <p className="mt-1">
                <Link
                  href={`/manage/users/${u.id}`}
                  className="text-xs font-semibold text-[color:var(--ventia-blue)] hover:underline"
                >
                  View inspection history →
                </Link>
              </p>
              <UserQualificationsForm user={u} />
            </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
