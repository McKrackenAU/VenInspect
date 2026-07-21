import { prisma } from "@/lib/db";
import { createUser, updateUserQualifications } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";

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
          <code className="font-mono text-xs">calvin</code>. Microsoft Entra ID
          can replace passwords later.
        </p>
      </div>

      <section className="rounded-xl border border-[color:var(--ventia-border)] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-medium">Add user</h2>
        <form action={createUser} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Full name"
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
            name="password"
            type="password"
            required
            placeholder="Password"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <select
            name="role"
            defaultValue="INSPECTOR"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          >
            <option value="INSPECTOR">Inspector</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div className="flex flex-wrap items-center gap-4 text-sm">
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
          {users.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-[color:var(--ventia-border)] bg-white p-4 shadow-sm"
            >
              <p className="font-medium">{u.name}</p>
              <p className="text-sm text-[color:var(--ventia-muted)]">
                {u.username ? (
                  <>
                    <span className="font-mono">{u.username}</span>
                    {" · "}
                  </>
                ) : null}
                {u.email}
              </p>
              <form
                action={updateUserQualifications}
                className="mt-3 flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="id" value={u.id} />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="rounded-md border border-[color:var(--ventia-border)] px-2 py-1.5 text-sm"
                >
                  <option value="INSPECTOR">Inspector</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="level1Qualified"
                    defaultChecked={u.level1Qualified}
                    className="accent-[color:var(--ventia-green)]"
                  />
                  L1
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="level2Qualified"
                    defaultChecked={u.level2Qualified}
                    className="accent-[color:var(--ventia-green)]"
                  />
                  L2
                </label>
                <input
                  name="password"
                  type="password"
                  placeholder="New password (optional)"
                  className="min-w-[10rem] flex-1 rounded-md border border-[color:var(--ventia-border)] px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-[color:var(--ventia-green-tint)] px-3 py-1.5 text-xs font-medium text-[color:var(--ventia-green)]"
                >
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
