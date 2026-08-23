import { redirect } from "next/navigation";

/*
  The old Intelligence page rendered static sample content as if it were the
  user's own study data. It has been replaced by the Study Engine, which is
  backed by the curated knowledge graph and the user's real studies.
*/
export default function LibraryRedirect() {
  redirect("/app/study");
}
