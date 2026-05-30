// Two entry points share the core logic:
//   - GET  /approve?dispatch_id=&action=&approver=   → HTML confirmation
//     (tapped from a Pumble link)
//   - POST /api/approve-book                          → JSON
//     (from the admin dashboard)
//
// First action wins. If a dispatch is already past Pending Approval,
// the second tapper is shown an "Already actioned by X" page / JSON.

import type { Env } from "../index";
import {
  queryDatabaseAll,
  readRichText,
  readSelect,
  richText,
  date,
  select,
  updatePage,
} from "../lib/notion";
import { md, sendPumble } from "../lib/pumble";
import { DISPATCH_PROP } from "../lib/schema";
import { renderConfirmationPage } from "../lib/html";
import { isDemo } from "../lib/demo";
import { requireAdminGate } from "../lib/auth";

type Action = "approve" | "reject";

interface OutcomeOk {
  kind: "ok";
  action: Action;
  approver: string;
  clientName: string;
  salesperson: string;
  bookCount: number;
}
interface OutcomeAlready {
  kind: "already";
  actionedBy: string;
  status: string;
  clientName: string;
  salesperson: string;
}
interface OutcomeNotFound {
  kind: "not-found";
}
type Outcome = OutcomeOk | OutcomeAlready | OutcomeNotFound;

async function actionDispatch(
  env: Env,
  dispatchId: string,
  action: Action,
  approver: string
): Promise<Outcome> {
  if (isDemo(env)) {
    console.log("[demo] action", { dispatchId, action, approver });
    return {
      kind: "ok",
      action,
      approver,
      clientName: "Demo Client",
      salesperson: "Demo Salesperson",
      bookCount: 2,
    };
  }

  const pages = await queryDatabaseAll(env.NOTION_TOKEN, env.NOTION_DISPATCH_DB_ID, {
    filter: {
      property: DISPATCH_PROP.dispatchId,
      rich_text: { equals: dispatchId },
    },
  });
  if (pages.length === 0) return { kind: "not-found" };

  // Read first page for canonical client/salesperson info (all share it).
  const first = pages[0]!.properties;
  const currentStatus = readSelect(first[DISPATCH_PROP.status]);
  const clientName = readRichText(first[DISPATCH_PROP.clientName]);
  const salesperson = readSelect(first[DISPATCH_PROP.salesperson]);

  if (currentStatus !== "Pending Approval") {
    return {
      kind: "already",
      actionedBy: readRichText(first[DISPATCH_PROP.approvedBy]) || "another approver",
      status: currentStatus,
      clientName,
      salesperson,
    };
  }

  const targetStatus = action === "approve" ? "Out in Field" : "Rejected";
  const nowIso = new Date().toISOString();

  // Sequential update to respect Notion's rate limit.
  for (const page of pages) {
    await updatePage(env.NOTION_TOKEN, page.id, {
      [DISPATCH_PROP.status]: select(targetStatus),
      [DISPATCH_PROP.approvedBy]: richText(approver),
      [DISPATCH_PROP.approvedAt]: date(nowIso),
    });
  }

  // Notify approver channel that an action happened.
  await sendPumble(
    env.PUMBLE_WEBHOOK_URL,
    `*${md(approver)}* ${action === "approve" ? "approved" : "rejected"} the dispatch for *${md(
      clientName
    )}* (salesperson: ${md(salesperson)}).`
  );

  return {
    kind: "ok",
    action,
    approver,
    clientName,
    salesperson,
    bookCount: pages.length,
  };
}

// ---------- HTTP entry points ----------

export async function handleApproveLink(env: Env, url: URL): Promise<Response> {
  const dispatchId = url.searchParams.get("dispatch_id") ?? "";
  const action = url.searchParams.get("action") as Action | null;
  const approver = url.searchParams.get("approver") ?? "";

  if (!dispatchId || (action !== "approve" && action !== "reject") || !approver) {
    return renderConfirmationPage({
      title: "Invalid link",
      heading: "Something's off",
      subheading: "This link is missing required parameters.",
      tone: "red",
    });
  }

  const outcome = await actionDispatch(env, dispatchId, action, approver);
  if (outcome.kind === "not-found") {
    return renderConfirmationPage({
      title: "Dispatch not found",
      heading: "Couldn't find that dispatch",
      subheading: "It may have been deleted from Notion.",
      tone: "red",
    });
  }
  if (outcome.kind === "already") {
    return renderConfirmationPage({
      title: `Already ${outcome.status.toLowerCase()}`,
      heading: `Already actioned by ${outcome.actionedBy}`,
      subheading: "Your action was not applied — the dispatch was already updated.",
      tone: "amber",
      detail: [
        { label: "Client", value: outcome.clientName },
        { label: "Salesperson", value: outcome.salesperson },
        { label: "Current status", value: outcome.status },
      ],
    });
  }

  return renderConfirmationPage({
    title: outcome.action === "approve" ? "Approved" : "Rejected",
    heading: outcome.action === "approve" ? "Approved ✓" : "Rejected ✕",
    subheading:
      outcome.action === "approve"
        ? "Books are now marked Out in Field. You can close this tab."
        : "The dispatch has been rejected. You can close this tab.",
    tone: outcome.action === "approve" ? "green" : "red",
    detail: [
      { label: "Client", value: outcome.clientName },
      { label: "Salesperson", value: outcome.salesperson },
      { label: "Books", value: String(outcome.bookCount) },
      { label: "Actioned by", value: outcome.approver },
    ],
  });
}

export async function handleApprovePost(request: Request, env: Env): Promise<Response> {
  const unauthorized = await requireAdminGate(request, env);
  if (unauthorized) return unauthorized;

  let body: { dispatchId?: string; action?: Action; approver?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const { dispatchId, action, approver } = body;
  if (!dispatchId || (action !== "approve" && action !== "reject") || !approver) {
    return jsonError(400, "dispatchId, action, approver required");
  }

  const outcome = await actionDispatch(env, dispatchId, action, approver);
  if (outcome.kind === "not-found") return jsonError(404, "Dispatch not found");
  if (outcome.kind === "already") {
    return new Response(
      JSON.stringify({
        ok: true,
        alreadyActioned: true,
        actionedBy: outcome.actionedBy,
      }),
      { headers: { "content-type": "application/json" } }
    );
  }
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
