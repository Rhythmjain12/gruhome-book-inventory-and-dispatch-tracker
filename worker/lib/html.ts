// Server-rendered HTML for the /approve confirmation page that opens
// after a Pumble link tap. Self-contained — same dark + gold tokens as
// the React app so it doesn't feel like a different system.

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface PageOptions {
  title: string;
  heading: string;
  subheading?: string;
  tone: "green" | "red" | "amber";
  detail?: { label: string; value: string }[];
}

export function renderConfirmationPage(opts: PageOptions): Response {
  const tone =
    opts.tone === "green"
      ? { bg: "#1F2D14", fg: "#8FB85A" }
      : opts.tone === "red"
        ? { bg: "#2D1414", fg: "#D97A7A" }
        : { bg: "#2D2310", fg: "#D9A95B" };

  const detailHtml = (opts.detail ?? [])
    .map(
      (d) =>
        `<div class="row"><div class="lbl">${escape(d.label)}</div><div>${escape(
          d.value
        )}</div></div>`
    )
    .join("");

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0E0D0B" />
  <title>${escape(opts.title)} — Gruhome</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: dark; }
    body { font-family: 'DM Sans', system-ui, sans-serif; background: #0E0D0B; color: #F3EAD4; margin: 0; padding: 24px; }
    .wrap { max-width: 440px; margin: 60px auto; }
    .card { background: #181610; border: 1px solid rgba(201,169,97,.32); border-radius: 14px; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
    h1 { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 28px; margin: 0 0 8px; color: ${tone.fg}; letter-spacing: -0.01em; }
    .sub { color: #C5B993; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
    .banner { background: ${tone.bg}; color: ${tone.fg}; padding: 12px 16px; border-radius: 10px; font-size: 14px; margin-bottom: 22px; font-weight: 500; border: 1px solid ${tone.fg}33; }
    .row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid rgba(201,169,97,.14); }
    .row:last-child { border-bottom: none; }
    .row > div:last-child { color: #F3EAD4; text-align: right; }
    .lbl { color: #7E7660; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; flex-shrink: 0; }
    .brand { font-family: 'Playfair Display', serif; color: #C9A961; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; text-align: center; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">Gruhome</div>
    <div class="card">
      <h1>${escape(opts.heading)}</h1>
      ${opts.subheading ? `<div class="sub">${escape(opts.subheading)}</div>` : ""}
      <div class="banner">${escape(opts.title)}</div>
      ${detailHtml}
    </div>
  </div>
</body>
</html>`;
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
