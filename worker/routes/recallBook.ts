// POST /api/recall-book
// Body: { dispatchId, approver, bookIds?: string[] }
//
// PIN-gated. Marks book rows in the dispatch as Recalled and stamps
// Recalled At. Two modes:
//
//   bookIds = []  or  undefined → recall everything in the dispatch
//                                  that's currently Out or Recall
//                                  Requested. This is the admin's
//                                  override / fast-path.
//   bookIds = [pageId, ...]      → recall only the listed rows
//                                  (typically the "Recall Requested"
//                                  ones the admin is approving).
//
// Rows already Recalled are skipped so timestamps don't get rewritten.

import type { Env } from "../index";
import {
  date,
  queryDatabaseAll,
  readRichText,
  readSelect,
  select,
  updatePage,
} from "../lib/notion";
import { md, sendPumble } from "../lib/pumble";
import { DISPATCH_PROP } from "../lib/schema";
import { demoJson, isDemo } from "../lib/demo";
import { requireAdminGate } from "../lib/auth";

const RECALLABLE_STATUSES = new Set(["Out in Field", "Recall Requested"]);

export async function handleRecallBook(request: Request, env: Env): Promise<Response> {
  const unauthorized = await requireAdminGate(request, env);
  if (unauthorized) return unauthorized;

  let body: { dispatchId?: string; approver?: string; bookIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const { dispatchId, approver, bookIds } = body;
  if (!dispatchId || !approver) {
    return jsonError(400, "dispatchId and approver required");
  }
  const targetIds = Array.isArray(bookIds) && bookIds.length > 0
    ? new Set(bookIds)
    : null;

  if (isDemo(env)) {
    console.log("[demo] recall-book", {
      dispatchId,
      approver,
      bookCount: targetIds?.size ?? "all",
    });
    return demoJson({ ok: true });
  }

  // Pull all rows from the dispatch DB and filter in JS by Dispatch ID
  // (see comment in getBooks.ts for why we don't filter at Notion).
  const allPages = await queryDatabaseAll(env.NOTION_TOKEN, env.NOTION_DISPATCH_DB_ID);
  const pages = allPages.filter(
    (page) => readRichText(page.properties[DISPATCH_PROP.dispatchId]) === dispatchId
  );
  if (pages.length === 0) return jsonError(404, "Dispatch not found");

  const first = pages[0]!.properties;
  const clientName = readRichText(first[DISPATCH_PROP.clientName]);
  const salesperson = readSelect(first[DISPATCH_PROP.salesperson]);
  const nowIso = new Date().toISOString();

  let recalled = 0;
  for (const page of pages) {
    if (targetIds && !targetIds.has(page.id)) continue;
    const currentStatus = readSelect(page.properties[DISPATCH_PROP.status]);
    if (!RECALLABLE_STATUSES.has(currentStatus)) continue;
    await updatePage(env.NOTION_TOKEN, page.id, {
      [DISPATCH_PROP.status]: select("Recalled"),
      [DISPATCH_PROP.recalledAt]: date(nowIso),
    });
    recalled++;
  }

  if (recalled > 0) {
    const all = recalled === pages.length;
    await sendPumble(
      env.PUMBLE_WEBHOOK_URL_STAFF,
      `@${md(salesperson)} — ${all ? "all" : recalled} book${recalled === 1 ? "" : "s"} for *${md(
        clientName
      )}* marked *recalled* by *${md(approver)}*.`
    );
  }

  return new Response(JSON.stringify({ ok: true, recalled }), {
    headers: { "content-type": "application/json" },
  });
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
