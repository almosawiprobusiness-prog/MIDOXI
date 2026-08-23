/*
  Shapes the DEMO STORE still speaks.

  The community became a feed, and the live product reads `feed-types.ts` and
  `feed.ts` for everything. This file is what is left: the demo store keeps an
  in-memory copy of posts and comments so demo mode has something to render,
  and it was written against these names.

  Nothing in the real product imports this. If the demo store is ever rewritten
  against `Post` from `feed-types.ts`, this file goes with it.
*/

export interface PostClip {
  title: string;
  start: number;
  tags: string[];
  sentiment: string | null;
  videoSource: string | null;
  videoExternalId: string | null;
}

export interface FeedPost {
  id: string;
  userId: string;
  authorName: string;
  authorHandle: string | null;
  authorPosition: string | null;
  authorAvatar: string | null;
  title: string;
  body: string;
  clip: PostClip | null;
  tags: string[];
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  hasReacted: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorHandle: string | null;
  body: string;
  createdAt: string;
}
