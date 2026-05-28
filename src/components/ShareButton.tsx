// One-tap share with native sheet on mobile, clipboard fallback elsewhere.
// Renders a button that shows "Copied" briefly after a clipboard fallback.

import { useState } from "react";
import { Button } from "./primitives";
import { shareOrCopy, type ShareSubject } from "../lib/share";

interface Props {
  subject: ShareSubject;
  label?: string;
  variant?: "primary" | "secondary";
  block?: boolean;
}

export function ShareButton({
  subject,
  label = "Share",
  variant = "secondary",
  block,
}: Props) {
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    setHint(null);
    try {
      const result = await shareOrCopy(subject);
      if (result === "copied") {
        setHint("Copied");
        setTimeout(() => setHint(null), 2500);
      }
      // For "shared" the OS already gave the user feedback.
      // For "cancelled" we stay silent.
    } catch (e) {
      setHint("Couldn't share");
      setTimeout(() => setHint(null), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      block={block}
      disabled={busy}
      onClick={onClick}
    >
      {hint ?? (busy ? "…" : label)}
    </Button>
  );
}
