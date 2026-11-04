"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/admin/actions";

/** Formulaire d'administration avec retour d'état (succès / erreur) accessible. */
export function ActionForm({
  action,
  children,
  className = "",
  submitLabel = "Enregistrer",
  pendingLabel = "En cours…",
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
          {pending ? pendingLabel : submitLabel}
        </button>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state?.message && <p role="status" className="text-sm text-success">{state.message}</p>}
      </div>
    </form>
  );
}
