// Shared types between the React app and the Worker API.

export type Category =
  | "Fabric"
  | "Wallpaper"
  | "Leather"
  | "Blinds"
  | "Carpet"
  | "Flooring"
  | "Upholstery"
  | "Other";

export type Store = "Preet Vihar" | "Noida";

/** Per-row status, as stored in Notion's Status Select column. */
export type BookStatus =
  | "Pending Approval"
  | "Out in Field"
  | "Recall Requested"
  | "Rejected"
  | "Recalled";

/**
 * Per-dispatch status surfaced by /api/get-books.
 * The first four mirror the per-row values for uniform dispatches.
 * The last two are *derived* from a mix of per-book states:
 *   - "Recall Requested": at least one book is awaiting admin approval
 *   - "Partially Recalled": some books Recalled + others still Out, no requests
 */
export type DispatchStatus = BookStatus | "Partially Recalled";

export interface Book {
  /** Notion page ID (catalogue entry). Empty for books added manually at dispatch time. */
  id: string;
  name: string;
  category: Category;
  homeStore: Store;
  /** Derived server-side from existing Out-in-Field dispatches. */
  currentlyOut: boolean;
}

export interface DispatchBookEntry {
  bookId: string;
  name: string;
  category: Category;
  status: BookStatus;
  recalledAt?: string;
}

export interface Dispatch {
  dispatchId: string;
  salesperson: string;
  store: Store;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  returnBy: string;       // ISO date (YYYY-MM-DD)
  dateSent: string;       // ISO datetime
  purpose: string;
  status: DispatchStatus;
  approvedBy?: string;
  approvedAt?: string;
  recalledAt?: string;
  books: DispatchBookEntry[];
}

export interface AppConfig {
  salespeople: string[];
  approvers: [string, string];
}
