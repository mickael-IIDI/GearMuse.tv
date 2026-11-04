"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { IconSearch, IconX } from "@/components/icons";

type Suggestion = { type: "category" | "subcategory" | "brand" | "model" | "video" | "query"; label: string; sub?: string; href: string };

export function SearchBox() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = pathname === "/recherche" ? params.get("q") ?? "" : "";
  const [q, setQ] = useState(urlQ);
  const [syncedQ, setSyncedQ] = useState(urlQ);
  // Resynchronise le champ quand la requête de l'URL change (navigation), sans effet.
  if (pathname === "/recherche" && urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setQ(urlQ);
  }
  const [fetched, setFetched] = useState<{ term: string; items: Suggestion[] }>({ term: "", items: [] });
  const items = q.trim().length >= 2 && fetched.term === q.trim() ? fetched.items : [];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const reqId = useRef(0);

  // Raccourci « / » pour placer le curseur dans la recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`);
        if (!r.ok || id !== reqId.current) return;
        const j = (await r.json()) as { items: Suggestion[] };
        setFetched({ term, items: j.items });
        setActive(-1);
      } catch {
        /* réseau indisponible : pas de suggestions */
      }
    }, 140);
    return () => clearTimeout(timer);
  }, [q]);

  const submit = (value: string) => {
    const term = value.trim();
    if (!term) return;
    setOpen(false);
    inputRef.current?.blur();
    // Conserve les filtres actifs d'une page de liste (comme sur HackerTube).
    const keep = new URLSearchParams();
    for (const k of ["date", "duree", "format", "techno", "langue", "qualite", "univers"]) {
      const v = params.get(k);
      if (v) keep.set(k, v);
    }
    keep.set("q", term);
    router.push(`/recherche?${keep.toString()}`);
  };

  const go = (s: Suggestion) => {
    setOpen(false);
    if (s.type === "query") submit(s.label);
    else router.push(s.href);
  };

  return (
    <form
      role="search"
      className="relative flex w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && items[active]) go(items[active]);
        else submit(q);
      }}
    >
      <div className="relative flex min-w-0 flex-1 items-center rounded-l-full border border-line bg-elev focus-within:border-[var(--focus)]">
        <span className="pl-4 text-faint max-sm:hidden"><IconSearch size={18} /></span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          type="search"
          name="q"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={t.search.placeholder}
          aria-label={t.search.button}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="h-10 w-full min-w-0 bg-transparent px-3 text-[15px] outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" aria-label="Effacer" className="mr-2 grid size-7 place-items-center rounded-full text-muted hover:bg-hover" onClick={() => { setQ(""); inputRef.current?.focus(); }}>
            <IconX size={16} />
          </button>
        )}
      </div>
      <button type="submit" aria-label={t.search.button} className="grid h-10 w-14 shrink-0 place-items-center rounded-r-full border border-l-0 border-line bg-soft hover:bg-hover">
        <IconSearch size={19} />
      </button>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-14 top-11 z-50 overflow-hidden rounded-xl border border-line bg-elev py-2 shadow-[var(--shadow)]">
          {items.map((s, i) => (
            <li
              key={`${s.type}-${s.href}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? "bg-hover" : ""}`}
            >
              <span className="text-faint"><IconSearch size={15} /></span>
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.sub && <span className="shrink-0 text-xs text-faint">{s.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
