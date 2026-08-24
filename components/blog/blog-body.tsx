import type { BlogBlock } from "@/lib/blog/posts";

/** Renders the typed block list a post is written as. One small component instead of one per post. */
export function BlogBody({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} className="pt-2 font-display text-xl font-bold tracking-tight text-text-hi">
                {b.text}
              </h2>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-signal-line pl-4 font-display text-lg leading-snug text-text-hi"
              >
                {b.text}
              </blockquote>
            );
          case "list":
            return (
              <ul key={i} className="list-disc space-y-2 pl-5 marker:text-signal">
                {b.items.map((item, j) => (
                  <li key={j} className="text-[15px] leading-relaxed text-text">
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "p":
          default:
            return (
              <p key={i} className="text-[15px] leading-relaxed text-text">
                {b.text}
              </p>
            );
        }
      })}
    </div>
  );
}
