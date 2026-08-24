import "server-only";

/*
  The one transactional email template. Every notification that emails
  at all uses this — one design to get right rather than one per kind.

  LIGHT, NOT DARK. MIDO XI is dark-first everywhere else in the product,
  and email is the deliberate exception. Mail clients handle
  `prefers-color-scheme` inconsistently — Outlook ignores it outright,
  some clients force a dark background without inverting text — so a
  dark template is a coin flip between looking right and being
  unreadable, and a transactional email that cannot be read is worse
  than a plain one. A clean light card with the signal-purple accent
  reads correctly everywhere, which is the property that actually
  matters here.

  EVERYTHING USER-SUPPLIED IS ESCAPED. `title` and `body` can carry a
  meeting title or a comment somebody else typed, and this is the one
  surface in the product that renders as HTML in a piece of software
  MIDO does not control — an unescaped `<img onerror=...>` in a comment
  becomes a real vector the moment it is emailed rather than just posted.
*/

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface NotificationEmailInput {
  title: string;
  body?: string | null;
  /** Absolute URL — the caller resolves `href` against `appUrl` before this runs. */
  actionUrl: string;
  appUrl: string;
}

export function renderNotificationEmail(input: NotificationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(input.title);
  const body = input.body ? escapeHtml(input.body) : null;
  const settingsUrl = `${input.appUrl}/app/settings#notifications`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5ea;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#18181b;">MIDO</span><span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#7c5cff;">&nbsp;XI</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <p style="margin:0;font-size:17px;line-height:1.4;font-weight:600;color:#18181b;">${title}</p>
                ${body ? `<p style="margin:10px 0 0 0;font-size:14px;line-height:1.6;color:#52525b;">${body}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px;">
                <a href="${input.actionUrl}" style="display:inline-block;background-color:#7c5cff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">Open in MIDO XI</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px 32px;border-top:1px solid #f0f0f2;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">
                  You're getting this because something happened on your MIDO XI account.
                  <a href="${settingsUrl}" style="color:#a1a1aa;">Manage email notifications</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    input.title,
    input.body ?? "",
    "",
    `Open in MIDO XI: ${input.actionUrl}`,
    "",
    `Manage email notifications: ${settingsUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: input.title, html, text };
}
