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
import { SettingsView } from "./SettingsView";
import { ShareButton } from "../components/ShareButton";
import type { ShareAction, ShareSubject } from "../lib/share";

interface Props {
  approver: string;
  onSignOut: () => void;
  onLock: () => void;
}

type StatusFilter = "all-active" | "pending" | "overdue" | "out" | "recall-pending" | "recalled";

const STATUS_FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: "all-active", label: "All active" },
  { key: "pending", label: "Pending approval" },
  { key: "recall-pending", label: "Recall pending" },
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
  if (d.status === "Recall Requested") return "var(--amber)";
  if (d.status === "Out in Field") return "var(--blue)";
  if (d.status === "Partially Recalled") return "var(--blue)";
  if (d.status === "Recalled") return "var(--green)";
  return "var(--border-strong)";
}

type AdminTab = "dashboard" | "settings";

export function AdminView({ approver, onSignOut, onLock }: Props) {
  const [tab, setTab] = useState<AdminTab>("dashboard");
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
      // "Out" tile counts dispatches with books still physically out:
      // pure Out in Field, Partially Recalled, and Recall Requested
      // (the request hasn't been actioned yet so books are still out).
      if (
        d.status === "Out in Field" ||
        d.status === "Partially Recalled" ||
        d.status === "Recall Requested"
      ) {
        out++;
        // Only the books still Out are counted in the books-in-field tile.
        books += d.books.filter((b) => b.status !== "Recalled").length;
        if (isOverdue(d, today)) overdue++;
      }
      // "Action needed" rolls up new dispatches awaiting approval AND
      // recall requests awaiting confirmation.
      if (d.status === "Pending Approval" || d.status === "Recall Requested") {
        pending++;
      }
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
        case "recall-pending":
          return d.status === "Recall Requested";
        case "out":
          return (
            (d.status === "Out in Field" || d.status === "Partially Recalled") &&
            !isOverdue(d, today)
          );
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

      <div className="pill-row" style={{ marginBottom: 18 }}>
        <Pill active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
          Dashboard
        </Pill>
        <Pill active={tab === "settings"} onClick={() => setTab("settings")}>
          Settings
        </Pill>
      </div>

      {tab === "settings" ? (
        <SettingsView />
      ) : (
        <>
          {error && <Alert variant="red">{error}</Alert>}

          {metrics.pending > 0 && (
            <Alert variant="amber">
              {metrics.pending} item{metrics.pending === 1 ? "" : "s"} need
              your attention (new approvals or recall requests). Open a row
              to action.
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
            <MetricTile label="Action needed" value={metrics.pending} tone={metrics.pending ? "amber" : "default"} />
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
        </>
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

interface ActionResult {
  action: ShareAction;
  alreadyActioned?: boolean;
  actionedBy?: string;
}

const ACTION_HEADLINE: Record<ShareAction, { title: string; tone: "green" | "red" | "amber" }> = {
  submitted: { title: "Submitted", tone: "green" },
  approved: { title: "Approved ✓", tone: "green" },
  rejected: { title: "Rejected ✕", tone: "red" },
  recalled: { title: "Recalled ↩", tone: "amber" },
};

function DispatchDetailModal({ open, dispatch, approver, onClose, onChanged }: ModalProps) {
  const [busy, setBusy] = useState<"approve" | "reject" | "recall" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  // Per-book recall selection. Pre-populates with any books staff has
  // already requested for recall — admin just confirms or adjusts.
  const [selectedToRecall, setSelectedToRecall] = useState<Set<string>>(new Set());

  // Reset state whenever the modal opens a different dispatch.
  useEffect(() => {
    setError(null);
    setBusy(null);
    setResult(null);
    setSelectedToRecall(
      new Set(
        (dispatch?.books ?? [])
          .filter((b) => b.status === "Recall Requested")
          .map((b) => b.bookId)
      )
    );
  }, [dispatch?.dispatchId, dispatch?.books]);

  if (!dispatch) return <Modal open={open} onClose={onClose} title="">{null}</Modal>;

  const today = todayIso();
  const overdue = isOverdue(dispatch, today);

  async function action(kind: "approve" | "reject") {
    if (!dispatch) return;
    setBusy(kind);
    setError(null);
    try {
      const res = await api.approveBook(dispatch.dispatchId, kind, approver);
      setResult({
        action: kind === "approve" ? "approved" : "rejected",
        alreadyActioned: res.alreadyActioned,
        actionedBy: res.actionedBy,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  /**
   * `bookIds` undefined → admin override; recalls everything in the
   * dispatch that's still Out or Recall Requested.
   * `bookIds` provided → recalls only those rows (e.g. confirming the
   * staff-requested ones).
   */
  async function recall(bookIds?: string[]) {
    if (!dispatch) return;
    setBusy("recall");
    setError(null);
    try {
      await api.recallBook(dispatch.dispatchId, approver, bookIds);
      setResult({ action: "recalled" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function toggleBook(bookId: string) {
    setSelectedToRecall((cur) => {
      const next = new Set(cur);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

  function finish() {
    const message = result
      ? result.alreadyActioned
        ? `Already actioned by ${result.actionedBy ?? "another approver"}.`
        : ACTION_HEADLINE[result.action].title
      : "";
    onChanged(message);
  }

  // -------- Success state (after action) --------
  if (result) {
    const head = ACTION_HEADLINE[result.action];
    const subject: ShareSubject = {
      action: result.action,
      dispatchId: dispatch.dispatchId,
      clientName: dispatch.clientName,
      clientAddress: dispatch.clientAddress,
      clientPhone: dispatch.clientPhone,
      store: dispatch.store,
      returnBy: dispatch.returnBy,
      salesperson: dispatch.salesperson,
      actionedBy: result.alreadyActioned
        ? result.actionedBy
        : result.action === "recalled" || result.action === "approved" || result.action === "rejected"
          ? approver
          : undefined,
      books: dispatch.books.map((b) => ({ name: b.name, category: b.category })),
    };

    return (
      <Modal
        open={open}
        onClose={finish}
        title={head.title}
        footer={
          <>
            <ShareButton subject={subject} variant="primary" label="Share" />
            <Button variant="secondary" onClick={finish}>Done</Button>
          </>
        }
      >
        {result.alreadyActioned ? (
          <Alert variant="amber">
            Already actioned by {result.actionedBy ?? "another approver"}. Your
            action was not applied.
          </Alert>
        ) : (
          <Alert variant={head.tone}>
            {result.action === "approved" && "Books are now Out in Field."}
            {result.action === "rejected" && "Dispatch was rejected."}
            {result.action === "recalled" && "All books marked recalled."}
          </Alert>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
          <DetailRow label="Client" value={dispatch.clientName} />
          <DetailRow label="Store" value={dispatch.store} />
          <DetailRow label="Salesperson" value={dispatch.salesperson} />
          <DetailRow label="Phone" value={dispatch.clientPhone} />
        </div>
        <DetailRow label="Address" value={dispatch.clientAddress} />

        <h3 style={{ marginTop: 14, marginBottom: 8, fontSize: 15 }}>
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

  // -------- Detail state (before action) --------
  const actionableBooks = dispatch.books.filter(
    (b) => b.status === "Out in Field" || b.status === "Recall Requested"
  );
  const hasActionable = actionableBooks.length > 0;
  const selectedCount = selectedToRecall.size;

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
          {dispatch.status !== "Pending Approval" && hasActionable && (
            <>
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => recall()}
                title="Recall every book still out — fast-path override"
              >
                {busy === "recall" && selectedCount === 0 ? "Recalling…" : "Mark all recalled"}
              </Button>
              <Button
                variant="primary"
                disabled={busy !== null || selectedCount === 0}
                onClick={() => recall(Array.from(selectedToRecall))}
              >
                {busy === "recall" && selectedCount > 0
                  ? "Recalling…"
                  : `Recall selected (${selectedCount})`}
              </Button>
            </>
          )}
        </>
      }
    >
      {error && <Alert variant="red">{error}</Alert>}

      <div style={{ marginBottom: 12 }}>
        <StatusBadge status={dispatch.status} overdue={overdue} />
      </div>

      {dispatch.status === "Recall Requested" && (
        <Alert variant="amber">
          Staff has requested recall of the highlighted books. Confirm by
          tapping <strong>Recall selected</strong>.
        </Alert>
      )}

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
        {dispatch.books.map((b, i) => {
          const isActionable =
            b.status === "Out in Field" || b.status === "Recall Requested";
          const isChecked = selectedToRecall.has(b.bookId);
          const isRequested = b.status === "Recall Requested";
          return (
            <label
              key={`${b.bookId}|${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: isActionable ? "auto 1fr auto" : "1fr auto",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: isRequested
                  ? "var(--amber-light)"
                  : "var(--sand-dark)",
                borderRadius: "var(--radius)",
                cursor: isActionable ? "pointer" : "default",
              }}
            >
              {isActionable && (
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleBook(b.bookId)}
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
