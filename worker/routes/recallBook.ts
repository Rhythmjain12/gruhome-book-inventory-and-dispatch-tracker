// POST /api/recall-book
// Body: { dispatchId, approver }
// Marks every book row in the dispatch as Recalled, stamps Recalled At,
// and notifies the salesperson in the shared staff channel with an
// @mention (Pumble renders bare @Name as a mention when the display
// name matches — covered in SETUP.md).

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
import { requireAdmin } from "../lib/auth";

export async function handleRecallBook(request: Request, env: Env): Promise<Response> {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  let body: { dispatchId?: string; approver?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const { dispatchId, approver } = body;
  if (!dispatchId || !approver) {
    return jsonError(400, "dispatchId and approver required");
  }

  if (isDemo(env)) {
    console.log("[demo] recall-book", { dispatchId, approver });
    return demoJson({ ok: true });
  }

  const pages = await queryDatabaseAll(env.NOTION_TOKEN, env.NOTION_DISPATCH_DB_ID, {
    filter: {
      property: DISPATCH_PROP.dispatchId,
      rich_text: { equals: dispatchId },
    },
  });
  if (pages.length === 0) return jsonError(404, "Dispatch not found");

  const first = pages[0]!.properties;
  const clientName = readRichText(first[DISPATCH_PROP.clientName]);
  const salesperson = readSelect(first[DISPATCH_PROP.salesperson]);
  const nowIso = new Date().toISOString();

  for (const page of pages) {
    await updatePage(env.NOTION_TOKEN, page.id, {
      [DISPATCH_PROP.status]: select("Recalled"),
      [DISPATCH_PROP.recalledAt]: date(nowIso),
    });
  }

  await sendPumble(
    env.PUMBLE_WEBHOOK_URL_STAFF,
    `@${md(salesperson)} — books for *${md(clientName)}* have been marked *recalled* by *${md(
      approver
    )}*.`
  );

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
