/**
 * Liens affiliés : des liens de recherche chez un marchand, construits à partir du nom
 * d'une marque ou d'un modèle. Aucun script, image ni cookie tiers n'est chargé sur le site :
 * le suivi commence chez le marchand, après le clic.
 *
 * Un programme sans identifiant valide est désactivé ; sans aucun programme, rien ne s'affiche.
 * Les identifiants viennent des variables d'environnement (voir .env.example).
 */

export type AffiliateProgram = "amazon" | "ebay";
export type AffiliateKind = "scale" | "books" | "parts" | "collectibles";

export type AffiliateEnv = {
  AFFILIATE_AMAZON_TAG?: string;
  AFFILIATE_EBAY_CAMPAIGN_ID?: string;
};

export type AffiliateLink = {
  program: AffiliateProgram;
  kind: AffiliateKind;
  /** Nom du marchand tel qu'il est affiché. */
  merchant: string;
  href: string;
};

export type AffiliateSubject = {
  /** Nom affiché de la marque ou du modèle (ex. « Porsche 911 »). */
  name: string;
  /** Marque du modèle, ajoutée à la recherche si le nom ne la contient pas déjà. */
  brand?: string;
  /** Univers concernés (slugs de catégories). Un seul univers permet des offres plus précises. */
  universes?: string[];
};

const MERCHANTS: Record<AffiliateProgram, string> = { amazon: "Amazon", ebay: "eBay" };

/** Univers où chercher des pièces détachées a un sens pour un particulier. */
const PARTS_UNIVERSES = new Set(["automobile", "moto"]);

/**
 * Identifiant de rotation eBay Partner Network pour ebay.fr (et identifiant de site associé).
 * À comparer avec un lien produit par le générateur de liens d'eBay avant l'activation.
 */
const EBAY_FR_ROTATION = "709-53476-19255-0";
const EBAY_FR_SITE = "71";

const AMAZON_TAG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/i;
const EBAY_CAMPAIGN = /^\d{5,15}$/;

/** Identifiants valides uniquement : une valeur vide ou mal formée désactive le programme. */
export function affiliateIds(env: AffiliateEnv): Partial<Record<AffiliateProgram, string>> {
  const amazon = env.AFFILIATE_AMAZON_TAG?.trim();
  const ebay = env.AFFILIATE_EBAY_CAMPAIGN_ID?.trim();
  return {
    ...(amazon && AMAZON_TAG.test(amazon) ? { amazon } : {}),
    ...(ebay && EBAY_CAMPAIGN.test(ebay) ? { ebay } : {}),
  };
}

/** Variables lues côté serveur uniquement (elles ne sont pas exposées au navigateur). */
export function serverAffiliateEnv(): AffiliateEnv {
  return { AFFILIATE_AMAZON_TAG: process.env.AFFILIATE_AMAZON_TAG, AFFILIATE_EBAY_CAMPAIGN_ID: process.env.AFFILIATE_EBAY_CAMPAIGN_ID };
}

export function affiliateEnabled(env: AffiliateEnv): boolean {
  return Object.keys(affiliateIds(env)).length > 0;
}

/** Termes de recherche : « marque modèle », sans répéter la marque, bornés à 80 caractères. */
export function affiliateQuery(subject: Pick<AffiliateSubject, "name" | "brand">): string {
  const name = subject.name.replace(/\s+/g, " ").trim();
  const brand = subject.brand?.replace(/\s+/g, " ").trim();
  const full = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
  return full.slice(0, 80).trim();
}

function amazonSearch(query: string, tag: string): string {
  return `https://www.amazon.fr/s?${new URLSearchParams({ k: query, tag })}`;
}

function ebaySearch(query: string, campaignId: string): string {
  const params = new URLSearchParams({ _nkw: query, mkcid: "1", mkrid: EBAY_FR_ROTATION, siteid: EBAY_FR_SITE, campid: campaignId, toolid: "10001", mkevt: "1" });
  return `https://www.ebay.fr/sch/i.html?${params}`;
}

/** Liens à afficher pour une marque ou un modèle ; liste vide si aucun programme n'est actif. */
export function affiliateLinks(subject: AffiliateSubject, env: AffiliateEnv): AffiliateLink[] {
  const ids = affiliateIds(env);
  const query = affiliateQuery(subject);
  if (!query) return [];
  const universe = subject.universes?.length === 1 ? subject.universes[0] : undefined;
  const road = universe != null && PARTS_UNIVERSES.has(universe);
  const links: AffiliateLink[] = [];
  if (ids.amazon) {
    links.push({ program: "amazon", kind: "scale", merchant: MERCHANTS.amazon, href: amazonSearch(`${query} ${road ? "miniature" : "maquette"}`, ids.amazon) });
    links.push({ program: "amazon", kind: "books", merchant: MERCHANTS.amazon, href: amazonSearch(`${query} livre`, ids.amazon) });
  }
  if (ids.ebay) {
    links.push(
      road
        ? { program: "ebay", kind: "parts", merchant: MERCHANTS.ebay, href: ebaySearch(`${query} pièces`, ids.ebay) }
        : { program: "ebay", kind: "collectibles", merchant: MERCHANTS.ebay, href: ebaySearch(query, ids.ebay) },
    );
  }
  return links;
}
