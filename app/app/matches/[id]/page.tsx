import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, MapPin, Shirt, Clapperboard, ChevronRight } from "lucide-react";
import { getMatchDetail } from "@/lib/data/matches";
import { listClips } from "@/lib/data/film";
import { getProfileSettings } from "@/lib/data/profile";
import { fmtTime } from "@/lib/data/film-types";
import { MatchFormDialog } from "@/components/matches/match-form-dialog";
import { DeleteMatchButton } from "@/components/matches/delete-match-button";
import { StatsForm } from "@/components/matches/stats-form";
import { ReviewForm } from "@/components/matches/review-form";
import { SectionHeader, sentimentStyle } from "@/components/ui/primitives";

/*
  Named after the fixture. This page had no title at all — a tab reading
  "MIDO XI — Football Performance OS", which is what every tab said
  before the rest of the app started naming itself.
*/
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMatchDetail(id);
  if (!detail) return { title: "Match — MIDO XI" };
  const { match } = detail;
  return { title: `${match.opponent} ${match.goalsFor}–${match.goalsAgainst} — Matches` };
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, allClips, profile] = await Promise.all([
    getMatchDetail(id),
    listClips(),
    getProfileSettings(),
  ]);
  if (!detail) notFound();

  const { match, stats, review } = detail;
  const win = match.goalsFor > match.goalsAgainst;
  const draw = match.goalsFor === match.goalsAgainst;
  const resultLabel = win ? "Win" : draw ? "Draw" : "Loss";
  const resultColor = win ? "var(--positive)" : draw ? "var(--review)" : "var(--correction)";
  const clips = allClips.filter((c) => c.matchId === match.id);

  /*
    Whose club this is comes from the user's own profile, not from a seed
    constant — a real account with no club recorded should not be told it plays
    for a fictional one.
  */
  const ownClub = profile.club || "Your team";
  const homeName = match.home ? ownClub : match.opponent;
  const awayName = match.home ? match.opponent : ownClub;
  const homeScore = match.home ? match.goalsFor : match.goalsAgainst;
  const awayScore = match.home ? match.goalsAgainst : match.goalsFor;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <Link href="/app/matches" className="mb-5 inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-text-hi">
        <ArrowLeft className="size-4" /> Match Center
      </Link>

      {/* Scoreboard */}
      <div className="panel-raised relative overflow-hidden p-5">
        <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="field-glow absolute inset-0" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="label-tech">{match.competition || "Match"}</div>
            <div className="flex items-center gap-2">
              <MatchFormDialog mode="edit" match={match} />
              <DeleteMatchButton id={match.id} opponent={match.opponent} />
            </div>
          </div>

          {/*
            The page's heading, carried for screen readers only.

            This page had no <h1> at all — the fixture is spelled out
            across three separate boxes of a scoreboard grid, which reads
            perfectly to an eye and as nothing to a reader moving by
            heading. Promoting one of those boxes would either make the
            heading half the fixture or force the layout to bend around
            it, so the whole fixture is stated once, invisibly, and the
            scoreboard is left exactly as designed.
          */}
          <h1 className="sr-only">
            {homeName} {homeScore}–{awayScore} {awayName}, {resultLabel}
          </h1>

          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="text-right">
              <div className="font-display text-lg font-semibold text-text-hi md:text-xl">{homeName}</div>
              <div className="label-tech mt-0.5">{match.home ? "Home" : "Away"}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3 font-display text-4xl font-bold text-text-hi md:text-5xl">
                <span>{homeScore}</span>
                <span className="text-text-faint">–</span>
                <span>{awayScore}</span>
              </div>
              <span className="chip mt-2" style={{ color: resultColor, borderColor: resultColor }}>{resultLabel}</span>
            </div>
            <div>
              <div className="font-display text-lg font-semibold text-text-hi md:text-xl">{awayName}</div>
              <div className="label-tech mt-0.5">{match.home ? "Away" : "Home"}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-text-dim">
            <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-text-faint" />{match.home ? "Home" : "Away"}</span>
            <span>{new Date(match.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</span>
            {match.rating > 0 && (
              <span className="flex items-center gap-1.5"><Star className="size-3.5 text-review" fill="var(--review)" />Rating {match.rating}</span>
            )}
          </div>
        </div>
      </div>

      {/* Player line */}
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
        {[
          { label: "Position", value: match.position, icon: <Shirt className="size-3.5" /> },
          { label: "Role", value: match.started ? "Start" : "Sub" },
          { label: "Minutes", value: match.minutes },
          { label: "Goals", value: match.goals },
          { label: "Assists", value: match.assists },
        ].map((s) => (
          <div key={s.label} className="bg-ink-900 p-3">
            <div className="stat-figure text-xl">{s.value}</div>
            <div className="label-tech mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Key clips */}
      {clips.length > 0 && (
        <div className="mt-8">
          <SectionHeader label={`Key clips · ${clips.length}`} action={{ label: "Film Room", href: "/app/film-room" }} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((c) => {
              const s = sentimentStyle[c.sentiment ?? "review"];
              return (
                <Link key={c.id} href={`/app/film-room/${c.videoId}`} className="min-w-0 group panel p-4 transition-colors hover:border-line-strong">
                  <div className="flex items-center justify-between">
                    <span className="data-mono text-xs text-text-dim">{fmtTime(c.startSeconds)}</span>
                    <span className="chip" style={{ color: s.color, borderColor: s.wash, background: s.wash }}>{s.label}</span>
                  </div>
                  <div className="mt-2 flex items-start gap-1.5">
                    <Clapperboard className="mt-0.5 size-3.5 shrink-0 text-signal-bright" />
                    <span className="text-sm font-medium text-text-hi">{c.title}</span>
                  </div>
                  {c.note && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-dim">{c.note}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 2).map((t) => <span key={t} className="chip">{t}</span>)}
                    </div>
                    <ChevronRight className="size-3.5 text-text-faint transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-8">
        <SectionHeader label="My performance" />
        <StatsForm matchId={match.id} initial={stats} />
      </div>

      {/* Review */}
      <div className="mt-8">
        <SectionHeader label="My review" />
        <ReviewForm matchId={match.id} initial={review} momentIntoFilm />
      </div>
    </div>
  );
}
