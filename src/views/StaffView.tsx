// Staff view: two tabs — "New dispatch" (the form) and "My dispatches"
// (read-only list of own dispatches). The dispatches list is wired to
// the real API in step 6; for now it shows an empty-state placeholder
// driven by /api/get-books returning [].

import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Dispatch } from "../types";
import {
  Alert,
  Button,
  Pill,
  StatusBadge,
} from "../components/primitives";
import { DispatchForm } from "./DispatchForm";
import { DispatchSuccess } from "./DispatchSuccess";

interface Props {
  salesperson: string;
  onSignOut: () => void;
}

type Tab = "new" | "mine";

interface JustSubmitted {
  dispatchId: string;
  books: Array<{ name: string; category: string }>;
}

export function StaffView({ salesperson, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>("new");
  const [justSubmitted, setJustSubmitted] = useState<JustSubmitted | null>(null);

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
          Logged in as <strong style={{ color: "var(--ink)" }}>{salesperson}</strong>
        </div>
        <Button variant="ghost" onClick={onSignOut}>
          Not you?
        </Button>
      </div>

      <div className="pill-row" style={{ marginBottom: 18 }}>
        <Pill active={tab === "new"} onClick={() => setTab("new")}>
          New dispatch
        </Pill>
        <Pill active={tab === "mine"} onClick={() => setTab("mine")}>
          My dispatches
        </Pill>
      </div>

      {tab === "new" &&
        (justSubmitted ? (
          <DispatchSuccess
            dispatchId={justSubmitted.dispatchId}
            books={justSubmitted.books}
            onNewDispatch={() => setJustSubmitted(null)}
            onViewMyDispatches={() => {
              setJustSubmitted(null);
              setTab("mine");
            }}
          />
        ) : (
          <DispatchForm
            salesperson={salesperson}
            onSubmitted={(dispatchId, books) =>
              setJustSubmitted({
                dispatchId,
                books: books.map((b) => ({ name: b.name, category: b.category })),
              })
            }
          />
        ))}

      {tab === "mine" && <MyDispatches salesperson={salesperson} />}
    </div>
  );
}

function MyDispatches({ salesperson }: { salesperson: string }) {
  const [items, setItems] = useState<Dispatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getBooks(salesperson)
      .then((d) => {
        if (!cancelled) setItems(d);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : String(e));
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [salesperson]);

  if (error) return <Alert variant="red">{error}</Alert>;
  if (items === null)
    return <div style={{ color: "var(--ink-3)", padding: 24 }}>Loading…</div>;
  if (items.length === 0)
    return (
      <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--ink-3)" }}>
        No dispatches yet. Your submissions will appear here.
      </div>
    );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((d) => {
        const overdue =
          d.status === "Out in Field" && d.returnBy < today;
        return (
          <div
            key={d.dispatchId}
            className="card"
            style={{
              padding: "14px 18px",
              borderLeft: `4px solid ${borderForStatus(d.status, overdue)}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 500 }}>{d.clientName}</div>
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  {d.books.length} book{d.books.length === 1 ? "" : "s"} · {d.store} · return by{" "}
                  {d.returnBy}
                </div>
              </div>
              <StatusBadge status={d.status} overdue={overdue} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function borderForStatus(status: Dispatch["status"], overdue: boolean): string {
  if (overdue) return "var(--red)";
  if (status === "Pending Approval") return "var(--amber)";
  if (status === "Out in Field") return "var(--blue)";
  if (status === "Recalled") return "var(--green)";
  return "var(--border-strong)";
}
