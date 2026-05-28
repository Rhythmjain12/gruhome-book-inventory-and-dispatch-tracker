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

export type DispatchStatus =
  | "Pending Approval"
  | "Out in Field"
  | "Rejected"
  | "Recalled";

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
