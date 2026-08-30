import { Share2 } from "lucide-react";
import { listMatches } from "@/lib/data/matches";
import { listTraining } from "@/lib/data/training";
import { listGoals } from "@/lib/data/development";
import { PublishStudio } from "@/components/publish/publish-studio";
import { PageHeader } from "@/components/ui/kit";
import type { PublishTemplate } from "@/lib/publish/types";

export const metadata = { title: "Publish — MIDO XI" };

/*
  MIDO PUBLISH — player progress, leaving the app looking professional.

  Availability is computed from the record so the studio can say
  "needs a logged match" instead of rendering an empty card. The
  render itself happens in /app/publish/image, owner-only; this page
  never assembles card data of its own.
*/
export default async function PublishPage() {
  const [matches, training, goals] = await Promise.all([
    listMatches(),
    listTraining(),
    listGoals(),
  ]);

  const available: Record<PublishTemplate, boolean> = {
    match: matches.length > 0,
    training: training.length > 0,
    development: goals.some((g) => g.status !== "achieved"),
    season: matches.length > 0,
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Share2}
        title="Publish"
        tagline="Your progress as a professional artifact — real numbers, MIDO's design, nothing private."
        photo="floodlights"
        kicker="Progress, presented properly"
      />
      <PublishStudio available={available} />
    </div>
  );
}
