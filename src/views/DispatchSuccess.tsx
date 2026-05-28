// Success screen after submission. Lists what was sent so staff have
// confirmation, and offers a one-tap path back to the form for the next
// client visit (the <30s flow).

import { Button } from "../components/primitives";

interface BookSummary {
  name: string;
  category: string;
}

interface Props {
  dispatchId: string;
  books: BookSummary[];
  onNewDispatch: () => void;
  onViewMyDispatches: () => void;
}

export function DispatchSuccess({
  dispatchId,
  books,
  onNewDispatch,
  onViewMyDispatches,
}: Props) {
  return (
    <div>
      <div className="alert alert-green" style={{ marginBottom: 16 }}>
        Submitted. The manager has been notified for approval.
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Dispatch summary</h3>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14, fontFamily: "monospace" }}>
          ID {dispatchId.slice(0, 8)}…
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {books.map((b, i) => (
            <div
              key={i}
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
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <Button variant="primary" onClick={onNewDispatch}>
            New dispatch
          </Button>
          <Button variant="secondary" onClick={onViewMyDispatches}>
            View my dispatches
          </Button>
        </div>
      </div>
    </div>
  );
}
