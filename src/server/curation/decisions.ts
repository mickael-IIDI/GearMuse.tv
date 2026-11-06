import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { editorialReviews, videos } from "@/db/schema";

/**
 * Décisions éditoriales sur des vidéos, partagées par l'administration (décision humaine)
 * et les revues assistées (scripts). Chaque décision est historisée dans editorial_reviews ;
 * approbation, rejet et exclusion verrouillent le statut (le pipeline ne le modifie plus).
 */
export type EditorialDecision = "approve" | "reject" | "exclude" | "unlock" | "feature" | "unfeature" | "keep";

export type DecisionItem = { id: number; decision: EditorialDecision; note?: string | null };

export type DecisionContext = {
  /** Préfixe du motif de statut, ex. « editor » ou « Revue assistée (Claude Code, 2026-11-06) ». */
  label: string;
  adminUserId: number | null;
  /** Appelée pour chaque vidéo modifiée (journal d'audit). */
  onApplied?: (id: number, decision: EditorialDecision, before: unknown, patch: unknown) => Promise<void>;
};

const VERB: Record<EditorialDecision, string> = {
  approve: "approuvée",
  reject: "refusée",
  exclude: "exclue",
  unlock: "rendue au pipeline automatique",
  feature: "mise en avant",
  unfeature: "retirée de la sélection",
  keep: "laissée en attente",
};

export async function applyEditorialDecisions(items: DecisionItem[], ctx: DecisionContext): Promise<Record<EditorialDecision, number>> {
  const db = await getDb();
  const counts = { approve: 0, reject: 0, exclude: 0, unlock: 0, feature: 0, unfeature: 0, keep: 0 } satisfies Record<EditorialDecision, number>;
  for (const it of items) {
    const now = new Date();
    const before = await db.query.videos.findFirst({ where: eq(videos.id, it.id), columns: { status: true, editorialPick: true, statusLocked: true, publishedOnSiteAt: true, statusReason: true } });
    if (!before) continue;
    const reason = `${ctx.label} : ${VERB[it.decision]}${it.note ? ` — ${it.note}` : ""}`;
    const patch: Partial<typeof videos.$inferInsert> =
      it.decision === "approve"
        ? { status: "published", statusLocked: true, statusReason: reason, statusChangedAt: now, publishedOnSiteAt: before.publishedOnSiteAt ?? now }
        : it.decision === "reject"
          ? { status: "rejected", statusLocked: true, statusReason: reason, statusChangedAt: now }
          : it.decision === "exclude"
            ? { status: "excluded", statusLocked: true, statusReason: reason, statusChangedAt: now }
            : it.decision === "unlock"
              ? { statusLocked: false, needsReanalysis: true, statusReason: reason }
              : it.decision === "feature"
                ? { editorialPick: true }
                : it.decision === "unfeature"
                  ? { editorialPick: false }
                  : { statusReason: reason };
    await db.update(videos).set({ ...patch, updatedAt: now }).where(eq(videos.id, it.id));
    await db.insert(editorialReviews).values({
      videoId: it.id,
      adminUserId: ctx.adminUserId,
      decision: it.decision === "unlock" || it.decision === "keep" ? "edit" : it.decision,
      notes: `${ctx.label}${it.note ? ` — ${it.note}` : ""}`,
    });
    if (ctx.onApplied) await ctx.onApplied(it.id, it.decision, before, patch);
    counts[it.decision]++;
  }
  return counts;
}
