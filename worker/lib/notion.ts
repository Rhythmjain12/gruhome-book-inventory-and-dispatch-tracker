// Minimal Notion REST client. We avoid `@notionhq/client` to keep the
// Worker bundle small and free of Node-isms. Only the surface area we
// actually use is wrapped.

const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
}

export type NotionProperty =
  | { type: "title"; title: NotionRichText[] }
  | { type: "rich_text"; rich_text: NotionRichText[] }
  | { type: "select"; select: { name: string } | null }
  | { type: "date"; date: { start: string; end?: string | null } | null }
  | { type: "relation"; relation: Array<{ id: string }> }
  | { type: "formula"; formula: { type: string; [k: string]: unknown } }
  | { type: "rollup"; rollup: { type: string; [k: string]: unknown } }
  | { type: "checkbox"; checkbox: boolean }
  | { type: "number"; number: number | null };

export interface NotionRichText {
  plain_text: string;
  text?: { content: string };
}

export class NotionError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call<T>(
  token: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new NotionError(
      `Notion ${method} ${path} failed: ${res.status}`,
      res.status,
      text
    );
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/** Paginated database query. Returns every matching page. */
export async function queryDatabaseAll(
  token: string,
  databaseId: string,
  body: {
    filter?: unknown;
    sorts?: unknown;
  } = {}
): Promise<NotionPage[]> {
  const out: NotionPage[] = [];
  let cursor: string | undefined;
  // Notion rate limit is ~3 req/sec average — pagination loops naturally
  // stay under that for any realistic catalogue size.
  // Safety cap stops runaway pagination if Notion misbehaves.
  for (let i = 0; i < 50; i++) {
    const page: {
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    } = await call(token, "POST", `/databases/${databaseId}/query`, {
      ...body,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    out.push(...page.results);
    if (!page.has_more || !page.next_cursor) return out;
    cursor = page.next_cursor;
  }
  return out;
}

export function createPage(
  token: string,
  databaseId: string,
  properties: Record<string, unknown>
): Promise<NotionPage> {
  return call(token, "POST", "/pages", {
    parent: { database_id: databaseId },
    properties,
  });
}

export function updatePage(
  token: string,
  pageId: string,
  properties: Record<string, unknown>
): Promise<NotionPage> {
  return call(token, "PATCH", `/pages/${pageId}`, { properties });
}

// ---------- Property helpers ----------

export function titleText(value: string) {
  return { title: [{ type: "text", text: { content: value } }] };
}
export function richText(value: string) {
  return { rich_text: [{ type: "text", text: { content: value } }] };
}
export function select(name: string) {
  return { select: { name } };
}
export function date(iso: string) {
  return { date: { start: iso } };
}
export function relation(ids: string[]) {
  return { relation: ids.map((id) => ({ id })) };
}

// ---------- Property readers (safe) ----------

export function readTitle(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== "title") return "";
  return prop.title.map((t) => t.plain_text).join("").trim();
}
export function readRichText(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text.map((t) => t.plain_text).join("").trim();
}
export function readSelect(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== "select" || !prop.select) return "";
  return prop.select.name;
}
export function readDate(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== "date" || !prop.date) return "";
  return prop.date.start;
}
export function readRelationIds(prop: NotionProperty | undefined): string[] {
  if (!prop || prop.type !== "relation") return [];
  return prop.relation.map((r) => r.id);
}

/** Walk the properties map and return the value of the (single) title-typed column. */
export function findTitleValue(page: NotionPage): string {
  for (const v of Object.values(page.properties)) {
    if (v.type === "title") return readTitle(v);
  }
  return "";
}
