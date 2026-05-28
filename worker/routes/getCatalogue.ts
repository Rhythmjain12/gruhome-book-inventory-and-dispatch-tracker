// GET /api/get-catalogue
//
// Returns the full Book Catalogue with an added `currentlyOut` flag,
// derived live by cross-referencing the Dispatch Records DB for rows
// with Status = "Out in Field". This keeps the availability warning
// honest without requiring the catalogue user to maintain a formula.

import type { Env } from "../index";
import {
  findTitleValue,
  queryDatabaseAll,
  readRelationIds,
  readSelect,
} from "../lib/notion";
import { CATALOGUE_PROP, DISPATCH_PROP } from "../lib/schema";
import { DEMO_CATALOGUE, demoJson, isDemo } from "../lib/demo";

export async function handleGetCatalogue(env: Env): Promise<Response> {
  if (isDemo(env)) return demoJson(DEMO_CATALOGUE);

  const [catalogue, outDispatches] = await Promise.all([
    queryDatabaseAll(env.NOTION_TOKEN, env.NOTION_CATALOGUE_DB_ID),
    queryDatabaseAll(env.NOTION_TOKEN, env.NOTION_DISPATCH_DB_ID, {
      filter: {
        property: DISPATCH_PROP.status,
        select: { equals: "Out in Field" },
      },
    }),
  ]);

  // Build the set of catalogue page IDs that are currently dispatched.
  const outSet = new Set<string>();
  for (const dp of outDispatches) {
    for (const id of readRelationIds(dp.properties[DISPATCH_PROP.bookRelation])) {
      outSet.add(id);
    }
  }

  const books = catalogue.map((page) => ({
    id: page.id,
    name: findTitleValue(page),
    category: inferCategory(page.properties),
    homeStore: readSelect(page.properties[CATALOGUE_PROP.homeStore]) || "Preet Vihar",
    currentlyOut: outSet.has(page.id),
  }));

  return new Response(JSON.stringify(books), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * The catalogue spec doesn't fix a Category column name (the existing
 * Notion DB pre-dates this app). We accept a few likely names so the
 * founder doesn't have to rename a column they already have.
 */
function inferCategory(props: Record<string, { type: string } & Record<string, unknown>>): string {
  // Accept the column under a few common names so the founder doesn't
  // have to rename what they already have.
  for (const key of ["Category", "Book Type", "Type", "Kind"]) {
    const p = props[key];
    if (p && p.type === "select" && p.select && typeof (p.select as { name?: string }).name === "string") {
      return (p.select as { name: string }).name;
    }
  }
  return "Fabric";
}
