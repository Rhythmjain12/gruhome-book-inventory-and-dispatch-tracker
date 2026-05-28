// PIN entry screen shown before the admin dashboard loads.
// On success the PIN is stored in sessionStorage (clears on tab close)
// and the api client attaches it as a bearer token automatically.

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { setAdminPin } from "../lib/session";
import { Alert, Button } from "../components/primitives";

interface Props {
  onUnlock: () => void;
}

export function AdminPinGate({ onUnlock }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminLogin(pin);
      setAdminPin(pin);
      onUnlock();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : "Couldn't verify PIN");
      setPin("");
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "60px auto 0" }}>
      <div className="card" style={{ padding: 32 }}>
        <div
          style={{
            fontFamily: "var(--serif)",
            color: "var(--accent)",
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          Restricted
        </div>
        <h2 style={{ marginBottom: 6 }}>Manager access</h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 22, fontSize: 14 }}>
          Enter the admin PIN to view dispatches and action approvals.
        </p>

        {error && <Alert variant="red">{error}</Alert>}

        <form onSubmit={submit}>
          <input
            ref={inputRef}
            className="input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            style={{
              letterSpacing: "0.5em",
              textAlign: "center",
              fontSize: 20,
              padding: "14px 12px",
              marginBottom: 16,
            }}
          />
          <Button
            type="submit"
            variant="primary"
            block
            disabled={busy || !pin}
          >
            {busy ? "Verifying…" : "Unlock"}
          </Button>
        </form>
      </div>
    </div>
  );
}
