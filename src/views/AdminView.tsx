// Admin dashboard. Approvers see the full set of dispatches across all
// salespeople and both stores, with metric tiles, filter pills, and a
// click-through detail modal for approve / reject / recall actions.

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Dispatch, Store } from "../types";
import {
  Alert,
  Button,
  Initials,
  MetricTile,
  Modal,
  Pill,
  StatusBadge,
} from "../components/primitives";

interface Props {
  approver: string;
  onSignOut: () => void;
  onLock: () => void;
}

type StatusFilter = "all-active" | "pending" | "overdue" | "out" | "recalled";

const STATUS_FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: "all-active", label: "All active" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
  { key: "out", label: "In field" },
  { key: "recalled", label: "Recalled" },
];

const STORE_FILTERS: ReadonlyArray<Store | "All"> = ["All", "Preet Vihar", "Noida"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(d: Dispatch, today: string): boolean {
  return d.status === "Out in Field" && d.returnBy < today;
}

function borderForRow(d: Dispatch, today: string): string {
  if (isOverdue(d, today)) return "var(--red)";
  if (d.status === "Pending Approval") return "var(--amber)";
  if (d.status === "Out in Field") return "var(--blue)";
  if (d.status === "Recalled") return "var(--green)";
  return "var(--border-strong)";
}

export function AdminView({ approver, onSignOut, onLock }: Props) {
  const [items, setItems] = useState<Dispatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all-active");
  const [storeFilter, setStoreFilter] = useState<Store | "All">("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function refresh() {
    setItems(null);
    setError(null);
    api
      .getBooks()
      .then(setItems)
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : String(e));
        setItems([]);
      });
  }

  useEffect(() => {
    refresh();
  }, []);

  const today = todayIso();

  const metrics = useMemo(() => {
    if (!items) return { out: 0, books: 0, overdue: 0, pending: 0 };
    let out = 0,
      books = 0,
      overdue = 0,
      pending = 0;
    for (const d of items) {
      if (d.status === "Out in Field") {
        out++;
        books += d.books.length;
        if (isOverdue(d, today)) overdue++;
      }
      if (d.status === "Pending Approval") pending++;
    }
    return { out, books, overdue, pending };
  }, [items, today]);

  const visible = useMemo(() => {
    if (!items) return [];
    return items.filter((d) => {
      if (storeFilter !== "All" && d.store !== storeFilter) return false;
      switch (statusFilter) {
        case "pending":
          return d.status === "Pending Approval";
        case "out":
          return d.status === "Out in Field" && !isOverdue(d, today);
        case "overdue":
          return isOverdue(d, today);
        case "recalled":
          return d.status === "Recalled";
        case "all-active":
        default:
          return d.status !== "Rejected";
      }
    });
  }, [items, statusFilter, storeFilter, today]);

  const openItem = useMemo(
    () => (openId ? items?.find((d) => d.dispatchId === openId) ?? null : null),
    [openId, items]
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 14, color: "var(--ink-2)" }}>
          Viewing as <strong style={{ color: "var(--ink)" }}>{approver}</strong>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button variant="ghost" onClick={onSignOut}>
            Not you?
          </Button>
          <Button variant="ghost" onClick={onLock} title="Clear PIN and lock">
            Lock
          </Button>
        </div>
      </div>

      {error && <Alert variant="red">{error}</Alert>}

      {metrics.pending > 0 && (
        <Alert variant="amber">
          {metrics.pending} dispatch{metrics.pending === 1 ? "" : "es"} waiting
          for approval. Open one to action it.
        </Alert>
      )}

      <div
        className="metric-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <MetricTile label="Dispatches out" value={metrics.out} tone="blue" />
        <MetricTile label="Books in field" value={metrics.books} />
        <MetricTile label="Overdue" value={metrics.overdue} tone={metrics.overdue ? "red" : "default"} />
        <MetricTile label="Pending" value={metrics.pending} tone={metrics.pending ? "amber" : "default"} />
      </div>

      <div className="pill-row" style={{ marginBottom: 10 }}>
        {STATUS_FILTERS.map((f) => (
          <Pill
            key={f.key}
            active={statusFilter === f.key}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </Pill>
        ))}
      </div>
      <div className="pill-row" style={{ marginBottom: 18 }}>
        {STORE_FILTERS.map((s) => (
          <Pill
            key={s}
            active={storeFilter === s}
            onClick={() => setStoreFilter(s)}
          >
            {s === "All" ? "All stores" : s}
          </Pill>
        ))}
      </div>

      {items === null && !error && (
        <div style={{ color: "var(--ink-3)", padding: 24 }}>Loading…</div>
      )}

      {items !== null && visible.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--ink-3)" }}>
          Nothing in this view.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((d) => (
          <DispatchRow
            key={d.dispatchId}
            dispatch={d}
            today={today}
            onClick={() => setOpenId(d.dispatchId)}
          />
        ))}
      </div>

      <DispatchDetailModal
        open={openItem !== null}
        dispatch={openItem}
        approver={approver}
        onClose={() => setOpenId(null)}
        onChanged={(message) => {
          setOpenId(null);
          setToast(message);
          refresh();
        }}
      />

      {toast && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

function DispatchRow({
  dispatch,
  today,
  onClick,
}: {
  dispatch: Dispatch;
  today: string;
  onClick: () => void;
}) {
  const overdue = isOverdue(dispatch, today);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        padding: "14px 18px",
        borderLeft: `4px solid ${borderForRow(dispatch, today)}`,
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        background: "var(--white)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 14,
          alignItems: "center",
        }}
      >
        <Initials name={dispatch.clientName} />
        <div>
          <div style={{ fontWeight: 500 }}>{dispatch.clientName}</div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {dispatch.salesperson} · {dispatch.store} · {dispatch.books.length} book
            {dispatch.books.length === 1 ? "" : "s"}
            {dispatch.purpose && ` · ${dispatch.purpose}`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <StatusBadge status={dispatch.status} overdue={overdue} />
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            return {dispatch.returnBy}
          </div>
        </div>
      </div>
    </button>
  );
}

