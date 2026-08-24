import "server-only";
import { env, hasEmail } from "@/lib/env";

/*
  Resend, over plain fetch — the same choice this codebase already made
  for Gemini and Anthropic: one POST, no SDK to carry for it.

  NEVER THROWS, matching `notify()`. A failed send must not fail the
  action that triggered it — a meeting still needs to exist if Resend is
  down, and the in-app notification already landed regardless.
*/

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Resend deduplicates on this within a rolling window. Set to the
   * notification's own row id, so a retried action — or the mail step
   * running twice for any reason — cannot double-send the same email.
   */
  idempotencyKey: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  if (!hasEmail) return { ok: false, error: "Email is not configured on this deployment." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.resendKey}`,
        // Resend's own idempotency header — not a home-grown convention.
        "idempotency-key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      // The body carries Resend's actual reason — a bad sender, an
      // unverified domain, a malformed address — which the status code
      // alone never distinguishes.
      return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}
