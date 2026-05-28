// Daily cron handler. Called from `scheduled()` in worker/index.ts at
// 09:00 IST (03:30 UTC).
//
// For every dispatch where Status = "Out in Field" and Return By is
// before today, send one Pumble message:
//   - to the approver channel (raw)
//   - to the staff channel with @mention of the salesperson
//
// We group by Dispatch ID so a 5-book dispatch generates a single
// message, not five.

import type { Env } from "../index";
import {
  queryDatabaseAll,
  readDate,
  readRichText,
  readSelect,
  readTitle,
} from "../lib/notion";
import { md, sendPumble } from "../lib/pumble";
import { DISPATCH_PROP } from "../lib/schema";

interface OverdueGroup {
  dispatchId: string;
  salesperson: string;
  clientName: string;
  clientPhone: string;
  returnBy: string;
  dateSent: string;
  bookNames: string[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysOverdue(returnBy: string, today: string): number {
  const a = new Date(today + "T00:00:00Z").getTime();
  const b = new Date(returnBy + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((a - b) / (24 * 3600 * 1000)));
}

export async function runOverdueCheck(env: Env): Promise<void> {
  const today = todayIso();

  const pages = await queryDatabaseAll(env.NOTION_TOKEN, env.NOTION_DISPATCH_DB_ID, {
    filter: {
      and: [
        {
          property: DISPATCH_PROP.status,
          select: { equals: "Out in Field" },
        },
        {
          property: DISPATCH_PROP.returnBy,
          date: { before: today },
        },
      ],
    },
  });

  const groups = new Map<string, OverdueGroup>();
  for (const page of pages) {
    const p = page.properties;
    const dispatchId = readRichText(p[DISPATCH_PROP.dispatchId]);
    if (!dispatchId) continue;
    let g = groups.get(dispatchId);
    if (!g) {
      g = {
        dispatchId,
        salesperson: readSelect(p[DISPATCH_PROP.salesperson]),
        clientName: readRichText(p[DISPATCH_PROP.clientName]),
        clientPhone: readRichText(p[DISPATCH_PROP.clientPhone]),
        returnBy: readDate(p[DISPATCH_PROP.returnBy]),
        dateSent: readDate(p[DISPATCH_PROP.dateSent]),
        bookNames: [],
      };
      groups.set(dispatchId, g);
    }
    g.bookNames.push(readTitle(p[DISPATCH_PROP.bookName]));
  }

  if (groups.size === 0) {
    console.log("Overdue check: nothing overdue.");
    return;
  }

  for (const g of groups.values()) {
    const overdueBy = daysOverdue(g.returnBy, today);
    const message = [
      `*Overdue sample books — ${overdueBy} day${overdueBy === 1 ? "" : "s"} late*`,
      ``,
      `*Client:* ${md(g.clientName)}  ·  ${md(g.clientPhone)}`,
      `*Salesperson:* @${md(g.salesperson)}`,
      `*Sent:* ${md(g.dateSent.slice(0, 10))}  ·  *Return by:* ${md(g.returnBy)}`,
      ``,
      `*Books:*`,
      g.bookNames.map((n) => `• ${md(n)}`).join("\n"),
    ].join("\n");

    // Approver channel — full context.
    await sendPumble(env.PUMBLE_WEBHOOK_URL, message);
    // Staff channel — same message, salesperson is @-mentioned so they
    // get a personal ping (per Q1 answer).
    await sendPumble(env.PUMBLE_WEBHOOK_URL_STAFF, message);
  }
}
