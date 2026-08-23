import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Set a new password — MIDO XI" };

export default function ResetPasswordPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-xl font-semibold text-text-hi">Set a new password</h1>
        <p className="mt-1 text-sm text-text-dim">Choose a strong password for your account.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
