// Shared UI primitives. Kept in one file to avoid premature splitting —
// each is small and they're tightly related visually.

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { DispatchStatus } from "../types";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
}
export function Button({
  variant = "primary",
  block,
  className,
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    `btn-${variant}`,
    block ? "btn-block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={cls} {...rest} />;
}

interface PillProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}
export function Pill({ active, onClick, children }: PillProps) {
  return (
    <button
      type="button"
      className={`pill${active ? " active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const STATUS_CLASS: Record<DispatchStatus, string> = {
  "Pending Approval": "badge-pending",
  "Out in Field": "badge-out",
  "Recall Requested": "badge-pending",
  "Partially Recalled": "badge-out",
  Recalled: "badge-recalled",
  Rejected: "badge-rejected",
};
const STATUS_LABEL: Record<DispatchStatus, string> = {
  "Pending Approval": "Pending",
  "Out in Field": "Out",
  "Recall Requested": "Recall pending",
  "Partially Recalled": "Partial",
  Recalled: "Recalled",
  Rejected: "Rejected",
};
export function StatusBadge({
  status,
  overdue,
}: {
  status: DispatchStatus;
  overdue?: boolean;
}) {
  if (overdue && status === "Out in Field") {
    return <span className="badge badge-overdue">Overdue</span>;
  }
  return (
    <span className={`badge ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {hint && <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div>{children}</div>
        {footer && (
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 24,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Alert({
  variant,
  children,
}: {
  variant: "amber" | "red" | "green";
  children: ReactNode;
}) {
  return <div className={`alert alert-${variant}`}>{children}</div>;
}

export function Toast({
  message,
  type = "info",
}: {
  message: string;
  type?: "info" | "error";
}) {
  return (
    <div className={`toast${type === "error" ? " toast-error" : ""}`}>
      {message}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "amber" | "red" | "blue";
}) {
  const accentColor =
    tone === "amber"
      ? "var(--amber)"
      : tone === "red"
        ? "var(--red)"
        : tone === "blue"
          ? "var(--blue)"
          : "var(--ink)";
  return (
    <div
      className="card"
      style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}
    >
      <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 28, color: accentColor }}>
        {value}
      </div>
    </div>
  );
}

export function Initials({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?";
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--accent-light)",
        color: "var(--accent)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
