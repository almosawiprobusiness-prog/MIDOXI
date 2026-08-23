import { PageSkeleton } from "@/components/ui/skeleton";

/*
  One loading state for the whole workspace.

  It sits at `/app` rather than on each route because the shell — sidebar,
  topbar, command bar — lives in the layout and stays mounted. Only the page
  body swaps, so this is exactly the region that needs filling while the next
  server component awaits its data.

  Individual routes with a genuinely different shape can add their own
  `loading.tsx`; this is the floor, not the ceiling.
*/
export default function Loading() {
  return <PageSkeleton />;
}
