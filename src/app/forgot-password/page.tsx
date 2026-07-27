import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const session = await getSession();
  if (session) redirect("/account");

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-1 py-8">
      <div className="absolute right-1 top-0">
        <ThemeToggle />
      </div>
      <div className="card rounded-2xl p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={56} priority />
          <h1 className="mt-3 text-xl font-bold tracking-tight text-[color:var(--ventia-green)]">
            Reset password
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            We&apos;ll email a link to set a new password
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
