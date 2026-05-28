// View routing in Phase 1:
//   ?view=admin → AdminPinGate → IdentityGate (which approver?) → AdminView
//   default     → IdentityGate (which salesperson?) → StaffView

import { useEffect, useState } from "react";
import { IdentityGate } from "./views/IdentityGate";
import { StaffView } from "./views/StaffView";
import { AdminView } from "./views/AdminView";
import { AdminPinGate } from "./views/AdminPinGate";
import {
  useSalesperson,
  useApprover,
  getAdminPin,
  setAdminPin,
  subscribePin,
} from "./lib/session";
import { useConfig } from "./lib/useConfig";
import { Alert } from "./components/primitives";

type View = "staff" | "admin";

function resolveView(): View {
  if (typeof window === "undefined") return "staff";
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "admin" ? "admin" : "staff";
}

export default function App() {
  const [view, setView] = useState<View>(resolveView);
  const { config, error: configError } = useConfig();
  const [salesperson, setSalesperson] = useSalesperson();
  const [approver, setApprover] = useApprover();
  const [unlocked, setUnlocked] = useState<boolean>(() => !!getAdminPin());

  useEffect(() => {
    const onPop = () => setView(resolveView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Keep `unlocked` in sync if the PIN is cleared elsewhere (e.g. a
  // 401 from a stale PIN, or the "Lock" action below).
  useEffect(() => {
    return subscribePin(() => setUnlocked(!!getAdminPin()));
  }, []);

  function lockAdmin() {
    setAdminPin(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="app-title">Gruhome — Sample Books</div>
          <div className="app-subtitle">
            {view === "admin" ? "Manager view" : "Staff dispatch"}
          </div>
        </div>
        <div className="app-meta">
          {view === "admin" ? "Approvers only" : "Internal tool"}
        </div>
      </header>

      {configError && (
        <Alert variant="red">
          Couldn't load config: {configError}. Check that the Worker is
          running and env vars are set.
        </Alert>
      )}

      {!config && !configError && (
        <div style={{ color: "var(--ink-3)", padding: "60px 0", textAlign: "center" }}>
          Loading…
        </div>
      )}

      {config &&
        (view === "admin" ? (
          !unlocked ? (
            <AdminPinGate onUnlock={() => setUnlocked(true)} />
          ) : approver ? (
            <AdminView
              approver={approver}
              onSignOut={() => setApprover(null)}
              onLock={lockAdmin}
            />
          ) : (
            <IdentityGate
              title="Who's viewing?"
              subtitle="Approve, reject, and recall actions will be attributed to this name."
              options={config.approvers}
              onPick={setApprover}
            />
          )
        ) : salesperson ? (
          <StaffView
            salesperson={salesperson}
            onSignOut={() => setSalesperson(null)}
          />
        ) : (
          <IdentityGate
            title="Who's dispatching?"
            subtitle="Your name will be attached to every book you send out. Pick once — we'll remember."
            options={config.salespeople}
            onPick={setSalesperson}
          />
        ))}
    </div>
  );
}
