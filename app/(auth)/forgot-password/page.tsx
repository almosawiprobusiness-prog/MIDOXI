import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Reset password — MIDO XI" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-xl font-semibold text-text-hi">Reset your password</h1>
        <p className="mt-1 text-sm text-text-dim">
          We&rsquo;ll email you a secure link to set a new one.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
