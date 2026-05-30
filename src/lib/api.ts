// Thin typed client over the Worker's /api/* endpoints. Each function:
//   - throws on network or non-2xx response
//   - returns the parsed JSON body
// The UI layer catches and surfaces errors via toast.
//
// Admin endpoints attach `Authorization: Bearer <PIN>` automatically by
// reading the PIN from sessionStorage. On 401 the PIN is cleared so the
// UI re-shows the PIN gate.

import type { AppConfig, Book, Dispatch } from "../types";
import { getAdminPin, getApprover, setAdminPin } from "./session";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOpts extends RequestInit {
  /** Attach the admin PIN as a bearer token. */
  admin?: boolean;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { admin, ...init } = opts;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (admin) {
    const pin = getAdminPin();
    const approver = getApprover();
    if (pin) headers.authorization = `Bearer ${pin}`;
    if (approver) headers["x-approver"] = approver;
  }

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (err) {
    throw new ApiError(
      `Network error reaching ${path}: ${(err as Error).message}`,
      0
    );
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = JSON.parse(text).error ?? text;
    } catch { /* not JSON */ }
    // Clear a stale PIN so the gate re-prompts.
    if (admin && res.status === 401) setAdminPin(null);
    throw new ApiError(message || `Request failed (${res.status})`, res.status);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const api = {
  getConfig: () => request<AppConfig>("/api/get-config"),
  getCatalogue: () => request<Book[]>("/api/get-catalogue"),
  /**
   * With a `salesperson` argument: staff-scope, open.
   * Without: admin-scope, PIN required.
   */
  getBooks: (salesperson?: string) =>
    request<Dispatch[]>(
      `/api/get-books${salesperson ? `?salesperson=${encodeURIComponent(salesperson)}` : ""}`,
      { admin: !salesperson }
    ),
  adminLogin: (approver: string, pin: string) =>
    request<{ ok: true }>("/api/admin-login", {
      method: "POST",
      body: JSON.stringify({ approver, pin }),
    }),
  updateConfig: (patch: {
    salespeople?: string[];
    approver1?: string;
    approver2?: string;
    /** The *active* approver's new PIN. The server uses the
     *  X-Approver header to figure out which slot to update. An
     *  approver can never set the other approver's PIN. */
    myPin?: string;
  }) =>
    request<{
      salespeople: string[];
      approvers: [string, string];
      newPin?: string;
    }>("/api/admin/update-config", {
      method: "POST",
      body: JSON.stringify(patch),
      admin: true,
    }),
  logBook: (payload: {
    salesperson: string;
    store: string;
    clientName: string;
    clientPhone: string;
    clientAddress: string;
    returnBy: string;
    purpose: string;
    books: Array<{ id: string; name: string; category: string }>;
  }) =>
    request<{ dispatchId: string }>("/api/log-book", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /**
   * Mark books as recalled (admin action).
   *   - `bookIds` empty / omitted → recall everything in the dispatch
   *     that's currently Out or Recall Requested (admin override).
   *   - `bookIds` provided → recall only those rows (e.g. approving
   *     the specific books staff has requested).
   */
  recallBook: (dispatchId: string, approver: string, bookIds?: string[]) =>
    request<{ ok: true; recalled: number }>("/api/recall-book", {
      method: "POST",
      body: JSON.stringify({ dispatchId, approver, bookIds }),
      admin: true,
    }),
  /** Staff-initiated recall request. Flips listed books to "Recall
   *  Requested" — admin still has to confirm via recallBook(). */
  requestRecall: (dispatchId: string, bookIds: string[]) =>
    request<{ ok: true; updated: number }>("/api/request-recall", {
      method: "POST",
      body: JSON.stringify({ dispatchId, bookIds }),
    }),
  approveBook: (dispatchId: string, action: "approve" | "reject", approver: string) =>
    request<{ ok: true; alreadyActioned?: boolean; actionedBy?: string }>(
      "/api/approve-book",
      {
        method: "POST",
        body: JSON.stringify({ dispatchId, action, approver }),
        admin: true,
      }
    ),
};
