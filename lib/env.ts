/*
  Environment access + feature detection.
  MIDO XI degrades gracefully: with no Supabase keys it runs in DEMO MODE
  (seed data, no persistence). The moment real keys are present, the same
  code paths switch to real auth + database.
*/

function clean(v: string | undefined): string {
  const t = (v ?? "").trim();
  // Treat obvious placeholders as unset.
  if (!t || t.startsWith("your-") || t === "changeme") return "";
  return t;
}

export const env = {
  appUrl: clean(process.env.NEXT_PUBLIC_APP_URL) || "http://localhost:3100",

  supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  // Server-only. Guard against accidental client import below.
  supabaseServiceKey: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),

  anthropicKey: clean(process.env.ANTHROPIC_API_KEY),
  // Claude does not read video. Native video reading is a separate provider,
  // and it is genuinely optional: without this key the film room keeps its
  // frame reader and says plainly what the other one would add.
  geminiKey: clean(process.env.GEMINI_API_KEY),

  /*
    WHOOP. Both are needed before the integration offers itself —
    `hasWhoop` below is what the Recovery page checks, so a half-configured
    deployment shows nothing rather than a Connect button that dead-ends on
    the provider's error page.
  */
  whoopClientId: clean(process.env.WHOOP_CLIENT_ID),
  whoopClientSecret: clean(process.env.WHOOP_CLIENT_SECRET),
  geminiVideoModel: clean(process.env.GEMINI_VIDEO_MODEL),
  youtubeKey: clean(process.env.YOUTUBE_API_KEY),
  // Global monthly Claude spend ceiling in USD. 0 / unset = no cap.
  aiMonthlyBudgetUsd: Number(clean(process.env.AI_MONTHLY_BUDGET_USD)) || 0,

  stripeSecret: clean(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: clean(process.env.STRIPE_WEBHOOK_SECRET),
  stripePublishable: clean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  // One Stripe price per plan. Named after the tier so a mis-mapped price is
  // obvious at a glance — swapping monthly and annual charges a year's use for
  // a month's money.
  stripePricePlayerMonthly: clean(process.env.STRIPE_PRICE_PLAYER_MONTHLY),
  stripePricePlayerAnnual: clean(process.env.STRIPE_PRICE_PLAYER_ANNUAL),
  stripePriceTouchlineMonthly: clean(process.env.STRIPE_PRICE_TOUCHLINE_MONTHLY),
  stripePriceTouchlineAnnual: clean(process.env.STRIPE_PRICE_TOUCHLINE_ANNUAL),
  stripePriceClubMonthly: clean(process.env.STRIPE_PRICE_CLUB_MONTHLY),
  stripePriceClubAnnual: clean(process.env.STRIPE_PRICE_CLUB_ANNUAL),

  /*
    Email. `resendKey` was scaffolded before anything used it — `from` is
    the half that was missing, and Resend refuses to send without a
    verified sender, so both are required before the product offers email
    at all. See `hasEmail` below.
  */
  resendKey: clean(process.env.RESEND_API_KEY),
  emailFrom: clean(process.env.EMAIL_FROM),

  adminEmails: clean(process.env.MIDO_ADMIN_EMAILS)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};

/** Real auth + database available? Both public Supabase vars must be set. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** True when running without a backend — seed data, no persistence. */
export const isDemoMode = !isSupabaseConfigured;

/*
  WHOOP needs a real backend to store tokens against a real account, so
  demo mode never offers it. Both halves of the credential are required:
  a Connect button that sends somebody to WHOOP and back to an error is
  worse than no button.
*/
export const hasWhoop =
  isSupabaseConfigured && Boolean(env.whoopClientId && env.whoopClientSecret);

/*
  Same shape as `hasWhoop`: a half-configured integration is worse than
  none. An API key with no verified sender fails on the first send, and a
  sender with no key never gets that far — either way the honest answer
  is "not available yet", not a toggle that quietly does nothing.
*/
export const hasEmail =
  isSupabaseConfigured && Boolean(env.resendKey && env.emailFrom);

export const features = {
  auth: isSupabaseConfigured,
  database: isSupabaseConfigured,
  ai: isSupabaseConfigured && Boolean(env.anthropicKey),
  nativeVideo: Boolean(env.geminiKey),
  youtube: Boolean(env.youtubeKey),
  billing: Boolean(env.stripeSecret && env.stripePublishable),
  email: hasEmail,
};

// ---------------------------------------------------------------------------
// Configuration that is dangerous rather than merely absent
// ---------------------------------------------------------------------------

/*
  Most missing config degrades honestly: no Anthropic key means the AI paths say
  so, no Stripe key means the membership page says billing is not configured.
  `NEXT_PUBLIC_APP_URL` is different. It has a working default, so nothing
  breaks, nothing warns — and five things quietly point at the wrong host:

    · every referral link a user copies and shares
    · the /join redirect those links land on
    · Stripe checkout success and cancel returns
    · the Stripe billing-portal return
    · the signup and OAuth email confirmation redirect

  A referral programme whose links point at localhost is not a degraded
  referral programme; it is a broken one, and the only symptom is that nobody
  ever converts. So it gets named here rather than discovered in production.
*/

