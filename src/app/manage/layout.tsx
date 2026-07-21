import { requireAdmin } from "@/lib/auth";

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}
