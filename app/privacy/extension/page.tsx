import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

export const metadata = { title: "MIDO XI Capture — Privacy" };

/*
  The Chrome Web Store requires a privacy policy at a URL, and the
  extension's promises are narrower and stronger than the app's — local
  by default, silent by default — so it gets its own page rather than a
  paragraph inside the app policy. The text mirrors
  docs/extension/PRIVACY.md, which is the source of truth; a claim here
  must never outrun that file.
*/
export default function ExtensionPrivacyPage() {
  return (
    <LegalShell title="MIDO XI Capture — Privacy" updated="28 August 2026" active="privacy">
      <p className="text-text-dim">
        MIDO XI Capture is a browser extension that saves football moments you
        notice on YouTube — to your device for free, or to your own MIDO XI
        account if you connect one. It collects what that requires and nothing
        else.
      </p>

      <LegalSection heading="Free mode — no account">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Your captures are stored on your device only, in the browser&rsquo;s
            extension storage. MIDO XI does not receive them — not the note, not
            the video, not the fact that you captured. A local save makes zero
            network requests.
          </li>
          <li>
            The only network call in free mode is a status check asking whether
            this browser is signed in to MIDO XI, so the extension knows which
            mode to show. It carries no capture data. Signed out, everything
            still works.
          </li>
          <li>
            Your notes are yours: search them, edit them, export them all as
            Markdown or JSON at any time, delete them one by one or clear the
            library. No lock-in.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Connected mode — with a MIDO XI account">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Captures you save with &ldquo;Save to MIDO&rdquo;, and local moments
            you explicitly choose to import, are transmitted to your MIDO XI
            account. Nothing uploads automatically — importing is always a
            button you press, and your local copies remain on your device.
          </li>
          <li>
            Your active development goals are retrieved so a capture can be
            connected to one.
          </li>
          <li>Signing out never touches your local library.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="What the extension reads">
        <p>
          Only when you click it (or press its keyboard shortcut), and only from
          the tab you are on: the tab&rsquo;s URL — to know whether it is a
          YouTube video and which one — and the video&rsquo;s current playback
          time, title and channel, read once from the live page at that moment.
        </p>
        <p>
          It has no youtube.com permission and no content script. It cannot
          observe your browsing, your other tabs, your history, or any page you
          did not invoke it on.
        </p>
      </LegalSection>

      <LegalSection heading="What it stores on your device">
        <p>
          Your capture library, your current unsent draft (cleared on save,
          discarded after seven days), your environment setting, and small
          interface flags. No tokens, no passwords, no record of pages visited.
        </p>
      </LegalSection>

      <LegalSection heading="What it does not do">
        <ul className="ml-5 list-disc space-y-1">
          <li>No browsing history, unrelated tabs, page content, or keystroke telemetry</li>
          <li>No third-party analytics, tracking pixels, or ads</li>
          <li>
            No requests to any host except MIDO XI — fonts ship inside the
            extension; the video thumbnail is loaded from YouTube&rsquo;s image
            CDN for display only
          </li>
          <li>
            No audio storage — optional voice input uses the browser&rsquo;s
            speech-to-text and keeps only the resulting text
          </li>
          <li>
            No observation text in analytics, ever. Product analytics (recorded
            server-side, connected mode only) contain counts, categories and
            flags — never what you wrote. Free-mode usage is not tracked at all.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Ownership and deletion">
        <p>
          Local captures live and die on your device, on your command. Captures
          saved to MIDO XI are rows in your account — covered by the same
          row-level security as the rest of your football record, included in
          your account export, and deleted with your account. The full MIDO XI
          privacy policy applies to connected accounts.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
