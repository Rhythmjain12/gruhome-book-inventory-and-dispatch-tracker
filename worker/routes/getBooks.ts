// GET /api/get-books[?salesperson=Name]
//
// Returns one Dispatch object per Dispatch ID, with all its book rows
// aggregated. Optionally filters to a single salesperson — that's how
// the staff "My dispatches" tab scopes its view.

import type { Env } from "../index";
import {
  queryDatabaseAll,
  readDate,
  readRichText,
  readSelect,
  readTitle,
} from "../lib/notion";
import { DISPATCH_PROP } from "../lib/schema";
import { DEMO_DISPATCHES, demoJson, isDemo } from "../lib/demo";
import { requireAdmin } from "../lib/auth";

interface DispatchOut {
  dispatchId: string;
  salesperson: string;
  store: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  returnBy: string;
  dateSent: string;
  purpose: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  recalledAt?: string;
  books: Array<{ bookId: string; name: string; category: string }>;
}

export async function handleGetBooks(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const salesperson = url.searchParams.get("salesperson");

  // Admin-scope reads (no salesperson filter) require the PIN.
  // Salesperson-scope reads are part of the staff view and remain open
  // (Phase 1 honor system — see SETUP.md §7).
  if (!salesperson) {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;
  }

  if (isDemo(env)) {
    const data = salesperson
      ? DEMO_DISPATCHES.filter((d) => d.salesperson === salesperson)
      : DEMO_DISPATCHES;
    return demoJson(data);
  }


  const filter = salesperson
    ? {
        property: DISPATCH_PROP.salesperson,
        select: { equals: salesperson },
      }
    : undefined;

  const pages = await queryDatabaseAll(env.NOTION_TOKEN, env.NOTION_DISPATCH_DB_ID, {
    ...(filter ? { filter } : {}),
    sorts: [{ property: DISPATCH_PROP.dateSent, direction: "descending" }],
  });

  const byId = new Map<string, DispatchOut>();
  for (const page of pages) {
    const p = page.properties;
    const dispatchId = readRichText(p[DISPATCH_PROP.dispatchId]);
    if (!dispatchId) continue;

    let entry = byId.get(dispatchId);
    if (!entry) {
      entry = {
        dispatchId,
        salesperson: readSelect(p[DISPATCH_PROP.salesperson]),
        store: readSelect(p[DISPATCH_PROP.store]),
        clientName: readRichText(p[DISPATCH_PROP.clientName]),
        clientPhone: readRichText(p[DISPATCH_PROP.clientPhone]),
        clientAddress: readRichText(p[DISPATCH_PROP.clientAddress]),
        returnBy: readDate(p[DISPATCH_PROP.returnBy]),
        dateSent: readDate(p[DISPATCH_PROP.dateSent]),
        purpose: readRichText(p[DISPATCH_PROP.purpose]),
        status: readSelect(p[DISPATCH_PROP.status]),
        approvedBy: readRichText(p[DISPATCH_PROP.approvedBy]) || undefined,
        approvedAt: readDate(p[DISPATCH_PROP.approvedAt]) || undefined,
        recalledAt: readDate(p[DISPATCH_PROP.recalledAt]) || undefined,
        books: [],
      };
      byId.set(dispatchId, entry);
    }
    entry.books.push({
      bookId: page.id,
      name: readTitle(p[DISPATCH_PROP.bookName]),
      category: readSelect(p[DISPATCH_PROP.category]),
    });
  }

  const out = Array.from(byId.values());
  return new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json" },
  });
}
