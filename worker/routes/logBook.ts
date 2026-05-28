// POST /api/log-book
//
// Body: { salesperson, store, clientName, clientPhone, clientAddress,
//         returnBy, purpose, books: [{ id, name, category }] }
//
// Generates a single Dispatch ID (UUID) shared across all N book rows.
// Creates one Notion page per book, sequentially (Notion rate-limits at
// ~3 req/s — Promise.all on >3 rows would burst). Then sends one Pumble
// notification to the approver channel with two link sets, one per
// approver, encoding their name in the URL.

import type { Env } from "../index";
import { createPage, date, relation, richText, select, titleText } from "../lib/notion";
import { md, sendPumble } from "../lib/pumble";
import { DISPATCH_PROP } from "../lib/schema";
import { demoJson, isDemo } from "../lib/demo";

interface Payload {
  salesperson: string;
  store: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  returnBy: string;
  purpose: string;
  books: Array<{ id: string; name: string; category: string }>;
}

function validate(p: Partial<Payload>): string | null {
  if (!p.salesperson?.trim()) return "salesperson required";
  if (!p.store?.trim()) return "store required";
  if (!p.clientName?.trim()) return "clientName required";
  if (!p.clientPhone?.trim()) return "clientPhone required";
  if (!p.clientAddress?.trim()) return "clientAddress required";
  if (!p.returnBy) return "returnBy required";
  if (!Array.isArray(p.books) || p.books.length === 0) return "books required";
  for (const b of p.books) {
    if (!b.name?.trim()) return "book name required";
    if (!b.category?.trim()) return "book category required";
  }
  return null;
}

export async function handleLogBook(request: Request, env: Env): Promise<Response> {
  let body: Payload;
  try {
    body = await request.json<Payload>();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const err = validate(body);
  if (err) {
    return new Response(JSON.stringify({ error: err }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const dispatchId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  if (isDemo(env)) {
    console.log("[demo] log-book", { dispatchId, bookCount: body.books.length });
    return demoJson({ dispatchId });
  }


  // Sequential to respect Notion's ~3 req/sec average rate limit.
  for (const book of body.books) {
    const properties: Record<string, unknown> = {
      [DISPATCH_PROP.bookName]: titleText(book.name),
      [DISPATCH_PROP.dispatchId]: richText(dispatchId),
      [DISPATCH_PROP.category]: select(book.category),
      [DISPATCH_PROP.salesperson]: select(body.salesperson),
      [DISPATCH_PROP.store]: select(body.store),
      [DISPATCH_PROP.clientName]: richText(body.clientName),
      [DISPATCH_PROP.clientPhone]: richText(body.clientPhone),
      [DISPATCH_PROP.clientAddress]: richText(body.clientAddress),
      [DISPATCH_PROP.returnBy]: date(body.returnBy),
      [DISPATCH_PROP.dateSent]: date(nowIso),
      [DISPATCH_PROP.purpose]: richText(body.purpose || ""),
      [DISPATCH_PROP.status]: select("Pending Approval"),
    };
    // Only link to the catalogue when the book came from it (manual
    // books have id="").
    if (book.id) {
      properties[DISPATCH_PROP.bookRelation] = relation([book.id]);
    }
    await createPage(env.NOTION_TOKEN, env.NOTION_DISPATCH_DB_ID, properties);
  }

  await sendPumble(env.PUMBLE_WEBHOOK_URL, buildPumbleMessage(env, dispatchId, body));

  return new Response(JSON.stringify({ dispatchId }), {
    headers: { "content-type": "application/json" },
  });
}

function buildPumbleMessage(env: Env, dispatchId: string, body: Payload): string {
  const bookList = body.books.map((b) => `• ${md(b.name)} _(${md(b.category)})_`).join("\n");

  const linkFor = (approver: string, action: "approve" | "reject") =>
    `${env.APP_BASE_URL}/approve?dispatch_id=${encodeURIComponent(dispatchId)}` +
    `&action=${action}&approver=${encodeURIComponent(approver)}`;

  const approverLinks = [env.APPROVER_1_NAME, env.APPROVER_2_NAME]
    .filter(Boolean)
    .map(
      (a) =>
        `*${md(a)}*: [Approve](${linkFor(a, "approve")}) · [Reject](${linkFor(a, "reject")})`
    )
    .join("\n");

  return [
    `*New sample book dispatch — approval needed*`,
    ``,
    `*Salesperson:* ${md(body.salesperson)}  ·  *Store:* ${md(body.store)}`,
    `*Client:* ${md(body.clientName)}  ·  ${md(body.clientPhone)}`,
    `*Address:* ${md(body.clientAddress)}`,
    `*Return by:* ${md(body.returnBy)}`,
    body.purpose ? `*Purpose:* ${md(body.purpose)}` : "",
    ``,
    `*Books (${body.books.length}):*`,
    bookList,
    ``,
    approverLinks,
  ]
    .filter(Boolean)
    .join("\n");
}
