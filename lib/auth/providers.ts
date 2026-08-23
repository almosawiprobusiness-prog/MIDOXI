import "server-only";
import { env, isSupabaseConfigured } from "@/lib/env";

/*
  Which sign-in methods this Supabase project actually has enabled.

  The auth form used to render "Continue with Google" unconditionally. Google is
  not enabled on this project, so the button was live in production and did
  nothing but produce `"Unsupported provider: provider is not enabled"` — a
  dead control on the first screen a new user sees, which is exactly the kind of
  thing this product is not supposed to ship.

  The fix reads the truth rather than trusting a flag: `/auth/v1/settings` is a
  public endpoint that reports the project's enabled providers. Enable Google in
  the Supabase dashboard and the button appears by itself; disable it and the
  button goes away. Nothing to remember, nothing to redeploy.

  Failure is treated as "email only". If this call fails we do not know what is
  enabled, and showing a button that might error is worse than showing one
  fewer way to sign in — email always works.
*/

export interface AuthProviders {
  email: boolean;
  google: boolean;
  /** False when the project could not be asked; the form degrades to email. */
  known: boolean;
}

const EMAIL_ONLY: AuthProviders = { email: true, google: false, known: false };

/** Settings change rarely; an hour of staleness is cheaper than a call per render. */
export const revalidate = 3600;

export async function getAuthProviders(): Promise<AuthProviders> {
  if (!isSupabaseConfigured) return EMAIL_ONLY;

  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.supabaseAnonKey },
      next: { revalidate },
    });
    if (!res.ok) return EMAIL_ONLY;

    const data = (await res.json()) as {
      external?: Record<string, boolean>;
      disable_signup?: boolean;
    };
    const external = data.external ?? {};
    return {
      email: external.email !== false,
      google: external.google === true,
      known: true,
    };
  } catch {
    return EMAIL_ONLY;
  }
}
