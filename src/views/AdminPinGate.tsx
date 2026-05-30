// PIN entry screen shown after the approver has been picked. Each
// approver has their own PIN (see worker/lib/configStore.ts). On
// success the PIN is stored in sessionStorage and attached as a
// bearer token on every privileged request.

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { setAdminPin } from "../lib/session";
import { Alert, Button } from "../components/primitives";

interface Props {
  approver: string;
  onUnlock: () => void;
  onBack: () => void;
}

export function AdminPinGate({ approver, onUnlock, onBack }: Props) {
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
      await api.adminLogin(approver, pin);
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
        <h2 style={{ marginBottom: 6 }}>
          Welcome back, {approver.split(/\s+/)[0]}
        </h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 22, fontSize: 14 }}>
          Enter <strong style={{ color: "var(--ink-2)" }}>your</strong> admin PIN.
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
        <button
          type="button"
          onClick={onBack}
          style={{
            marginTop: 14,
            background: "none",
            border: "none",
            color: "var(--ink-3)",
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Not {approver.split(/\s+/)[0]}? Pick again
        </button>
      </div>
    </div>
  );
}
