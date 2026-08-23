import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { getAuthProviders } from "@/lib/auth/providers";

export const metadata = { title: "Log in — MIDO XI" };

export default async function LoginPage() {
  const providers = await getAuthProviders();
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-xl font-semibold text-text-hi">Welcome back</h1>
        <p className="mt-1 text-sm text-text-dim">Log in to your football system.</p>
      </div>
      <Suspense fallback={<FormSkeleton />}>
        <AuthForm mode="login" googleEnabled={providers.google} />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-ink-850" />;
}
