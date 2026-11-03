"use client";

import { useActionState, useId } from "react";

export type ActionState = { error?: string; success?: string };
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({ action, children, submitLabel, className = "stack", confirmMessage }: {
  action: FormAction;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const feedbackId = useId();
  return (
    <form action={formAction} className={className} aria-describedby={feedbackId}
      onSubmit={(event) => {
        if (pending || (confirmMessage && !window.confirm(confirmMessage))) event.preventDefault();
      }}>
      <fieldset disabled={pending} className="form-fields">{children}</fieldset>
      <div id={feedbackId} aria-live="polite">
        {state.error && <p role="alert" className="notice notice-error">{state.error}</p>}
        {state.success && <p role="status" className="notice">{state.success}</p>}
      </div>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Збереження…" : submitLabel}
      </button>
    </form>
  );
}