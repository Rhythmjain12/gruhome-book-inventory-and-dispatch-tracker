// Detail modal opened from each row in the staff "My dispatches" tab.
// Shows per-book status with checkboxes for books still Out in Field,
// so the salesperson can request a recall of specific books (or all).
//
// Admin must still confirm in the dashboard before the books actually
// flip to Recalled — see worker/routes/requestRecall.ts.

import { useEffect, useState } from "react";
import type { Dispatch } from "../types";
import { api, ApiError } from "../lib/api";
import {
  Alert,
  Button,
  Modal,
  StatusBadge,
} from "../components/primitives";

interface Props {
  open: boolean;
  dispatch: Dispatch | null;
  onClose: () => void;
  onRequested: () => void;
}

export function StaffDispatchModal({ open, dispatch, onClose, onRequested }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset on dispatch change.
  useEffect(() => {
    setSelected(new Set());
    setBusy(false);
    setError(null);
    setSuccess(null);
  }, [dispatch?.dispatchId]);

  if (!dispatch) return <Modal open={open} onClose={onClose} title="">{null}</Modal>;

  const recallable = dispatch.books.filter((b) => b.status === "Out in Field");
  const hasRecallable = recallable.length > 0;

  function toggle(bookId: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

  async function submit() {
    if (!dispatch || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.requestRecall(dispatch.dispatchId, Array.from(selected));
      setSuccess(
        `Recall requested for ${res.updated} book${res.updated === 1 ? "" : "s"}. The manager will confirm shortly.`
      );
      setSelected(new Set());
      onRequested();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't request recall.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dispatch.clientName}
      footer={
        hasRecallable ? (
          <Button
            variant="primary"
            disabled={busy || selected.size === 0}
            onClick={submit}
          >
            {busy
              ? "Requesting…"
              : `Request recall (${selected.size}/${recallable.length})`}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        )
      }
    >
      {error && <Alert variant="red">{error}</Alert>}
      {success && <Alert variant="green">{success}</Alert>}

      <div style={{ marginBottom: 12 }}>
        <StatusBadge status={dispatch.status} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Store
          </div>
          <div style={{ fontSize: 14 }}>{dispatch.store}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Return by
          </div>
          <div style={{ fontSize: 14 }}>{dispatch.returnBy}</div>
        </div>
      </div>

      <h3 style={{ marginTop: 14, marginBottom: 8, fontSize: 15 }}>
        Books ({dispatch.books.length})
      </h3>

      {hasRecallable && (
        <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 10 }}>
          Tick any books that are physically back. The manager will confirm
          and mark them recalled in Notion.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {dispatch.books.map((b, i) => {
          const canRequest = b.status === "Out in Field";
          const isChecked = selected.has(b.bookId);
          return (
            <label
              key={`${b.bookId}|${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: canRequest ? "auto 1fr auto" : "1fr auto",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: "var(--sand-dark)",
                borderRadius: "var(--radius)",
                cursor: canRequest ? "pointer" : "default",
              }}
            >
              {canRequest && (
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(b.bookId)}
                  disabled={busy}
                />
              )}
              <div>
                <div style={{ fontWeight: 500 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {b.category}
                  {b.recalledAt && ` · recalled ${new Date(b.recalledAt).toLocaleDateString()}`}
                </div>
              </div>
              <StatusBadge status={b.status} />
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
