// Shown on first visit (or after the user clears their identity).
// Staff pick their salesperson name; admins pick which approver they are.
// Choice is persisted in localStorage by the parent.

import { Button } from "../components/primitives";

interface Props {
  title: string;
  subtitle: string;
  options: readonly string[];
  onPick: (name: string) => void;
}

export function IdentityGate({ title, subtitle, options, onPick }: Props) {
  return (
    <div style={{ maxWidth: 420, margin: "60px auto 0" }}>
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ marginBottom: 6 }}>{title}</h2>
        <p style={{ color: "var(--ink-3)", marginBottom: 22, fontSize: 14 }}>
          {subtitle}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.length === 0 ? (
            <div className="alert alert-amber">
              No options configured. Ask the owner to set the relevant env
              var in Cloudflare and reload.
            </div>
          ) : (
            options.map((name) => (
              <Button
                key={name}
                variant="secondary"
                block
                onClick={() => onPick(name)}
                style={{ justifyContent: "flex-start", padding: "12px 16px" }}
              >
                {name}
              </Button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
