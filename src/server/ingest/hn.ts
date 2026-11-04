import { extractYouTubeIds, parseYouTubeId, stripHtml, truncate } from "@/lib/text";
import { fetchJson, recordUsage } from "./http";

/**
 * Hacker News via l'API publique Algolia (https://hn.algolia.com/api), sans clé.
 * Deux usages :
 *  1. stories dont l'URL pointe vers YouTube (soumissions votées) ;
 *  2. commentaires citant un identifiant de vidéo (recommandeurs distincts dans le temps).
 */

const BASE = "https://hn.algolia.com/api/v1";

type AlgoliaHit = {
  objectID: string;
  title?: string | null;
  url?: string | null;
  author: string;
  points?: number | null;
  num_comments?: number | null;
  created_at: string;
  created_at_i: number;
  comment_text?: string | null;
  story_id?: number | null;
  story_title?: string | null;
  story_url?: string | null;
};
type AlgoliaPage = { hits: AlgoliaHit[]; nbHits: number; nbPages: number; page: number };

export type HnStory = {
  storyId: string;
  title: string;
  url: string;
  videoId: string;
  author: string;
  points: number;
  comments: number;
  createdAt: Date;
};

export type HnMention = {
  commentId: string;
  videoId: string;
  author: string;
  createdAt: Date;
  storyId: string | null;
  storyTitle: string | null;
  excerpt: string;
};

async function search(endpoint: "search" | "search_by_date", params: Record<string, string>): Promise<AlgoliaPage> {
  const qs = new URLSearchParams(params);
  const r = await fetchJson<AlgoliaPage>(`${BASE}/${endpoint}?${qs}`);
  await recordUsage("hn_algolia", { requests: 1 });
  return r;
}

/**
 * Stories HN liant une vidéo YouTube, sur une fenêtre temporelle [from, to[.
 * Découpe automatiquement la fenêtre si elle dépasse la limite de 1000 résultats d'Algolia.
 */
export async function hnYouTubeStories(opts: { from: Date; to: Date; minPoints: number }): Promise<HnStory[]> {
  const out = new Map<string, HnStory>();
  const windows: [number, number][] = [[Math.floor(opts.from.getTime() / 1000), Math.floor(opts.to.getTime() / 1000)]];
  while (windows.length) {
    const [a, b] = windows.shift()!;
    for (const q of ["youtube.com", "youtu.be"]) {
      const params = {
        query: q,
        tags: "story",
        restrictSearchableAttributes: "url",
        numericFilters: `points>=${opts.minPoints},created_at_i>=${a},created_at_i<${b}`,
        hitsPerPage: "1000",
      };
      const page = await search("search_by_date", params);
      if (page.nbHits > 1000 && b - a > 86400 * 7) {
        const mid = Math.floor((a + b) / 2);
        windows.push([a, mid], [mid, b]);
        break;
      }
      for (const h of page.hits) {
        const videoId = h.url ? parseYouTubeId(h.url) : null;
        if (!videoId || !h.title) continue;
        out.set(h.objectID, {
          storyId: h.objectID,
          title: h.title,
          url: h.url!,
          videoId,
          author: h.author,
          points: h.points ?? 0,
          comments: h.num_comments ?? 0,
          createdAt: new Date(h.created_at),
        });
      }
    }
  }
  return [...out.values()];
}

function excerptAround(text: string, videoId: string, max = 280): string {
  const plain = stripHtml(text).replace(/\s+/g, " ");
  const idx = plain.indexOf(videoId);
  if (idx < 0 || plain.length <= max) return truncate(plain, max);
  const start = Math.max(0, idx - Math.floor(max * 0.6));
  return (start > 0 ? "…" : "") + truncate(plain.slice(start), max);
}

/** Commentaires HN contenant un lien vers la vidéo donnée (vérification stricte de l'identifiant). */
export async function hnMentionsOf(videoId: string, maxHits = 200): Promise<HnMention[]> {
  const page = await search("search", { query: videoId, tags: "comment", hitsPerPage: String(maxHits) });
  const out: HnMention[] = [];
  for (const h of page.hits) {
    if (!h.comment_text) continue;
    if (!extractYouTubeIds(h.comment_text).includes(videoId)) continue;
    out.push({
      commentId: h.objectID,
      videoId,
      author: h.author,
      createdAt: new Date(h.created_at),
      storyId: h.story_id ? String(h.story_id) : null,
      storyTitle: h.story_title ?? null,
      excerpt: excerptAround(h.comment_text, videoId),
    });
  }
  return out;
}

/** Découverte par mots-clés : commentaires mentionnant YouTube et un terme du périmètre. */
export async function hnCommentDiscovery(keyword: string, maxHits = 1000): Promise<HnMention[]> {
  const page = await search("search", { query: `youtube ${keyword}`, tags: "comment", hitsPerPage: String(maxHits) });
  const out: HnMention[] = [];
  for (const h of page.hits) {
    if (!h.comment_text) continue;
    for (const videoId of extractYouTubeIds(h.comment_text)) {
      out.push({
        commentId: h.objectID,
        videoId,
        author: h.author,
        createdAt: new Date(h.created_at),
        storyId: h.story_id ? String(h.story_id) : null,
        storyTitle: h.story_title ?? null,
        excerpt: excerptAround(h.comment_text, videoId),
      });
    }
  }
  return out;
}

export const hnItemUrl = (id: string) => `https://news.ycombinator.com/item?id=${id}`;
