import { getCurrentUser } from "@/lib/auth/session";
import { PlayerLocker } from "@/components/dashboards/player-locker";
import { CoachTouchline } from "@/components/dashboards/coach-touchline";
import { TrainerLab } from "@/components/dashboards/trainer-lab";
import { ClubHQ } from "@/components/dashboards/club-hq";

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
