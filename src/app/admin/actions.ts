"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  adminUsers, ADMIN_ROLES, brands, categories, contentReports, creators, editorialReviews, playlistItems, playlists, sources, subcategories,
  tags, vehicleModels, videoBrands, videoCategories, videoModels, videos, videoSubcategories, videoSuggestions, videoTags, type AdminRole, type PlaylistRules,
} from "@/db/schema";
import { normalize, parseYouTubeId, slugify } from "@/lib/text";
import { audit, login, logout, requireAdmin } from "@/server/auth/session";
import { ensureBootstrapAdmin } from "@/server/auth/bootstrap";
import { hashPassword } from "@/server/auth/password";
import { refreshCounts } from "@/server/catalog/seed";
import { refreshSmartPlaylists, reorderPlaylist } from "@/server/catalog/playlists";
import { importUrls, upsertChannelSource } from "@/server/ingest/discovery";
import { JOB_TYPES, runJob, runSteps, DAILY_STEPS } from "@/server/ingest/jobs";
import { analyzeVideos, enrichVideos, rebuildSearchText, scoreVideos } from "@/server/ingest/pipeline";
import { channelFeed } from "@/server/ingest/youtube";
import { DEFAULT_SETTINGS, setSetting, type Settings } from "@/server/settings";
import { rateLimit } from "@/server/security/rate-limit";
import { headers } from "next/headers";

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const h = await headers();
  const req = new Request("http://local", { headers: h });
  if (!rateLimit(req, "admin-login", 10, 15 * 60_000)) return { error: "Trop de tentatives. Patientez quelques minutes." };
  await ensureBootstrapAdmin();
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Renseignez l'e-mail et le mot de passe." };
  const r = await login(email, password);
  if (!r.ok) return { error: r.error };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/connexion");
}

/* ------------------------------------------------------------------ */
/* Vidéos : modération et édition                                      */
/* ------------------------------------------------------------------ */

const DECISIONS = ["approve", "reject", "exclude", "unlock", "feature", "unfeature"] as const;
type Decision = (typeof DECISIONS)[number];

async function applyDecision(ids: number[], decision: Decision, note: string | null) {
  const s = await requireAdmin("editor");
  const db = await getDb();
  const now = new Date();
  for (const id of ids) {
    const before = await db.query.videos.findFirst({ where: eq(videos.id, id), columns: { status: true, editorialPick: true, statusLocked: true, publishedOnSiteAt: true } });
    if (!before) continue;
    const patch: Partial<typeof videos.$inferInsert> =
      decision === "approve"
        ? { status: "published", statusLocked: true, statusReason: "editor: validée par la rédaction", statusChangedAt: now, publishedOnSiteAt: before.publishedOnSiteAt ?? now }
        : decision === "reject"
          ? { status: "rejected", statusLocked: true, statusReason: "editor: refusée par la rédaction", statusChangedAt: now }
          : decision === "exclude"
            ? { status: "excluded", statusLocked: true, statusReason: `editor: exclue${note ? ` — ${note}` : ""}`, statusChangedAt: now }
            : decision === "unlock"
              ? { statusLocked: false, needsReanalysis: true, statusReason: "editor: rendue au pipeline automatique" }
              : decision === "feature"
                ? { editorialPick: true }
                : { editorialPick: false };
    await db.update(videos).set({ ...patch, updatedAt: now }).where(eq(videos.id, id));
    await db.insert(editorialReviews).values({ videoId: id, adminUserId: s.userId, decision: decision === "unlock" ? "edit" : decision, notes: note });
    await audit(s, `video_${decision}`, "video", id, before, patch);
  }
  // Une sélection de la rédaction est une preuve enregistrée (et donc affichée) : on recalcule la note.
  if (decision === "feature" || decision === "unfeature" || decision === "approve") await scoreVideos({ videoIds: ids });
  if (decision === "unlock") {
    await analyzeVideos({ videoIds: ids });
    await scoreVideos({ videoIds: ids });
  }
  await refreshCounts();
  revalidatePath("/admin", "layout");
}

export async function moderateAction(form: FormData) {
  const decision = str(form, "decision") as Decision;
  if (!DECISIONS.includes(decision)) throw new Error("Décision inconnue");
  const ids = form.getAll("id").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  await applyDecision(ids, decision, str(form, "note") || null);
}

