import Link from "next/link";

/** Petits composants d'interface du back-office (serveur). */

export function Card({ title, children, actions, className = "" }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-elev p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-display text-[16px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-line bg-elev p-4 transition-colors hover:border-faint">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const STATUS: Record<string, [string, string]> = {
  published: ["Publiée", "bg-success/15 text-success"],
  pending_review: ["À valider", "bg-accent-soft text-accent"],
  discovered: ["Découverte", "bg-soft text-muted"],
  rejected: ["Rejetée", "bg-soft text-faint"],
  excluded: ["Exclue", "bg-danger/15 text-danger"],
  unavailable: ["Indisponible", "bg-danger/15 text-danger"],
  succeeded: ["Réussie", "bg-success/15 text-success"],
  running: ["En cours", "bg-accent-soft text-accent"],
  failed: ["Échec", "bg-danger/15 text-danger"],
  queued: ["En file", "bg-soft text-muted"],
  open: ["Ouvert", "bg-accent-soft text-accent"],
  resolved: ["Traité", "bg-success/15 text-success"],
  dismissed: ["Sans suite", "bg-soft text-faint"],
  pending: ["En attente", "bg-accent-soft text-accent"],
  imported: ["Importée", "bg-success/15 text-success"],
  draft: ["Brouillon", "bg-soft text-muted"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, "bg-soft text-muted"];
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50";
export const btnPrimary = `${btn} bg-accent text-accent-ink hover:opacity-90`;
export const btnGhost = `${btn} border border-line hover:bg-hover`;
export const btnDanger = `${btn} border border-danger/40 text-danger hover:bg-danger/10`;
export const input = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-[var(--focus)]";
export const th = "border-b border-line px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-faint";
export const td = "border-b border-line/60 px-3 py-2 align-top text-[13.5px]";

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
