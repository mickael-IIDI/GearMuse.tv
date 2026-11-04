import Link from "next/link";

export function PageHeader({ title, subtitle, crumbs, children }: { title: string; subtitle?: React.ReactNode; crumbs?: { href: string; label: string }[]; children?: React.ReactNode }) {
  return (
    <header className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Fil d'Ariane" className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-faint">/</span>}
              <Link href={c.href} className="hover:text-fg">{c.label}</Link>
            </span>
          ))}
        </nav>
      )}
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
      {subtitle && <div className="mt-1.5 max-w-3xl text-[15px] text-muted">{subtitle}</div>}
      {children}
    </header>
  );
}

export function Chips({ items }: { items: { href: string; label: string; active?: boolean; count?: number }[] }) {
  if (!items.length) return null;
  return (
    <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          aria-current={c.active ? "page" : undefined}
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium ${c.active ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-text)]" : "bg-soft hover:bg-hover"}`}
        >
          {c.label}
          {c.count != null && <span className={`text-xs ${c.active ? "opacity-70" : "text-faint"}`}>{c.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-xl text-sm text-muted">{children}</div>}
    </div>
  );
}
