import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = String(params.token ?? "").trim();

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-1 py-8">
      <div className="absolute right-1 top-0">
        <ThemeToggle />
      </div>
      <div className="card rounded-2xl p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={56} priority />
          <h1 className="mt-3 text-xl font-bold tracking-tight text-[color:var(--ventia-green)]">
            Choose a new password
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            At least 8 characters
          </p>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
