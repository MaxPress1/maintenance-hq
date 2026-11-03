"use client";

import React, { useActionState, useRef } from "react";
import { addWorkOrderCommentAction, type ActionState } from "./actions";
import { type WorkOrderComment } from "./schema";
import { formatDate } from "@/lib/dates";

interface Props {
  workOrderId: string;
  comments: WorkOrderComment[];
}

const initialState: ActionState = {};

export function CommentsSection({ workOrderId, comments }: Props) {
  const [state, formAction, isPending] = useActionState(addWorkOrderCommentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="card stack">
      <h3 className="font-semibold text-lg m-0">Коментарі та переписка ({comments.length})</h3>

      <div className="stack">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Коментарів поки немає.</p>
        ) : (
          <ul className="record-list">
            {comments.map((comment) => (
              <li key={comment.id} className="history-entry">
                <div className="flex justify-between items-center mb-1 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {comment.author?.display_name || "Користувач"}
                  </span>
                  <span>{formatDate(comment.created_at)}</span>
                </div>
                <p className="text-sm pre-wrap m-0">{comment.content}</p>
              </li>
            ))}
          </ul>
        )}

        <form
          ref={formRef}
          action={async (formData) => {
            await formAction(formData);
            if (formRef.current) {
              formRef.current.reset();
            }
          }}
          className="stack mt-2"
        >
          <input type="hidden" name="work_order_id" value={workOrderId} />

          {state?.error && <div className="notice notice-error">{state.error}</div>}

          <div className="field">
            <label htmlFor="comment-content">Додати коментар</label>
            <textarea
              id="comment-content"
              name="content"
              required
              rows={2}
              placeholder="Напишіть повідомлення або запитання..."
            />
            {state?.fieldErrors?.content && (
              <p className="text-xs text-red-600">{state.fieldErrors.content[0]}</p>
            )}
          </div>

          <div className="button-row">
            <button type="submit" disabled={isPending} className="button button-secondary">
              {isPending ? "Надсилання..." : "Надіслати коментар"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
