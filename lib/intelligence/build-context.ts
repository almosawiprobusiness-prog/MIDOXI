import "server-only";
import { buildPlayerSignals } from "./build-signals";
import { selectPlayerContext, type PlayerContext } from "./context";
import { listMemory } from "@/lib/data/memory";
import { memoryPromptBlock } from "@/lib/data/memory-types";

/*
  The fetching half of the context selector, split from the pure
  selection for the same reason build-signals is split from signals:
  a module carrying `import "server-only"` is unreachable from a test.

  One pipeline: this reads the SAME signals the Next Best Action scorer
  reads, plus the memory block every engine already injects. There is
  deliberately no second query path for "AI context" — if the scorer
  cannot see it, a model is not told it.
*/

/**
 * Everything a model may be told about the signed-in player.
 * Never throws — an unreadable signal becomes an absent one.
 */
export async function buildPlayerContext(now: Date = new Date()): Promise<PlayerContext> {
  const [signals, memory] = await Promise.all([
    buildPlayerSignals(now),
    listMemory().catch(() => []),
  ]);
  return selectPlayerContext(signals, memoryPromptBlock(memory));
}