const VideoEdit = z.object({
  id: z.coerce.number().int().positive(),
  editorialSummary: z.string().max(2000),
  selectionReason: z.string().max(2000),
  scoreOverride: z.union([z.literal(""), z.coerce.number().int().min(0).max(100)]),
  language: z.string().max(8),
  primaryFormat: z.string().max(40),
  universes: z.string().max(400),
  subcategories: z.string().max(800),
  brands: z.string().max(800),
  models: z.string().max(800),
  tags: z.string().max(800),
});

const list = (s: string) => [...new Set(s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];

export async function updateVideoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireAdmin("editor");
  const p = VideoEdit.safeParse(Object.fromEntries(form.entries()));
  if (!p.success) return { error: "Champs invalides : " + p.error.issues.map((i) => i.path.join(".")).join(", ") };
  const d = p.data;
  const db = await getDb();
  const before = await db.query.videos.findFirst({ where: eq(videos.id, d.id) });
  if (!before) return { error: "Vidéo introuvable" };
  await db
    .update(videos)
    .set({
      editorialSummary: d.editorialSummary || null,
      editorialSummarySource: d.editorialSummary ? (d.editorialSummary === before.editorialSummary ? before.editorialSummarySource : "editor") : null,
      selectionReason: d.selectionReason || before.selectionReason,
      scoreOverride: d.scoreOverride === "" ? null : d.scoreOverride,
      language: d.language || null,
      languageSource: d.language ? "editor" : before.languageSource,
      primaryFormat: d.primaryFormat || null,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, d.id));

  // Affectations éditoriales : remplacent les affectations automatiques et sont conservées lors des réanalyses.
  const unis = list(d.universes);
  const subs = list(d.subcategories);
  const bs = list(d.brands);
  const ms = list(d.models);
  const ts = list(d.tags);
  const cats = unis.length ? await db.select().from(categories).where(inArray(categories.slug, unis)) : [];
  await db.delete(videoCategories).where(and(eq(videoCategories.videoId, d.id), sql`${videoCategories.categoryId} in (select id from categories where kind = 'universe')`));
  if (cats.length) await db.insert(videoCategories).values(cats.map((c, i) => ({ videoId: d.id, categoryId: c.id, isPrimary: i === 0, confidence: 1, source: "editor" as const }))).onConflictDoNothing();
  const subRows = subs.length ? await db.select().from(subcategories).where(inArray(subcategories.slug, subs)) : [];
  await db.delete(videoSubcategories).where(eq(videoSubcategories.videoId, d.id));
  if (subRows.length) await db.insert(videoSubcategories).values(subRows.map((x) => ({ videoId: d.id, subcategoryId: x.id, confidence: 1, source: "editor" as const }))).onConflictDoNothing();
  const brandRows = bs.length ? await db.select().from(brands).where(inArray(brands.slug, bs)) : [];
  await db.delete(videoBrands).where(eq(videoBrands.videoId, d.id));
  if (brandRows.length) await db.insert(videoBrands).values(brandRows.map((x) => ({ videoId: d.id, brandId: x.id, confidence: 1, source: "editor" as const }))).onConflictDoNothing();
  await db.delete(videoModels).where(eq(videoModels.videoId, d.id));
  for (const key of ms) {
    const [bslug, mslug] = key.split("/");
    const m = await db.select({ id: vehicleModels.id }).from(vehicleModels).innerJoin(brands, eq(brands.id, vehicleModels.brandId)).where(and(eq(brands.slug, bslug ?? ""), eq(vehicleModels.slug, mslug ?? "")));
    if (m[0]) await db.insert(videoModels).values({ videoId: d.id, modelId: m[0].id, confidence: 1, source: "editor" }).onConflictDoNothing();
  }
  await db.delete(videoTags).where(eq(videoTags.videoId, d.id));
  for (const t of ts) {
    const slug = normalize(t).replace(/\s+/g, "-");
    if (!slug) continue;
    const [row] = await db.insert(tags).values({ slug, labels: { fr: t, en: t } }).onConflictDoUpdate({ target: tags.slug, set: { slug } }).returning({ id: tags.id });
    await db.insert(videoTags).values({ videoId: d.id, tagId: row.id, source: "editor" }).onConflictDoNothing();
  }
  await db.insert(editorialReviews).values({ videoId: d.id, adminUserId: s.userId, decision: "edit", summary: d.editorialSummary || null, scoreOverride: d.scoreOverride === "" ? null : d.scoreOverride });
  await audit(s, "video_edit", "video", d.id, { summary: before.editorialSummary, override: before.scoreOverride }, d);
  await rebuildSearchText([d.id]);
  await scoreVideos({ videoIds: [d.id] });
  await refreshCounts();
  revalidatePath(`/admin/videos/${d.id}`);
  return { ok: true, message: "Modifications enregistrées." };
}

