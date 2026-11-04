import { fetchJson, recordUsage } from "./http";

/**
 * Résolution d'identifiants de chaînes YouTube via Wikidata (propriété P2397),
 * point d'accès SPARQL public. Utilisé uniquement pour amorcer les sources ;
 * chaque identifiant est ensuite vérifié auprès de YouTube.
 */

type Binding = { item: { value: string }; name: { value: string }; cid: { value: string }; sl?: { value: string } };

async function sparql(query: string): Promise<Binding[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const r = await fetchJson<{ results: { bindings: Binding[] } }>(url, {
    headers: { Accept: "application/sparql-results+json" },
    timeoutMs: 60000,
  });
  await recordUsage("wikidata", { requests: 1 });
  return r.results.bindings;
}

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** Nom exact (libellé anglais) → identifiants de chaîne candidats, triés par notoriété. */
export async function channelIdsByName(names: string[]): Promise<Map<string, { channelId: string; wikidataId: string }[]>> {
  const out = new Map<string, { channelId: string; wikidataId: string }[]>();
  for (let i = 0; i < names.length; i += 25) {
    const chunk = names.slice(i, i + 25);
    const values = chunk.map((n) => `"${escape(n)}"@en`).join(" ");
    const q = `SELECT ?item ?name ?cid ?sl WHERE { VALUES ?name { ${values} } ?item rdfs:label|skos:altLabel ?name ; wdt:P2397 ?cid . OPTIONAL { ?item wikibase:sitelinks ?sl } }`;
    for (const b of await sparql(q)) {
      const list = out.get(b.name.value) ?? [];
      list.push({ channelId: b.cid.value, wikidataId: b.item.value.split("/").pop()!, ...(b.sl ? {} : {}) });
      out.set(b.name.value, list);
    }
  }
  return out;
}
