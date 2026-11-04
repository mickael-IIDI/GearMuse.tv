import { normalize } from "@/lib/text";

/**
 * Synonymes français ↔ anglais (formes normalisées). Chaque groupe est un ensemble
 * d'équivalents ; les expressions de plusieurs mots sont détectées avant découpage.
 */
export const SYNONYM_GROUPS: string[][] = [
  ["voiture", "voitures", "auto", "automobile", "car", "cars"],
  ["moto", "motos", "motorcycle", "motorcycles", "motorbike", "motorbikes"],
  ["avion", "avions", "aircraft", "airplane", "airplanes", "plane", "planes", "airliner", "aeroplane"],
  ["avion de ligne", "airliner", "commercial aircraft"],
  ["avion de chasse", "fighter jet", "fighter"],
  ["bateau", "bateaux", "boat", "boats", "navire", "navires", "ship", "ships"],
  ["moteur", "moteurs", "engine", "engines", "motor"],
  ["moteur a reaction", "reacteur", "turboreacteur", "jet engine", "turbofan", "turbojet"],
  ["moteur fusee", "rocket engine"],
  ["restauration", "restaurations", "restaurer", "restoration", "restore", "restoring", "rebuild", "renovation"],
  ["essai", "essais", "review", "test drive", "road test", "first drive"],
  ["comparatif", "comparaison", "comparison", "versus", "vs", "shootout"],
  ["fonctionnement", "comment ca marche", "comment fonctionne", "how it works", "how does", "explained", "works"],
  ["construction", "fabrication", "construire", "fabriquer", "build", "building", "built", "manufacturing", "how it s made"],
  ["usine", "factory", "plant", "assembly line", "chaine de montage"],
  ["documentaire", "documentary"],
  ["histoire", "history", "historique", "historic"],
  ["helicoptere", "helicopter"],
  ["fusee", "fusees", "rocket", "rockets", "lanceur"],
  ["sous marin", "sous marins", "submarine", "submarines"],
  ["camion", "camions", "truck", "trucks", "lorry", "poids lourd"],
  ["train", "trains", "locomotive", "railway", "railroad", "chemin de fer"],
  ["tracteur", "tracteurs", "tractor", "tractors"],
  ["hors bord", "outboard"],
  ["course", "courses", "race", "racing"],
  ["pilote", "pilotes", "pilot", "pilots"],
  ["reparation", "reparer", "repair", "fix", "fixing"],
  ["entretien", "maintenance"],
  ["electrique", "electriques", "electric", "ev"],
  ["hybride", "hybrid"],
  ["hydrogene", "hydrogen", "fuel cell", "pile a combustible"],
  ["vapeur", "steam"],
  ["boite de vitesses", "gearbox", "transmission"],
  ["embrayage", "clutch"],
  ["frein", "freins", "brake", "brakes"],
  ["pneu", "pneus", "tire", "tires", "tyre", "tyres"],
  ["aile", "ailes", "wing", "wings"],
  ["helice", "propeller"],
  ["cockpit", "poste de pilotage", "flight deck"],
  ["24 heures du mans", "24h du mans", "le mans", "24 hours of le mans"],
  ["formule 1", "formula 1", "formula one", "f1"],
  ["porte conteneurs", "container ship", "container ships"],
  ["porte avions", "aircraft carrier"],
  ["char", "char d assaut", "tank", "tanks"],
  ["engin de chantier", "engins de chantier", "excavator", "bulldozer", "construction equipment"],
  ["adventure", "trail", "aventure"],
  ["ancienne", "ancien", "anciennes", "vintage", "classic", "classique", "collection"],
  ["complete", "complet", "full", "entire"],
  ["vitesse", "speed", "fast", "fastest"],
  ["securite", "safety"],
  ["accident", "crash", "incident"],
  ["superyacht", "yacht", "yachts", "megayacht"],
];

export const STOPWORDS = new Set([
  "le", "la", "les", "de", "des", "du", "d", "un", "une", "et", "en", "a", "au", "aux", "pour", "sur", "avec", "dans", "par", "l",
  "est", "ce", "cette", "ces", "qui", "que", "quoi", "quel", "quelle", "son", "sa", "ses", "mon", "ma", "mes", "plus", "tres", "y",
  "the", "an", "of", "to", "in", "on", "for", "with", "is", "what", "and", "or", "my", "your", "this", "that", "are", "be", "it",
  "video", "videos", "comment", "how", "why", "pourquoi", "do", "does",
]);

const groups = SYNONYM_GROUPS.map((g) => g.map(normalize));
const phrases = [...new Set(groups.flat().filter((p) => p.includes(" ")))].sort((a, b) => b.length - a.length);

/** Groupes « d'intention » : ils précisent la demande sans en être l'objet (renforcent le classement). */
const MODIFIER_HEADS = ["fonctionnement", "essai", "comparatif", "documentaire", "histoire", "construction", "complete", "ancienne", "vitesse", "usine", "entretien", "reparation"];
const modifierWords = new Set(groups.filter((g) => MODIFIER_HEADS.includes(g[0])).flat());

/** Vocabulaire du dictionnaire (utile à la correction orthographique des mots français). */
export const DICTIONARY_WORDS = [...new Set(groups.flat().flatMap((p) => p.split(" ")).filter((w) => w.length >= 4))];

export type QueryTerm = { term: string; alternatives: string[]; modifier?: boolean };

/** Découpe une requête en termes significatifs, chacun avec ses équivalents FR/EN. */
export function analyzeQuery(q: string): QueryTerm[] {
  let rest = ` ${normalize(q)} `;
  const terms: QueryTerm[] = [];
  for (const p of phrases) {
    if (rest.includes(` ${p} `)) {
      rest = rest.split(` ${p} `).join(" ");
      terms.push({ term: p, alternatives: alternativesFor(p), modifier: modifierWords.has(p) });
    }
  }
  for (const tok of rest.trim().split(/\s+/)) {
    if (!tok || STOPWORDS.has(tok) || (tok.length < 2 && !/\d/.test(tok))) continue;
    if (terms.some((t) => t.term === tok)) continue;
    terms.push({ term: tok, alternatives: alternativesFor(tok), modifier: modifierWords.has(tok) });
  }
  return terms.slice(0, 10);
}

export function alternativesFor(term: string): string[] {
  const out = new Set([term]);
  for (const g of groups) if (g.includes(term)) for (const x of g) out.add(x);
  return [...out];
}