export async function reanalyzeAction(form: FormData) {
  const s = await requireAdmin("editor");
  const id = Number(form.get("id"));
  const refresh = form.get("refresh") === "1";
  if (refresh) await enrichVideos({ videoIds: [id] });
  await analyzeVideos({ videoIds: [id] });
  await scoreVideos({ videoIds: [id] });
  await audit(s, refresh ? "video_refresh" : "video_reanalyze", "video", id);
  revalidatePath(`/admin/videos/${id}`);
}

/* ------------------------------------------------------------------ */
/* Import manuel et groupé                                             */
/* ------------------------------------------------------------------ */

export async function importAction(_: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireAdmin("editor");
  const lines = str(form, "urls").split(/[\s,]+/).filter(Boolean).slice(0, 200);
  if (!lines.length) return { error: "Collez au moins une URL YouTube." };
  const r = await importUrls(lines, { label: str(form, "label") || `Import de ${s.email}`, adminUserId: s.userId, editorialPick: form.get("editorialPick") === "on", note: str(form, "note") || undefined });
  await audit(s, "import", "import_batch", r.batchId, null, { count: lines.length });
  await refreshCounts();
  revalidatePath("/admin/import");
  const by = r.result.reduce<Record<string, number>>((m, x) => ((m[x.status] = (m[x.status] ?? 0) + 1), m), {});
  return { ok: true, message: `Lot n°${r.batchId} : ${r.result.length} vidéo(s) traitée(s) — ${Object.entries(by).map(([k, v]) => `${k} : ${v}`).join(", ")}${r.invalid.length ? ` — ${r.invalid.length} entrée(s) invalide(s)` : ""}.` };
}

export async function handleSuggestionAction(form: FormData) {
  const s = await requireAdmin("editor");
  const db = await getDb();
  const id = Number(form.get("id"));
  const decision = str(form, "decision");
  const sug = await db.query.videoSuggestions.findFirst({ where: eq(videoSuggestions.id, id) });
  if (!sug) return;
  if (decision === "import") {
    await importUrls([sug.url], { label: `Proposition visiteur n°${id}`, adminUserId: s.userId });
    await db.update(videoSuggestions).set({ status: "imported", reviewedBy: s.userId, reviewedAt: new Date() }).where(eq(videoSuggestions.id, id));
  } else {
    await db.update(videoSuggestions).set({ status: "rejected", reviewedBy: s.userId, reviewedAt: new Date() }).where(eq(videoSuggestions.id, id));
  }
  await audit(s, `suggestion_${decision}`, "suggestion", id);
  revalidatePath("/admin/moderation");
}

export async function handleReportAction(form: FormData) {
  const s = await requireAdmin("editor");
  const db = await getDb();
  const id = Number(form.get("id"));
  const decision = str(form, "decision");
  const report = await db.query.contentReports.findFirst({ where: eq(contentReports.id, id) });
  if (!report) return;
  if (decision === "exclude" && report.videoId) await applyDecision([report.videoId], "exclude", `signalement n°${id}`);
  await db
    .update(contentReports)
    .set({ status: decision === "dismiss" ? "dismissed" : "resolved", resolution: str(form, "resolution") || (decision === "exclude" ? "Vidéo exclue" : decision === "dismiss" ? "Sans suite" : "Traité"), handledBy: s.userId, handledAt: new Date() })
    .where(eq(contentReports.id, id));
  await audit(s, `report_${decision}`, "report", id);
  revalidatePath("/admin/moderation");
}

/* ------------------------------------------------------------------ */
/* Tâches                                                              */
/* ------------------------------------------------------------------ */

