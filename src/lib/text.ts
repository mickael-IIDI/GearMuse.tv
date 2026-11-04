/** Utilitaires texte partagés (serveur, scripts, client). */

/** Minuscules, sans accents, ponctuation → espaces, espaces compactés. */
export function normalize(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugify(input: string, max = 80): string {
  const s = normalize(input).replace(/\s+/g, "-");
  if (s.length <= max) return s || "video";
  return s.slice(0, max).replace(/-[^-]*$/, "") || s.slice(0, max);
}

export function tokenize(input: string): string[] {
  const n = normalize(input);
  return n ? n.split(" ") : [];
}

/** Vrai si `phrase` (normalisée) apparaît dans `haystack` (normalisé, encadré d'espaces). */
export function containsPhrase(paddedHaystack: string, phrase: string): boolean {
  return paddedHaystack.includes(` ${phrase} `);
}

export function pad(normalized: string): string {
  return ` ${normalized} `;
}

/** Distance de Damerau-Levenshtein restreinte (transpositions adjacentes). */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

/** Extrait l'identifiant d'une vidéo YouTube depuis une URL ou un identifiant brut. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let url: URL;
  try {
    url = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:embed|v|shorts|live|e)\/([A-Za-z0-9_-]{11})/);
      if (m) id = m[1];
    }
    if (!id && url.pathname === "/attribution_link") {
      const u = url.searchParams.get("u");
      if (u) return parseYouTubeId(`https://www.youtube.com${u}`);
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Extrait tous les identifiants YouTube présents dans un texte (HTML ou brut). */
export function extractYouTubeIds(text: string): string[] {
  const out = new Set<string>();
  const re =
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^"'\s<>]*?&(?:amp;)?)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[1]);
  return [...out];
}

export function videoSlug(title: string, externalId: string): string {
  return `${slugify(title, 70)}-${externalId}`;
}

/** Retrouve l'identifiant fournisseur à la fin d'un slug "titre-ID". */
export function idFromVideoSlug(slug: string): string | null {
  const m = slug.match(/([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
}

/** Détection grossière FR/EN fondée sur les mots-outils. Marquée "heuristic" en base. */
export function guessLanguage(text: string): "fr" | "en" | null {
  const t = tokenize(text);
  if (t.length < 3) return null;
  const fr = new Set(["le", "la", "les", "des", "du", "une", "un", "est", "et", "avec", "pour", "dans", "sur", "qui", "que", "pas", "plus", "nous", "vous", "son", "sa", "ses", "au", "aux", "ce", "cette", "comment", "pourquoi", "voiture", "moteur", "avion", "bateau", "essai"]);
  const en = new Set(["the", "and", "of", "to", "is", "in", "with", "for", "on", "how", "why", "this", "that", "what", "it", "from", "my", "we", "you", "its", "an", "are", "was", "at", "by", "car", "engine", "plane", "boat"]);
  let f = 0;
  let e = 0;
  for (const w of t) {
    if (fr.has(w)) f++;
    if (en.has(w)) e++;
  }
  if (f === 0 && e === 0) return null;
  return f > e ? "fr" : "en";
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** ISO 8601 (PT1H2M3S) → secondes. */
export function parseIsoDuration(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, mi, s] = m.map((x) => (x ? Number(x) : 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function stripHtml(s: string): string {
  return decodeHtmlEntities(s.replace(/<p>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();
}
