import { decodeHtmlEntities, parseIsoDuration } from "@/lib/text";
import { fetchJson, fetchWithRetry, HttpError, recordUsage, usageToday } from "./http";

/* ------------------------------------------------------------------ */
/* oEmbed — point d'accès public officiel, sans clé                    */
/* ------------------------------------------------------------------ */

export type OEmbedResult =
  | {
      status: "available";
      title: string;
      authorName: string;
      authorUrl: string;
      thumbnailUrl: string;
      thumbnailWidth: number;
      thumbnailHeight: number;
    }
  | { status: "embed_disabled" | "unavailable" | "invalid"; httpStatus: number };

/**
 * Vérifie l'existence et l'intégrabilité d'une vidéo via oEmbed.
 * 200 → disponible et intégrable ; 401/403 → intégration désactivée ou vidéo privée ;
 * 404 → supprimée / inexistante ; 400 → identifiant invalide.
 */
export async function oembed(videoId: string): Promise<OEmbedResult> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  const res = await fetchWithRetry(url, { passStatuses: [400, 401, 403, 404] });
  await recordUsage("youtube_oembed", { requests: 1, errors: res.ok ? 0 : 1 });
  if (res.status === 200) {
    const j = (await res.json()) as {
      title: string;
      author_name: string;
      author_url: string;
      thumbnail_url: string;
      thumbnail_width: number;
      thumbnail_height: number;
    };
    return {
      status: "available",
      title: j.title,
      authorName: j.author_name,
      authorUrl: j.author_url,
      thumbnailUrl: j.thumbnail_url,
      thumbnailWidth: j.thumbnail_width,
      thumbnailHeight: j.thumbnail_height,
    };
  }
  if (res.status === 401 || res.status === 403) return { status: "embed_disabled", httpStatus: res.status };
  if (res.status === 404) return { status: "unavailable", httpStatus: 404 };
  return { status: "invalid", httpStatus: res.status };
}

/* ------------------------------------------------------------------ */
/* Flux RSS public des chaînes (Atom, 15 dernières vidéos)             */
/* ------------------------------------------------------------------ */

export type FeedEntry = {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: Date;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string | null;
  views: number | null;
  likes: number | null;
  isShort: boolean;
};
export type ChannelFeed = { channelId: string; title: string; url: string; entries: FeedEntry[] };

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decodeHtmlEntities(m[1].trim()) : null;
}
function attr(xml: string, name: string, attribute: string): string | null {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*${attribute}="([^"]*)"`));
  return m ? decodeHtmlEntities(m[1]) : null;
}

export async function channelFeed(channelId: string): Promise<ChannelFeed | null> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetchWithRetry(url, { passStatuses: [404, 400, 500] });
  await recordUsage("youtube_rss", { requests: 1, errors: res.ok ? 0 : 1 });
  if (!res.ok) return null;
  const xml = await res.text();
  const head = xml.split("<entry>")[0];
  const entries: FeedEntry[] = [];
  for (const chunk of xml.split("<entry>").slice(1)) {
    const e = chunk.split("</entry>")[0];
    const videoId = tag(e, "yt:videoId");
    if (!videoId) continue;
    const link = attr(e, "link", "href") ?? "";
    const author = tag(e, "author") ?? "";
    entries.push({
      videoId,
      channelId: tag(e, "yt:channelId") ?? channelId,
      title: tag(e, "title") ?? "",
      description: tag(e, "media:description") ?? "",
      publishedAt: new Date(tag(e, "published") ?? Date.now()),
      authorName: tag(author, "name") ?? "",
      authorUrl: tag(author, "uri") ?? "",
      thumbnailUrl: attr(e, "media:thumbnail", "url"),
      views: Number(attr(e, "media:statistics", "views")) || null,
      likes: Number(attr(e, "media:starRating", "count")) || null,
      isShort: link.includes("/shorts/"),
    });
  }
  return { channelId, title: tag(head, "title") ?? "", url: attr(head, "link", "href") ?? "", entries };
}

/* ------------------------------------------------------------------ */
/* YouTube Data API v3 (clé requise : YOUTUBE_API_KEY)                 */
/* ------------------------------------------------------------------ */

export const youtubeApiEnabled = () => Boolean(process.env.YOUTUBE_API_KEY);
const DAILY_QUOTA = () => Number(process.env.YOUTUBE_DAILY_QUOTA || 10000);
/** Réserve gardée pour les opérations manuelles de l'administration. */
const QUOTA_RESERVE = 500;

export class QuotaExceededError extends Error {}

async function api<T>(endpoint: string, params: Record<string, string>, units: number): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY non configurée");
  const used = await usageToday("youtube_data_api");
  if (used.units + units > DAILY_QUOTA() - QUOTA_RESERVE) {
    throw new QuotaExceededError(`Quota YouTube quotidien presque atteint (${used.units}/${DAILY_QUOTA()} unités)`);
  }
  const qs = new URLSearchParams({ ...params, key });
  try {
    const r = await fetchJson<T>(`https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`);
    await recordUsage("youtube_data_api", { units, requests: 1 });
    return r;
  } catch (e) {
    await recordUsage("youtube_data_api", { units, requests: 1, errors: 1 });
    if (e instanceof HttpError && e.status === 403 && /quotaExceeded|dailyLimitExceeded/.test(e.body ?? "")) {
      throw new QuotaExceededError("Quota YouTube dépassé (réponse de l'API)");
    }
    throw e;
  }
}