export async function runJobAction(form: FormData) {
  const s = await requireAdmin("admin");
  const type = str(form, "type");
  let params: Record<string, unknown> = {};
  try {
    params = str(form, "params") ? JSON.parse(str(form, "params")) : {};
  } catch {
    throw new Error("Paramètres JSON invalides");
  }
  await audit(s, "job_start", "job", type, null, params);
  // Exécution après la réponse : la page de supervision suit l'avancement.
  after(async () => {
    if (type === "daily") await runSteps(DAILY_STEPS, {}, s.email);
    else if (JOB_TYPES[type]) await runJob(type, params, s.email);
  });
  revalidatePath("/admin/taches");
}

/* ------------------------------------------------------------------ */
/* Réglages (pondérations, seuils, IA)                                 */
/* ------------------------------------------------------------------ */

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireAdmin("admin");
  const key = str(form, "key") as keyof Settings;
  if (!(key in DEFAULT_SETTINGS)) return { error: "Réglage inconnu" };
  let value: unknown;
  try {
    value = JSON.parse(str(form, "value"));
  } catch {
    return { error: "JSON invalide" };
  }
  if (key === "scoring") {
    const v = value as Settings["scoring"];
    if (!v?.weights || !v?.thresholds || Object.values(v.weights).some((x) => typeof x !== "number" || x < 0 || x > 100)) return { error: "Pondérations invalides (nombres de 0 à 100)" };
  }
  if (key === "ai") {
    const v = value as Settings["ai"];
    if (typeof v.monthlyBudgetUsd !== "number" || v.monthlyBudgetUsd < 0) return { error: "Budget invalide" };
  }
  await setSetting(key, value as never, s.userId);
  await audit(s, "settings_update", "settings", key, null, value);
  if (key === "scoring" && form.get("rescore") === "on") after(() => runJob("score", {}, s.email).then(() => refreshSmartPlaylists()).then(() => refreshCounts()));
  revalidatePath("/admin/reglages");
  return { ok: true, message: key === "scoring" && form.get("rescore") === "on" ? "Enregistré. Nouvelle notation du catalogue lancée." : "Enregistré." };
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export async function toggleSourceAction(form: FormData) {
  const s = await requireAdmin("admin");
  const db = await getDb();
  const id = Number(form.get("id"));
  const src = await db.query.sources.findFirst({ where: eq(sources.id, id) });
  if (!src) return;
  await db.update(sources).set({ enabled: !src.enabled, updatedAt: new Date() }).where(eq(sources.id, id));
  await audit(s, "source_toggle", "source", id, { enabled: src.enabled }, { enabled: !src.enabled });
  revalidatePath("/admin/sources");
}

export async function updateSourceAction(form: FormData) {
  const s = await requireAdmin("admin");
  const db = await getDb();
  const id = Number(form.get("id"));
  const trust = Math.max(0, Math.min(100, Number(form.get("trust") ?? 50)));
  const universe = str(form, "universe") || null;
  await db.update(sources).set({ trustLevel: trust, universeHint: universe, updatedAt: new Date() }).where(eq(sources.id, id));
  const src = await db.query.sources.findFirst({ where: eq(sources.id, id) });
  if (src?.type === "youtube_channel") {
    await db.update(creators).set({ trustLevel: trust, updatedAt: new Date() }).where(eq(creators.channelId, String(src.config.channelId)));
  }
  await audit(s, "source_update", "source", id, null, { trust, universe });
  revalidatePath("/admin/sources");
}

export async function addSourceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireAdmin("admin");
  const db = await getDb();
  const type = str(form, "type");
  const universe = str(form, "universe") || null;
  const trust = Math.max(0, Math.min(100, Number(form.get("trust") ?? 60)));
  if (type === "youtube_channel") {
    const channelId = str(form, "value").match(/UC[A-Za-z0-9_-]{22}/)?.[0];
    if (!channelId) return { error: "Identifiant de chaîne invalide (format UC…, 24 caractères)." };
    const feed = await channelFeed(channelId);
    if (!feed) return { error: "Chaîne introuvable : le flux public de YouTube ne répond pas pour cet identifiant." };
    const official = form.get("official") === "on";
    await upsertChannelSource({ channelId, title: feed.title, universe, trust, official });
    await audit(s, "source_add", "source", channelId, null, { name: feed.title });
    revalidatePath("/admin/sources");
    return { ok: true, message: `Chaîne vérifiée et ajoutée : ${feed.title} (${feed.entries.length} vidéos récentes dans le flux).` };
  }
  if (type === "hn_query" || type === "reddit_subreddit") {
    const value = str(form, "value").replace(/^r\//, "");
    if (!value || value.length > 60) return { error: "Valeur invalide" };
    await db
      .insert(sources)
      .values({ type, name: type === "hn_query" ? `HN : youtube + ${value}` : `r/${value}`, config: type === "hn_query" ? { query: value } : { subreddit: value }, universeHint: universe, trustLevel: trust })
      .onConflictDoNothing();
    await audit(s, "source_add", "source", value);
    revalidatePath("/admin/sources");
    return { ok: true, message: "Source ajoutée." };
  }
  return { error: "Type de source inconnu" };
}

