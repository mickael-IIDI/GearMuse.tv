import { parseYouTubeId } from "@/lib/text";
import { fetchJson, fetchWithRetry, recordUsage } from "./http";

/**
 * Reddit — accès autorisé uniquement via l'API OAuth officielle (application de type
 * « script » ou « web », identifiants REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET).
 * Sans identifiants, le connecteur est désactivé (aucun accès non authentifié).
 */

export const redditEnabled = () => Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const res = await fetchWithRetry("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT || "web:vehicult-catalog:v0.1",
    },
  });
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return token.value;
}

export type RedditPost = {
  postId: string;
  subreddit: string;
  title: string;
  videoId: string;
  author: string;
  score: number;
  comments: number;
  createdAt: Date;
  permalink: string;
};

/** Meilleures publications d'un subreddit pointant vers YouTube. */
export async function redditTopVideos(subreddit: string, period: "year" | "all" | "month" = "all", limit = 100): Promise<RedditPost[]> {
  if (!redditEnabled()) throw new Error("Reddit non configuré (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET)");
  const t = await accessToken();
  type Listing = { data: { children: { data: { id: string; title: string; url: string; author: string; score: number; num_comments: number; created_utc: number; permalink: string; over_18: boolean } }[] } };
  const r = await fetchJson<Listing>(`https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/top?t=${period}&limit=${limit}&raw_json=1`, {
    headers: { Authorization: `Bearer ${t}`, "User-Agent": process.env.REDDIT_USER_AGENT || "web:vehicult-catalog:v0.1" },
  });
  await recordUsage("reddit_api", { requests: 1 });
  const out: RedditPost[] = [];
  for (const c of r.data.children) {
    const d = c.data;
    if (d.over_18) continue;
    const videoId = parseYouTubeId(d.url);
    if (!videoId) continue;
    out.push({
      postId: d.id,
      subreddit,
      title: d.title,
      videoId,
      author: d.author,
      score: d.score,
      comments: d.num_comments,
      createdAt: new Date(d.created_utc * 1000),
      permalink: `https://www.reddit.com${d.permalink}`,
    });
  }
  return out;
}
