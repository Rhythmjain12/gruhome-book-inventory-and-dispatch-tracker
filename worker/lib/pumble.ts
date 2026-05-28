// Pumble webhooks are Slack-compatible incoming webhooks. We post a JSON
// payload with `text` (markdown) — Pumble renders the standard subset.
//
// We deliberately don't throw on Pumble failure: the dispatch flow is more
// important than the notification. We log and continue.

export async function sendPumble(
  webhookUrl: string,
  text: string
): Promise<void> {
  if (!webhookUrl) {
    console.warn("Pumble webhook URL missing — skipping notification");
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Pumble webhook failed:", res.status, body);
    }
  } catch (err) {
    console.error("Pumble webhook threw:", err);
  }
}

/** Escape `[` and `]` so book/client names with brackets can't break markdown. */
export function md(s: string): string {
  return s.replace(/([\[\]])/g, "\\$1");
}