/* ------------------------------------------------------------------ */
/* Taxonomie : catégories, marques, modèles                            */
/* ------------------------------------------------------------------ */

export async function updateCategoryAction(form: FormData) {
  const s = await requireAdmin("editor");
  const db = await getDb();
  const kind = str(form, "kind");
  const id = Number(form.get("id"));
  const fr = str(form, "fr");
  const en = str(form, "en");
  const active = form.get("active") === "on";
  const table = kind === "sub" ? subcategories : categories;
  await db.update(table).set({ ...(fr ? { labels: { fr, en: en || fr } } : {}), isActive: active, updatedAt: new Date() }).where(eq(table.id, id));
  await audit(s, "taxonomy_update", kind === "sub" ? "subcategory" : "category", id, null, { fr, en, active });
  revalidatePath("/admin/taxonomie");
}

export async function addBrandAction(_: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireAdmin("editor");
  const db = await getDb();
  const name = str(form, "name");
  const brandSlug = str(form, "brand");
  const universes = list(str(form, "universes"));
  const aliases = list(str(form, "aliases")).map(normalize);
  if (!name) return { error: "Nom requis" };
  if (brandSlug) {
    const b = await db.query.brands.findFirst({ where: eq(brands.slug, brandSlug) });
    if (!b) return { error: "Marque inconnue" };
    await db.insert(vehicleModels).values({ brandId: b.id, slug: slugify(name.replace(new RegExp(`^${b.name}\\s+`, "i"), "")), name, aliases, universe: universes[0] ?? b.universes[0] ?? null }).onConflictDoNothing();
    await audit(s, "model_add", "model", name);
  } else {
    await db.insert(brands).values({ slug: slugify(name), name, aliases, universes }).onConflictDoNothing();
    await audit(s, "brand_add", "brand", name);
  }
  revalidatePath("/admin/taxonomie");
  return { ok: true, message: "Ajouté. Lancez « Analyser / classer » avec force pour l'appliquer aux vidéos existantes." };
}

/* ------------------------------------------------------------------ */
/* Playlists                                                           */
/* ------------------------------------------------------------------ */

const PlaylistForm = z.object({
  id: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  titleFr: z.string().min(3).max(140),
  titleEn: z.string().max(140),
  pitchFr: z.string().max(300),
  descFr: z.string().max(2000),
  kind: z.enum(["editorial", "smart"]),
  tier: z.enum(["start", "deep"]),
  status: z.enum(["draft", "published"]),
  rules: z.string().max(4000),
  seoTitle: z.string().max(140),
  seoDescription: z.string().max(300),
});

export async function savePlaylistAction(_: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireAdmin("editor");
  const p = PlaylistForm.safeParse(Object.fromEntries(form.entries()));
  if (!p.success) return { error: "Champs invalides : " + p.error.issues.map((i) => i.path.join(".")).join(", ") };
  const d = p.data;
  let rules: PlaylistRules | null = null;
  if (d.rules.trim()) {
    try {
      rules = JSON.parse(d.rules);
    } catch {
      return { error: "Règles JSON invalides" };
    }
  }
  const db = await getDb();
  const values = {
    slug: d.slug,
    kind: d.kind,
    tier: d.tier,
    status: d.status,
    titles: { fr: d.titleFr, en: d.titleEn || d.titleFr },
    pitches: d.pitchFr ? { fr: d.pitchFr } : null,
    descriptions: d.descFr ? { fr: d.descFr } : null,
    rules,
    seoTitle: d.seoTitle || d.titleFr,
    seoDescription: d.seoDescription || d.descFr.slice(0, 160) || null,
    updatedAt: new Date(),
  };
  let id = Number(d.id);
  if (id) await db.update(playlists).set({ ...values, ...(d.status === "published" ? { publishedAt: new Date() } : {}) }).where(eq(playlists.id, id));
  else {
    const [row] = await db.insert(playlists).values({ ...values, curatedBy: s.name, publishedAt: d.status === "published" ? new Date() : null }).returning({ id: playlists.id });
    id = row.id;
  }
  if (d.kind === "smart") await refreshSmartPlaylists();
  await audit(s, "playlist_save", "playlist", id, null, values);
  revalidatePath("/admin/playlists");
  redirect(`/admin/playlists/${id}`);
}

