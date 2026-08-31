import Image from "next/image";

/*
  The one avatar.

  A player's face — or their initials in the display voice when they have
  not set a photo, because a new account is the common case and a grey
  silhouette says "nobody", while initials say "not yet".

  This lived as a copy in the post card and another copy in the settings
  uploader before it was a primitive; anything that shows a person now
  imports it from here so the fallback stays one design, not several.
*/
export function Avatar({
  url,
  name,
  size = 34,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return url ? (
    <Image
      src={url}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-full border border-line object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full border border-line bg-ink-850 font-display font-bold text-text-faint"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}
