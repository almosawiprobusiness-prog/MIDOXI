import { Brain } from "lucide-react";
import { listMemory, proposeMemories } from "@/lib/data/memory";
import { MEMORY_PROMPT_LIMIT } from "@/lib/data/memory-types";
import { PageHeader } from "@/components/ui/kit";
import { MemoryBoard } from "@/components/locker/memory-board";
import { DemoNote } from "@/components/dashboards/shared";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "What MIDO remembers — MIDO XI" };

/*
  The page that makes the memory arguable.

  MIDO's memory is injected into every AI prompt it runs for this player, which
  makes it the most consequential data in the product — a wrong fact here does
  not produce one wrong answer, it shapes every answer from now on. So it is
  shown in full, in plain sentences, and every line can be edited or deleted.

  It is deliberately not a "profile" or an "insights" page. It is a list of
  things MIDO believes, and the player is the one who decides what is on it.
*/

export default async function MemoryPage() {
  const [memories, proposals] = await Promise.all([listMemory(), proposeMemories()]);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Brain}
        title="What MIDO remembers"
        tagline="Everything it knows about you, in your words — and yours to change."
      />

      {isDemoMode && (
        <div className="mb-6">
          <DemoNote>
            Two seeded memories. In the real product these are yours, and MIDO reads them before it
            answers anything.
          </DemoNote>
        </div>
      )}

      <div className="mb-6 min-w-0 panel p-4">
        <p className="text-sm leading-relaxed text-text-dim">
          MIDO reads this before it writes a study, reads your film, or answers a question. That is
          the whole point of it — and it is why nothing lands here without you agreeing to it, and
          why every line has a bin next to it.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-text-faint">
          {memories.length === 0
            ? "Nothing remembered yet. Add something, or accept one of the suggestions below."
            : `${memories.length} remembered. Up to ${MEMORY_PROMPT_LIMIT} of each kind are held in mind at once — beyond that, a prompt full of facts produces answers that mention all of them and act on none.`}
        </p>
      </div>

      <MemoryBoard memories={memories} proposals={proposals} />
    </div>
  );
}
