// Cross-platform share: tries the native share sheet first (one-tap to
// WhatsApp / Pumble / Mail on mobile), falls back to clipboard copy on
// desktop or when `navigator.share` is unavailable.

import type { DispatchStatus, Store } from "../types";

export type ShareAction =
  | "submitted"
  | "approved"
  | "rejected"
  | "recalled";

export interface ShareSubject {
  action: ShareAction;
  dispatchId: string;
  clientName: string;
  clientAddress: string;
  clientPhone?: string;
  store: Store | string;
  returnBy?: string;
  salesperson: string;
  actionedBy?: string;          // approver name, when applicable
  books: Array<{ name: string; category: string }>;
}

const HEADER: Record<ShareAction, string> = {
  submitted: "📦 Dispatch submitted — awaiting approval",
  approved: "✅ Dispatch approved",
  rejected: "❌ Dispatch rejected",
  recalled: "↩️ Books recalled",
};

/** Build a human-readable text block ready to paste into Pumble / WhatsApp. */
export function formatShareText(s: ShareSubject): string {
  const lines: string[] = [];
  lines.push(HEADER[s.action]);
  if (s.actionedBy) lines.push(`By: ${s.actionedBy}`);
  lines.push("");
  lines.push(`Client: ${s.clientName}`);
  if (s.clientPhone) lines.push(`Phone: ${s.clientPhone}`);
  lines.push(`Address: ${s.clientAddress}`);
  lines.push(`Store: ${s.store}`);
  if (s.returnBy) lines.push(`Return by: ${s.returnBy}`);
  lines.push("");
  lines.push(`Books (${s.books.length}):`);
  for (const b of s.books) {
    lines.push(`• ${b.name} [${b.category}]`);
  }
  lines.push("");
  lines.push(`Salesperson: ${s.salesperson}`);
  lines.push(`Dispatch ID: ${s.dispatchId}`);
  return lines.join("\n");
}

/** Title used for the native share sheet (some apps surface it). */
export function shareTitle(action: ShareAction, clientName: string): string {
  const verb = {
    submitted: "Dispatch to",
    approved: "Approved dispatch to",
    rejected: "Rejected dispatch to",
    recalled: "Recalled books from",
  }[action];
  return `${verb} ${clientName}`;
}

export type ShareResult = "shared" | "copied" | "cancelled";

/**
 * Try native share, fall back to clipboard. Returns a value the UI can
 * use to show appropriate feedback (e.g. "Copied" vs nothing because
 * the OS share sheet already gave feedback).
 */
export async function shareOrCopy(subject: ShareSubject): Promise<ShareResult> {
  const text = formatShareText(subject);
  const title = shareTitle(subject.action, subject.clientName);

  // 1. Native share if available (mobile, modern desktop Safari/Chrome).
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
      // Any other error: fall through to clipboard.
    }
  }

  // 2. Clipboard fallback.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }

  // 3. Last-resort fallback: in-page textarea + execCommand (very old browsers).
  if (typeof document !== "undefined") {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      return "copied";
    } finally {
      document.body.removeChild(ta);
    }
  }
  throw new Error("Sharing is not supported in this browser");
}

// Keep an unused import warning quiet — DispatchStatus may be useful later.
export type _ShareStatus = DispatchStatus;
