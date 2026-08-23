export interface PostClip {
  title: string;
  start: number;
  tags: string[];
  sentiment: string | null;
  videoSource: string | null;       // 'youtube' | 'url' | 'upload'
  videoExternalId: string | null;   // youtube id for embed
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

export interface PostDetail {
  post: FeedPost;
  comments: PostComment[];
}

export interface PostInput {
  title: string;
  body: string;
  clipId?: string | null;
  tags?: string[];
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
