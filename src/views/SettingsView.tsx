// Admin Settings — runtime-editable config (salespeople list, approver
// names, admin PIN). Writes go to KV via /api/admin/update-config.

import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { setAdminPin } from "../lib/session";
import { useConfig } from "../lib/useConfig";
import { Alert, Button, Field } from "../components/primitives";

export function SettingsView() {
  const { config, error: loadError } = useConfig();
  const [salespeople, setSalespeople] = useState("");
  const [approver1, setApprover1] = useState("");
  const [approver2, setApprover2] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Hydrate inputs from loaded config once.
  useEffect(() => {
    if (!config) return;
    setSalespeople(config.salespeople.join(", "));
    setApprover1(config.approvers[0]);
    setApprover2(config.approvers[1]);
  }, [config]);

  function parseSalespeople(raw: string): string[] {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  async function onSave() {
    setError(null);
    setSuccess(null);

    const peopleList = parseSalespeople(salespeople);
    if (peopleList.length === 0) {
      setError("At least one salesperson is required.");
      return;
    }
    if (!approver1.trim() || !approver2.trim()) {
      setError("Both approver names are required.");
      return;
    }

    // PIN validation only if the user is trying to change it.
    const wantsPinChange = newPin.length > 0 || confirmPin.length > 0;
    if (wantsPinChange) {
      if (newPin.length < 4) {
        setError("PIN must be at least 4 characters.");
        return;
      }
      if (newPin !== confirmPin) {
        setError("New PIN and confirmation don't match.");
        return;
      }
    }

    setSaving(true);
    try {
      const patch: Parameters<typeof api.updateConfig>[0] = {
        salespeople: peopleList,
        approver1: approver1.trim(),
        approver2: approver2.trim(),
      };
      if (wantsPinChange) patch.myPin = newPin;

      const res = await api.updateConfig(patch);

      // If we just rotated the PIN, keep this session signed in by
      // updating sessionStorage with the new PIN so the bearer header
      // matches on the next request.
      if (res.newPin) setAdminPin(res.newPin);

      setNewPin("");
      setConfirmPin("");
      setSuccess(
        "Saved. Other browsers will see the changes within ~1 minute."
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <Alert variant="red">{loadError}</Alert>;
  if (!config) {
    return (
      <div style={{ color: "var(--ink-3)", padding: 24 }}>Loading…</div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ marginBottom: 6 }}>Settings</h2>
      <p style={{ color: "var(--ink-3)", marginBottom: 22, fontSize: 14 }}>
        Edit who can dispatch and approve, and rotate the admin PIN. Changes
        are live for you immediately and propagate to other devices within
        about a minute.
      </p>

      {error && <Alert variant="red">{error}</Alert>}
      {success && <Alert variant="green">{success}</Alert>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 14, fontSize: 16 }}>People</h3>

        <Field
          label="Salespeople"
          hint="comma-separated, must match Pumble display names exactly if you use mentions"
        >
          <textarea
            className="textarea"
            rows={3}
            value={salespeople}
            onChange={(e) => setSalespeople(e.target.value)}
            placeholder="Neha, Amit, Ravi"
          />
        </Field>

        <div className="field-row">
          <Field label="Approver 1 (owner)">
            <input
              className="input"
              value={approver1}
              onChange={(e) => setApprover1(e.target.value)}
            />
          </Field>
          <Field label="Approver 2 (manager)">
            <input
              className="input"
              value={approver2}
              onChange={(e) => setApprover2(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 6, fontSize: 16 }}>Change your PIN</h3>
        <p style={{ color: "var(--ink-3)", marginBottom: 14, fontSize: 13 }}>
          You're rotating your own PIN — the other approver's PIN is unaffected.
          Leave both fields blank to keep your current PIN.
        </p>
        <div className="field-row">
          <Field label="New PIN">
            <input
              className="input"
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="••••"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new PIN">
            <input
              className="input"
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="••••"
              autoComplete="new-password"
            />
          </Field>
        </div>
      </div>

      <Button variant="primary" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
