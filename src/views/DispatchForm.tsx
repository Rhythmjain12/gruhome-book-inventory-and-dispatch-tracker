// Staff-side dispatch form. Single-form-per-client-visit per spec.
// Speed is the dominant design constraint — every field is reachable
// without scrolling on a phone, search results stream as the user types,
// and validation only fires on submit (not on blur) to avoid distraction.

import { useMemo, useState } from "react";
import type { Book, Category, Store } from "../types";
import { useCatalogue, invalidateCatalogue } from "../lib/catalogueCache";
import { api, ApiError } from "../lib/api";
import {
  Alert,
  Button,
  Field,
  Pill,
} from "../components/primitives";

const CATEGORIES: readonly Category[] = [
  "Fabric",
  "Wallpaper",
  "Leather",
  "Blinds",
  "Carpet",
  "Flooring",
  "Upholstery",
  "Other",
];
const STORES: readonly Store[] = ["Preet Vihar", "Noida"];

interface SelectedBook {
  /** Empty string for manually-added books. */
  id: string;
  name: string;
  category: Category;
  currentlyOut: boolean;
}

interface Props {
  salesperson: string;
  onSubmitted: (dispatchId: string, books: SelectedBook[]) => void;
}

export function DispatchForm({ salesperson, onSubmitted }: Props) {
  const catalogue = useCatalogue();

  const [store, setStore] = useState<Store>("Preet Vihar");
  const [includeOtherStore, setIncludeOtherStore] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [returnBy, setReturnBy] = useState("");
  const [purpose, setPurpose] = useState("");

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [selected, setSelected] = useState<SelectedBook[]>([]);

  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState<Category>("Fabric");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const results = useMemo<Book[]>(() => {
    if (!catalogue.books) return [];
    const q = search.trim().toLowerCase();
    return catalogue.books.filter((b) => {
      if (activeCategory !== "All" && b.category !== activeCategory) return false;
      if (!includeOtherStore && b.homeStore !== store) return false;
      if (q && !b.name.toLowerCase().includes(q)) return false;
      // Hide already-selected books to keep the list short.
      if (selected.some((s) => s.id === b.id)) return false;
      return true;
    }).slice(0, 30);
  }, [catalogue.books, search, activeCategory, includeOtherStore, store, selected]);

  const outInFieldCount = selected.filter((s) => s.currentlyOut).length;

  function addBook(b: Book) {
    setSelected((cur) => [
      ...cur,
      { id: b.id, name: b.name, category: b.category, currentlyOut: b.currentlyOut },
    ]);
    setSearch("");
  }

  function removeBook(idx: number) {
    setSelected((cur) => cur.filter((_, i) => i !== idx));
  }

  function addManual() {
    const name = manualName.trim();
    if (!name) return;
    setSelected((cur) => [
      ...cur,
      { id: "", name, category: manualCategory, currentlyOut: false },
    ]);
    setManualName("");
  }

  function validate(): string | null {
    if (!clientName.trim()) return "Client name is required.";
    if (!clientPhone.trim()) return "Client phone is required.";
    if (!clientAddress.trim()) return "Client address is required.";
    if (!returnBy) return "Return-by date is required.";
    const today = new Date().toISOString().slice(0, 10);
    if (returnBy < today) return "Return-by date must be today or later.";
    if (selected.length === 0) return "Add at least one book.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const { dispatchId } = await api.logBook({
        salesperson,
        store,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientAddress: clientAddress.trim(),
        returnBy,
        purpose: purpose.trim(),
        books: selected.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
        })),
      });
      // After a successful submit the cached `currentlyOut` flags are stale
      // for the just-dispatched books — drop the cache so the next form
      // open re-fetches.
      invalidateCatalogue();
      onSubmitted(dispatchId, selected);
    } catch (e2) {
      setFormError(
        e2 instanceof ApiError
          ? e2.message
          : "Couldn't submit. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 style={{ marginBottom: 16 }}>New dispatch</h2>

      {/* Store + client section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <Field label="Store">
          <div className="pill-row">
            {STORES.map((s) => (
              <Pill key={s} active={store === s} onClick={() => setStore(s)}>
                {s}
              </Pill>
            ))}
          </div>
        </Field>

        <div className="field-row">
          <Field label="Client name">
            <input
              className="input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Mr. / Mrs. ..."
              autoComplete="off"
            />
          </Field>
          <Field label="Client phone">
            <input
              className="input"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="98xxxxxxxx"
              inputMode="tel"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="Client address">
          <textarea
            className="textarea"
            rows={2}
            value={clientAddress}
            onChange={(e) => setClientAddress(e.target.value)}
            placeholder="House/flat, street, area"
          />
        </Field>

        <div className="field-row">
          <Field label="Return by">
            <input
              className="input"
              type="date"
              value={returnBy}
              onChange={(e) => setReturnBy(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Project notes" hint="optional">
            <input
              className="input"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. drawing room curtains"
            />
          </Field>
        </div>
      </div>

      {/* Book selection */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Books</h3>

        {catalogue.error && (
          <Alert variant="red">
            Catalogue failed to load: {catalogue.error}.{" "}
            <Button type="button" variant="ghost" onClick={catalogue.refresh}>
              Retry
            </Button>
          </Alert>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 'warwick', 'velvet', 'cole'…"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={catalogue.refresh}
            title="Re-fetch catalogue from Notion"
          >
            Refresh
          </Button>
        </div>

        <div className="pill-row" style={{ marginBottom: 10 }}>
          <Pill
            active={activeCategory === "All"}
            onClick={() => setActiveCategory("All")}
          >
            All
          </Pill>
          {CATEGORIES.map((c) => (
            <Pill
              key={c}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </Pill>
          ))}
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--ink-2)",
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={includeOtherStore}
            onChange={(e) => setIncludeOtherStore(e.target.checked)}
          />
          Include books from the other store (inter-store dispatch)
        </label>

        {/* Search results */}
        {catalogue.loading && !catalogue.books && (
          <div style={{ color: "var(--ink-3)", padding: 12 }}>Loading catalogue…</div>
        )}
        {catalogue.books && results.length === 0 && search && (
          <div style={{ color: "var(--ink-3)", padding: 12, fontSize: 14 }}>
            No matches. Add manually below if it's not in the catalogue.
          </div>
        )}
        {results.length > 0 && (
          <div
            style={{
              maxHeight: 240,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              marginBottom: 12,
            }}
          >
            {results.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => addBook(b)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--white)",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {b.category} · {b.homeStore}
                    {b.currentlyOut && " · ⚠ currently out"}
                  </div>
                </div>
                <span style={{ color: "var(--accent)", fontSize: 18 }}>+</span>
              </button>
            ))}
          </div>
        )}

        {/* Manual add */}
        <details>
          <summary style={{ cursor: "pointer", color: "var(--ink-2)", fontSize: 14, marginBottom: 10 }}>
            Not in catalogue? Add manually
          </summary>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
            <div style={{ flex: 2 }}>
              <input
                className="input"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Book name"
              />
            </div>
            <div style={{ flex: 1 }}>
              <select
                className="select"
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" variant="secondary" onClick={addManual}>
              Add
            </Button>
          </div>
        </details>

        {/* Selected list */}
        {selected.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
              {selected.length} book{selected.length === 1 ? "" : "s"} selected
            </div>
            {outInFieldCount > 0 && (
              <Alert variant="amber">
                {outInFieldCount} of these are marked as currently out. They may
                not be physically available — confirm with whoever has them before
                you submit.
              </Alert>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selected.map((b, i) => (
                <div
                  key={`${b.id}|${i}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "var(--sand-dark)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {b.category}{b.id === "" && " · added manually"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBook(i)}
                    style={{ color: "var(--ink-3)", fontSize: 16, padding: 4 }}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {formError && <Alert variant="red">{formError}</Alert>}

      <Button type="submit" variant="primary" block disabled={submitting}>
        {submitting ? "Submitting…" : "Submit for approval"}
      </Button>
    </form>
  );
}
