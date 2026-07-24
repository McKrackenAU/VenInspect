import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function createTaskType(formData: FormData) {
  "use server";
  await requireAdmin();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const label = String(formData.get("label") ?? "").trim() || code;
  if (!code) throw new Error("Code required");
  await prisma.defectTaskType.create({
    data: { code, label, sortOrder: 100 },
  });
  revalidatePath("/manage/task-types");
}

async function toggleTaskType(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  await prisma.defectTaskType.update({ where: { id }, data: { active } });
  revalidatePath("/manage/task-types");
}

export default async function TaskTypesPage() {
  await requireAdmin();
  const types = await prisma.defectTaskType.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Defect task types
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Allocate defects to RM, Investigate, Monitor, FMRP, or custom tasks.
        </p>
      </div>

      <form action={createTaskType} className="card flex flex-wrap gap-2 p-4">
        <input
          name="code"
          required
          placeholder="Code"
          className="field-input"
        />
        <input name="label" placeholder="Label" className="field-input" />
        <button type="submit" className="btn-primary text-sm">
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {types.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--ventia-border)] px-3 py-2"
          >
            <span className="text-sm font-medium">
              {t.label}{" "}
              <span className="font-mono text-xs text-[color:var(--ventia-muted)]">
                ({t.code})
              </span>
              {!t.active ? " — inactive" : ""}
            </span>
            <form action={toggleTaskType}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="active" value={t.active ? "0" : "1"} />
              <button type="submit" className="text-xs font-semibold text-[color:var(--ventia-blue)]">
                {t.active ? "Disable" : "Enable"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