export async function playlistItemAction(form: FormData) {
  const s = await requireAdmin("editor");
  const db = await getDb();
  const playlistId = Number(form.get("playlistId"));
  const op = str(form, "op");
  const videoId = Number(form.get("videoId"));
  if (op === "add") {
    const ext = parseYouTubeId(str(form, "video"));
    const v = ext ? await db.query.videos.findFirst({ where: eq(videos.externalId, ext) }) : null;
    if (!v) throw new Error("Vidéo absente du catalogue : importez-la d'abord.");
    const max = await db.execute(sql`select coalesce(max(position), 0) + 1 as p from playlist_items where playlist_id = ${playlistId}`);
    const pos = Number((max as unknown as { rows: { p: number }[] }).rows[0]?.p ?? 1);
    await db.insert(playlistItems).values({ playlistId, videoId: v.id, position: pos, addedBy: "editor", pinned: true, note: str(form, "note") || null }).onConflictDoNothing();
  } else if (op === "remove") {
    await db.delete(playlistItems).where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)));
  } else if (op === "pin") {
    await db.update(playlistItems).set({ pinned: sql`not ${playlistItems.pinned}` }).where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)));
  } else if (op === "note") {
    await db.update(playlistItems).set({ note: str(form, "note") || null }).where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)));
  } else if (op === "up" || op === "down") {
    const items = await db.select().from(playlistItems).where(eq(playlistItems.playlistId, playlistId)).orderBy(playlistItems.position);
    const i = items.findIndex((x) => x.videoId === videoId);
    const j = op === "up" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < items.length) {
      [items[i], items[j]] = [items[j], items[i]];
      await reorderPlaylist(playlistId, items.map((x) => x.videoId));
      // Un ordre choisi à la main est figé (épinglé).
      await db.update(playlistItems).set({ pinned: true }).where(and(eq(playlistItems.playlistId, playlistId), inArray(playlistItems.videoId, [items[i].videoId, items[j].videoId])));
    }
  }
  await audit(s, `playlist_item_${op}`, "playlist", playlistId, null, { videoId });
  revalidatePath(`/admin/playlists/${playlistId}`);
}

/* ------------------------------------------------------------------ */
/* Comptes administrateurs (propriétaire uniquement)                    */
/* ------------------------------------------------------------------ */

export async function saveAdminUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const s = await requireAdmin("owner");
  const db = await getDb();
  const email = str(form, "email").toLowerCase();
  const role = str(form, "role") as AdminRole;
  const password = String(form.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !ADMIN_ROLES.includes(role)) return { error: "E-mail ou rôle invalide" };
  const existing = await db.query.adminUsers.findFirst({ where: eq(adminUsers.email, email) });
  if (existing) {
    if (existing.id === s.userId && role !== "owner") return { error: "Vous ne pouvez pas retirer votre propre rôle de propriétaire." };
    await db
      .update(adminUsers)
      .set({ role, isActive: form.get("active") !== "off", ...(password ? { passwordHash: await hashPassword(password) } : {}), updatedAt: new Date() })
      .where(eq(adminUsers.id, existing.id));
  } else {
    if (password.length < 12) return { error: "Mot de passe de 12 caractères minimum requis." };
    await db.insert(adminUsers).values({ email, role, name: str(form, "name") || email.split("@")[0], passwordHash: await hashPassword(password) });
  }
  await audit(s, existing ? "admin_update" : "admin_create", "admin_user", email, null, { role });
  revalidatePath("/admin/comptes");
  return { ok: true, message: existing ? "Compte mis à jour." : "Compte créé." };
}
