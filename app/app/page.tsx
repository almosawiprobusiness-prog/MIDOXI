import { getCurrentUser } from "@/lib/auth/session";
import { primaryNav } from "@/lib/roles/roles";
import { PlayerLocker } from "@/components/dashboards/player-locker";
import { CoachTouchline } from "@/components/dashboards/coach-touchline";
import { TrainerLab } from "@/components/dashboards/trainer-lab";
import { ClubHQ } from "@/components/dashboards/club-hq";

/*
  The one route in the app with no title of its own — every other page
  named itself and the home screen read "MIDO XI — Football Performance
  OS", the same as a browser tab that had not finished loading.

  Named from the navigation rather than a literal, because this route is
  four different rooms: Touchline for a coach, the Locker for a player.
  The sidebar already knows what to call each one, so it is asked
  instead of a second list being written that could disagree with it.
*/
export async function generateMetadata() {
  const user = await getCurrentUser();
  const home = primaryNav(user?.role ?? "player")[0];
  return { title: `${home?.label ?? "Home"} — MIDO XI` };
}

/*
  The home screen is the clearest expression of the product thesis: the same
  route, the same account, four genuinely different operating systems.
*/
export default async function AppHome() {
  const user = await getCurrentUser();

  switch (user?.role) {
    case "coach":
      return <CoachTouchline />;
    case "trainer":
      return <TrainerLab />;
    case "club":
      return <ClubHQ />;
    default:
      return <PlayerLocker />;
  }
}
