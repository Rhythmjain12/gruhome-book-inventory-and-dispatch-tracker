// POST /api/request-recall
// Body: { dispatchId: string, bookIds: string[] }
//
// Staff-side recall request. Flips the listed books from "Out in
// Field" to "Recall Requested". Admin then approves via the existing
// /api/recall-book endpoint (which stamps Recalled At).
//
// Honor-system auth, same as the rest of the staff API: anyone with
// the URL can request a recall. The dispatch's audit trail (who
// approved, when) is preserved server-side regardless.

import type { Env } from "../index";
import {
  queryDatabaseAll,
  readSelect,
  select,
  updatePage,
} from "../lib/notion";
import { DISPATCH_PROP } from "../lib/schema";
import { demoJson, isDemo } from "../lib/demo";

export async function handleRequestRecall(
  request: Request,
  env: Env
): Promise<Response> {
  let body: { dispatchId?: string; bookIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const { dispatchId, bookIds } = body;
  if (!dispatchId) return json(400, { error: "dispatchId required" });
  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    return json(400, { error: "bookIds (non-empty array) required" });
  }

  if (isDemo(env)) {
    console.log("[demo] request-recall", { dispatchId, bookCount: bookIds.length });
    return demoJson({ ok: true, updated: bookIds.length });
  }

  // We don't filter Notion by Dispatch ID either — same Select-equals
  // caveat as get-books (see comment there). Pull all rows from the
  // dispatch DB and filter in JS by Dispatch ID + page ID.
  const pages = await queryDatabaseAll(env.NOTION_TOKEN, env.NOTION_DISPATCH_DB_ID);
  const targetIds = new Set(bookIds);
  let updated = 0;
  for (const page of pages) {
    if (!targetIds.has(page.id)) continue;
    const currentStatus = readSelect(page.properties[DISPATCH_PROP.status]);
    // Only flip rows that are currently Out — silently ignore everything
    // else (already requested, already recalled, etc.).
    if (currentStatus !== "Out in Field") continue;
    await updatePage(env.NOTION_TOKEN, page.id, {
      [DISPATCH_PROP.status]: select("Recall Requested"),
    });
    updated++;
  }
  return json(200, { ok: true, updated });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