interface ModalProps {
  open: boolean;
  dispatch: Dispatch | null;
  approver: string;
  onClose: () => void;
  onChanged: (message: string) => void;
}

function DispatchDetailModal({ open, dispatch, approver, onClose, onChanged }: ModalProps) {
  const [busy, setBusy] = useState<"approve" | "reject" | "recall" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset error/busy whenever the modal opens a different dispatch.
  useEffect(() => {
    setError(null);
    setBusy(null);
  }, [dispatch?.dispatchId]);

  if (!dispatch) return <Modal open={open} onClose={onClose} title="">{null}</Modal>;

  const today = todayIso();
  const overdue = isOverdue(dispatch, today);

  async function action(kind: "approve" | "reject") {
    if (!dispatch) return;
    setBusy(kind);
    setError(null);
    try {
      const result = await api.approveBook(dispatch.dispatchId, kind, approver);
      if (result.alreadyActioned) {
        onChanged(`Already actioned by ${result.actionedBy ?? "another approver"}.`);
      } else {
        onChanged(kind === "approve" ? "Approved." : "Rejected.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function recall() {
    if (!dispatch) return;
    setBusy("recall");
    setError(null);
    try {
      await api.recallBook(dispatch.dispatchId, approver);
      onChanged("Marked recalled.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dispatch.clientName}
      footer={
        <>
          {dispatch.status === "Pending Approval" && (
            <>
              <Button variant="danger" disabled={busy !== null} onClick={() => action("reject")}>
                {busy === "reject" ? "Rejecting…" : "Reject"}
              </Button>
              <Button variant="success" disabled={busy !== null} onClick={() => action("approve")}>
                {busy === "approve" ? "Approving…" : "Approve"}
              </Button>
            </>
          )}
          {dispatch.status === "Out in Field" && (
            <Button variant="primary" disabled={busy !== null} onClick={recall}>
              {busy === "recall" ? "Recalling…" : "Mark all books recalled"}
            </Button>
          )}
        </>
      }
    >
      {error && <Alert variant="red">{error}</Alert>}

      <div style={{ marginBottom: 12 }}>
        <StatusBadge status={dispatch.status} overdue={overdue} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <DetailRow label="Salesperson" value={dispatch.salesperson} />
        <DetailRow label="Store" value={dispatch.store} />
        <DetailRow label="Phone" value={dispatch.clientPhone} />
        <DetailRow label="Return by" value={dispatch.returnBy} />
      </div>
      <DetailRow label="Address" value={dispatch.clientAddress} />
      {dispatch.purpose && <DetailRow label="Purpose" value={dispatch.purpose} />}
      {dispatch.approvedBy && (
        <DetailRow
          label="Approved by"
          value={`${dispatch.approvedBy}${dispatch.approvedAt ? ` · ${new Date(dispatch.approvedAt).toLocaleString()}` : ""}`}
        />
      )}

      <h3 style={{ marginTop: 16, marginBottom: 10, fontSize: 16 }}>
        Books ({dispatch.books.length})
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {dispatch.books.map((b, i) => (
          <div
            key={`${b.bookId}|${i}`}
            style={{
              padding: "8px 12px",
              background: "var(--sand-dark)",
              borderRadius: "var(--radius)",
            }}
          >
            <div style={{ fontWeight: 500 }}>{b.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{b.category}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 3500);
    return () => clearTimeout(id);
  }, [onDismiss]);
  return <div className="toast">{message}</div>;
}