export type ApiVideo = {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: Date;
  durationSeconds: number | null;
  thumbnails: Record<string, { url: string; width?: number; height?: number }>;
  tags: string[];
  categoryId: string | null;
  language: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  embeddable: boolean;
  privacyStatus: string;
  uploadStatus: string;
  regionBlocked: string[] | null;
  liveBroadcastContent: string;
};

type RawVideo = {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: Record<string, { url: string; width?: number; height?: number }>;
    tags?: string[];
    categoryId?: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    liveBroadcastContent: string;
  };
  contentDetails?: { duration?: string; regionRestriction?: { blocked?: string[] } };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  status?: { embeddable?: boolean; privacyStatus?: string; uploadStatus?: string };
};

/** videos.list — 1 unité par appel de 50 identifiants au plus. Les identifiants absents de la réponse sont indisponibles. */
export async function apiVideos(ids: string[]): Promise<Map<string, ApiVideo>> {
  const out = new Map<string, ApiVideo>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const r = await api<{ items: RawVideo[] }>("videos", { part: "snippet,contentDetails,statistics,status", id: batch.join(","), maxResults: "50" }, 1);
    for (const v of r.items ?? []) {
      const lang = (v.snippet.defaultAudioLanguage || v.snippet.defaultLanguage || "").split("-")[0] || null;
      out.set(v.id, {
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        publishedAt: new Date(v.snippet.publishedAt),
        durationSeconds: parseIsoDuration(v.contentDetails?.duration),
        thumbnails: v.snippet.thumbnails ?? {},
        tags: v.snippet.tags ?? [],
        categoryId: v.snippet.categoryId ?? null,
        language: lang,
        viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
        likeCount: v.statistics?.likeCount ? Number(v.statistics.likeCount) : null,
        commentCount: v.statistics?.commentCount ? Number(v.statistics.commentCount) : null,
        embeddable: v.status?.embeddable ?? true,
        privacyStatus: v.status?.privacyStatus ?? "public",
        uploadStatus: v.status?.uploadStatus ?? "processed",
        regionBlocked: v.contentDetails?.regionRestriction?.blocked ?? null,
        liveBroadcastContent: v.snippet.liveBroadcastContent,
      });
    }
  }
  return out;
}

export type ApiChannel = {
  id: string;
  title: string;
  description: string;
  customUrl: string | null;
  country: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  uploadsPlaylistId: string | null;
};

/** channels.list — 1 unité. Accepte des identifiants de chaîne ou un handle (@nom). */
export async function apiChannels(input: { ids?: string[]; handle?: string }): Promise<ApiChannel[]> {
  const params: Record<string, string> = { part: "snippet,statistics,contentDetails", maxResults: "50" };
  if (input.handle) params.forHandle = input.handle.replace(/^@?/, "@");
  else params.id = (input.ids ?? []).join(",");
  type Raw = {
    id: string;
    snippet: { title: string; description: string; customUrl?: string; country?: string };
    statistics?: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  };
  const r = await api<{ items?: Raw[] }>("channels", params, 1);
  return (r.items ?? []).map((c) => ({
    id: c.id,
    title: c.snippet.title,
    description: c.snippet.description,
    customUrl: c.snippet.customUrl ?? null,
    country: c.snippet.country ?? null,
    subscriberCount: c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount ?? NaN) || null,
    videoCount: Number(c.statistics?.videoCount ?? NaN) || null,
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads ?? null,
  }));
}

/** playlistItems.list — 1 unité par page de 50. Retourne les identifiants de vidéos. */
export async function apiPlaylistVideoIds(playlistId: string, maxPages = 4): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let p = 0; p < maxPages; p++) {
    const r = await api<{ items?: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>(
      "playlistItems",
      { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) },
      1,
    );
    for (const it of r.items ?? []) ids.push(it.contentDetails.videoId);
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

/** search.list — 100 unités ! À réserver aux recherches ciblées et peu fréquentes. */
/** Recherche de chaînes (100 unités par appel). */
export async function apiSearchChannels(query: string, opts: { maxResults?: number; relevanceLanguage?: string; regionCode?: string } = {}): Promise<string[]> {
  const r = await api<{ items?: { id: { channelId?: string } }[] }>(
    "search",
    {
      part: "id",
      type: "channel",
      q: query,
      maxResults: String(opts.maxResults ?? 50),
      safeSearch: "moderate",
      ...(opts.relevanceLanguage ? { relevanceLanguage: opts.relevanceLanguage } : {}),
      ...(opts.regionCode ? { regionCode: opts.regionCode } : {}),
    },
    100,
  );
  return (r.items ?? []).map((i) => i.id.channelId).filter((x): x is string => Boolean(x));
}

export async function apiSearch(query: string, opts: { maxResults?: number; relevanceLanguage?: string; videoDuration?: "any" | "long" | "medium" | "short"; publishedAfter?: string } = {}): Promise<string[]> {
  const r = await api<{ items?: { id: { videoId?: string } }[] }>(
    "search",
    {
      part: "id",
      type: "video",
      q: query,
      maxResults: String(opts.maxResults ?? 25),
      videoEmbeddable: "true",
      safeSearch: "moderate",
      ...(opts.relevanceLanguage ? { relevanceLanguage: opts.relevanceLanguage } : {}),
      ...(opts.videoDuration ? { videoDuration: opts.videoDuration } : {}),
      ...(opts.publishedAfter ? { publishedAfter: opts.publishedAfter } : {}),
    },
    100,
  );
  return (r.items ?? []).map((i) => i.id.videoId).filter((x): x is string => Boolean(x));
}