export interface ConfigIssue {
  key: string;
  detail: string;
  breaks: string[];
}

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Misconfiguration worth shouting about. Empty in a correctly-configured deploy. */
export function configIssues(nodeEnv = process.env.NODE_ENV): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const inProduction = nodeEnv === "production";

  if (inProduction && LOCAL_HOST.test(env.appUrl)) {
    issues.push({
      key: "NEXT_PUBLIC_APP_URL",
      detail: `Set to "${env.appUrl}" in a production build. Nothing will error — it will simply send people to a machine that is not yours.`,
      breaks: [
        "Every referral link a user shares",
        "Stripe checkout and billing-portal returns",
        "Signup and OAuth email confirmation",
      ],
    });
  }

  if (inProduction && !env.appUrl.startsWith("https://")) {
    issues.push({
      key: "NEXT_PUBLIC_APP_URL",
      detail: "Not https in a production build. Supabase and Stripe will reject the redirect.",
      breaks: ["Email confirmation", "Stripe returns"],
    });
  }

  /*
    Stripe key shapes. A key of the wrong shape is rejected by Stripe with a
    401 at the moment someone clicks Subscribe — which surfaces as a broken
    page rather than as the configuration mistake it is. Checking the prefix
    costs nothing and names the problem where it can be fixed.

    Secret keys are sk_test_/sk_live_ (or rk_ for a restricted key).
    Publishable keys are pk_test_/pk_live_.
  */
  if (env.stripeSecret && !/^(sk|rk)_(test|live)_/.test(env.stripeSecret)) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      detail: `Starts with "${env.stripeSecret.slice(0, 3)}" — a Stripe secret key starts with sk_test_ or sk_live_. Stripe will reject this with a 401 the moment anyone tries to subscribe.`,
      breaks: ["Checkout", "The billing portal", "Every subscription"],
    });
  }

  if (env.stripePublishable && !/^pk_(test|live)_/.test(env.stripePublishable)) {
    issues.push({
      key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      detail: `Starts with "${env.stripePublishable.slice(0, 3)}" — a publishable key starts with pk_test_ or pk_live_.`,
      breaks: ["Checkout"],
    });
  }

  /*
    Mixing modes is worse than either mode alone: a live secret with test
    prices (or the reverse) fails at checkout with a confusing "no such price".
  */
  const secretMode = /_live_/.test(env.stripeSecret) ? "live" : /_test_/.test(env.stripeSecret) ? "test" : null;
  const pubMode = /_live_/.test(env.stripePublishable) ? "live" : /_test_/.test(env.stripePublishable) ? "test" : null;
  if (secretMode && pubMode && secretMode !== pubMode) {
    issues.push({
      key: "STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      detail: `One key is ${secretMode} mode and the other is ${pubMode}. They must match.`,
      breaks: ["Checkout"],
    });
  }

  /*
    Every plan needs a price id, and a missing one is invisible until someone
    clicks Subscribe and is told "that plan is not available yet" — which reads
    like a product decision rather than a missing variable. Named here instead.
  */
  if (features.billing) {
    const priceVars: [string, string][] = [
      ["STRIPE_PRICE_PLAYER_MONTHLY", env.stripePricePlayerMonthly],
      ["STRIPE_PRICE_PLAYER_ANNUAL", env.stripePricePlayerAnnual],
      ["STRIPE_PRICE_TOUCHLINE_MONTHLY", env.stripePriceTouchlineMonthly],
      ["STRIPE_PRICE_TOUCHLINE_ANNUAL", env.stripePriceTouchlineAnnual],
      ["STRIPE_PRICE_CLUB_MONTHLY", env.stripePriceClubMonthly],
      ["STRIPE_PRICE_CLUB_ANNUAL", env.stripePriceClubAnnual],
    ];

    const missing = priceVars.filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      issues.push({
        key: missing.join(", "),
        detail: `${missing.length} of 6 plan price IDs are not set, so those plans cannot be bought — checkout answers "that plan is not available yet".`,
        breaks: missing.map((k) => k.replace("STRIPE_PRICE_", "").replace("_", " ").toLowerCase()),
      });
    }

    const malformed = priceVars.filter(([, v]) => v && !v.startsWith("price_")).map(([k]) => k);
    if (malformed.length) {
      issues.push({
        key: malformed.join(", "),
        detail:
          "A Stripe price ID starts with price_. A product ID (prod_) or a payment-link URL will be rejected at checkout.",
        breaks: ["Checkout for those plans"],
      });
    }
  }

  if (features.billing && !env.stripeWebhookSecret) {
    issues.push({
      key: "STRIPE_WEBHOOK_SECRET",
      detail:
        "Stripe is live but the webhook secret is missing, so the webhook rejects every event. Subscriptions will not mirror, and no referral will ever convert.",
      breaks: ["Subscription status", "Referral conversion"],
    });
  }

  return issues;
}
