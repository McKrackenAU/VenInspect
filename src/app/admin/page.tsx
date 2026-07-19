import { prisma } from "@/lib/db";
import { createUser, updateUserQualifications } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Management portal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create users, assign roles, and set Level 1 / Level 2 inspection qualifications.
          Auth login comes later — this is the data model + admin UI starter.
        </p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-medium text-white">Add user</h2>
        <form action={createUser} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Full name"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="email@example.com"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <select
            name="role"
            defaultValue="INSPECTOR"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="INSPECTOR">Inspector</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="level1Qualified" className="accent-teal-400" />
              Level 1 qualified
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="level2Qualified" className="accent-teal-400" />
              Level 2 qualified
            </label>
          </div>
          <button
            type="submit"
            className="sm:col-span-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Create user
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">Users & permissions</h2>
        <ul className="space-y-3">
          {users.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <p className="font-medium text-white">{u.name}</p>
              <p className="text-sm text-slate-400">{u.email}</p>
              <form action={updateUserQualifications} className="mt-3 flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={u.id} />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                >
                  <option value="INSPECTOR">Inspector</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <label className="flex items-center gap-1.5 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    name="level1Qualified"
                    defaultChecked={u.level1Qualified}
                    className="accent-teal-400"
                  />
                  L1
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    name="level2Qualified"
                    defaultChecked={u.level2Qualified}
                    className="accent-teal-400"
                  />
                  L2
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
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
