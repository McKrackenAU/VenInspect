import { prisma } from "@/lib/db";
import { createUser } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { isRootUsername } from "@/lib/roles";
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
          Create logins for field and office staff. The{" "}
          <code className="font-mono text-xs">root</code> account is a locked
          system admin for the Manage portal only — it cannot be assigned work
          and its password is not changeable in the app.
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
            minLength={8}
            placeholder="Password (min 8 characters)"
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
            const root = isRootUsername(u.username);
            const showUsername =
              Boolean(u.username) &&
              u.username!.toLowerCase() !== u.email.toLowerCase();
            return (
            <li
              key={u.id}
              className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4 shadow-sm"
            >
              <p className="font-medium">
                {u.name}
                {root ? (
                  <span className="ml-2 text-xs font-semibold text-[color:var(--ventia-muted)]">
                    System account
                  </span>
                ) : null}
              </p>
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
                {root ? " · Admin panel only · not assignable" : ""}
              </p>
              {!root ? (
                <>
                  <p className="mt-1">
                    <Link
                      href={`/manage/users/${u.id}`}
                      className="text-xs font-semibold text-[color:var(--ventia-blue)] hover:underline"
                    >
                      View inspection history →
                    </Link>
                  </p>
                  <UserQualificationsForm user={u} />
                </>
              ) : (
                <p className="mt-2 text-xs text-[color:var(--ventia-muted)]">
                  Password and role are locked. Change the password only via
                  server tooling if needed.
                </p>
              )}
            </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
