// Success screen after submission. Lists what was sent so staff have
// confirmation, and offers a Share button + one-tap path back to the
// form for the next client visit.

import { Button } from "../components/primitives";
import { ShareButton } from "../components/ShareButton";
import type { ShareSubject } from "../lib/share";

interface Props {
  subject: ShareSubject;
  onNewDispatch: () => void;
  onViewMyDispatches: () => void;
}

export function DispatchSuccess({
  subject,
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
          ID {subject.dispatchId.slice(0, 8)}…
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>
          {subject.clientName} · {subject.store} · return by {subject.returnBy}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {subject.books.map((b, i) => (
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
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <ShareButton subject={subject} variant="primary" />
          <Button variant="secondary" onClick={onNewDispatch}>
            New dispatch
          </Button>
          <Button variant="ghost" onClick={onViewMyDispatches}>
            My dispatches
          </Button>
        </div>
      </div>
    </div>
  );
}
