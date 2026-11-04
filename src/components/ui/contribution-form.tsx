"use client";

import { useState } from "react";

type Field = { name: string; label: string; type?: "text" | "url" | "textarea" | "select"; required?: boolean; options?: [string, string][]; placeholder?: string; defaultValue?: string };

/** Formulaire public générique (proposition / signalement) avec retour d'état accessible. */
export function ContributionForm({ kind, fields, submitLabel, successText }: { kind: "suggestion" | "report"; fields: Field[]; submitLabel: string; successText: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const input = "w-full rounded-xl border border-line bg-elev px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--focus)]";

  if (state === "done") return <p role="status" className="rounded-xl border border-line bg-elev p-5 text-[15px]">{successText}</p>;

  return (
    <form
      className="flex max-w-2xl flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError("");
        const data = Object.fromEntries(new FormData(e.currentTarget).entries());
        try {
          const r = await fetch("/api/contributions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, kind }) });
          const j = (await r.json()) as { ok?: boolean; error?: string };
          if (!r.ok || !j.ok) throw new Error(j.error || "Erreur");
          setState("done");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
          setState("error");
        }
      }}
    >
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1.5 text-sm font-medium">
          {f.label}
          {f.type === "textarea" ? (
            <textarea name={f.name} required={f.required} rows={5} placeholder={f.placeholder} defaultValue={f.defaultValue} className={input} />
          ) : f.type === "select" ? (
            <select name={f.name} required={f.required} defaultValue={f.defaultValue} className={input}>
              {f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : (
            <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} defaultValue={f.defaultValue} className={input} />
          )}
        </label>
      ))}
      {/* Champ piège invisible pour les robots */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state === "error" && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="self-start rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60">
        {state === "sending" ? "Envoi…" : submitLabel}
      </button>
    </form>
  );
}
