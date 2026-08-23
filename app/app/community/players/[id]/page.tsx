import { redirect } from "next/navigation";

/*
  The old profile route, kept as a redirect.

  Profiles now live at `/app/community/[handle]`, which resolves a handle OR a
  user id — so every link that used this path still lands in the right place.

  It exists rather than being deleted because these URLs are already in the
  wild: they were how the forum linked to an author, and somebody may have one
  saved. A 404 for a player who is still there is a worse answer than a hop.
*/

export default async function LegacyPlayerProfile({
  params,
}: PageProps<"/app/community/players/[id]">) {
  const { id } = await params;
  redirect(`/app/community/${id}`);
}
