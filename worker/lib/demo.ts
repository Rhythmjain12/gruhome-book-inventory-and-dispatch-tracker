// Demo-mode fixtures. When DEMO_MODE="1", every read endpoint returns
// these, every mutation returns success without touching Notion or
// Pumble. Intended only for visual previews and local UI work.

const today = new Date();
function isoDays(offset: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const DEMO_CATALOGUE = [
  { id: "d1", name: "Warwick Velvet Collection Vol. 3", category: "Fabric", homeStore: "Preet Vihar", currentlyOut: false },
  { id: "d2", name: "Warwick Linen Naturals", category: "Fabric", homeStore: "Preet Vihar", currentlyOut: true },
  { id: "d3", name: "Cole & Son Wallpaper — Botanical", category: "Wallpaper", homeStore: "Preet Vihar", currentlyOut: false },
  { id: "d4", name: "Cole & Son Wallpaper — Geometric II", category: "Wallpaper", homeStore: "Noida", currentlyOut: false },
  { id: "d5", name: "Hunter Douglas Roller Blinds", category: "Blinds", homeStore: "Noida", currentlyOut: false },
  { id: "d6", name: "Hunter Douglas Roman Shades", category: "Blinds", homeStore: "Preet Vihar", currentlyOut: false },
  { id: "d7", name: "Edelman Italian Leather Swatches", category: "Leather", homeStore: "Noida", currentlyOut: false },
  { id: "d8", name: "Sahco Velvet Lookbook", category: "Fabric", homeStore: "Preet Vihar", currentlyOut: false },
  { id: "d9", name: "Jaipur Rugs — Heritage Wool", category: "Carpet", homeStore: "Noida", currentlyOut: false },
  { id: "d10", name: "Pierre Frey — Heritage", category: "Upholstery", homeStore: "Preet Vihar", currentlyOut: false },
  { id: "d11", name: "Zoffany — English Rose", category: "Wallpaper", homeStore: "Preet Vihar", currentlyOut: false },
  { id: "d12", name: "Italian Marble Flooring Vol. 4", category: "Flooring", homeStore: "Preet Vihar", currentlyOut: false },
  { id: "d13", name: "Sample Set 2026 — Misc", category: "Other", homeStore: "Noida", currentlyOut: false },
];

export const DEMO_DISPATCHES = [
  {
    dispatchId: "demo-pending-001",
    salesperson: "Neha",
    store: "Preet Vihar",
    clientName: "Mrs. Kapoor",
    clientPhone: "9810012345",
    clientAddress: "B-42 Greater Kailash II, New Delhi",
    returnBy: isoDays(7),
    dateSent: new Date().toISOString(),
    purpose: "drawing room curtains",
    status: "Pending Approval",
    books: [
      { bookId: "d1", name: "Warwick Velvet Collection Vol. 3", category: "Fabric" },
      { bookId: "d8", name: "Sahco Velvet Lookbook", category: "Fabric" },
    ],
  },
  {
    dispatchId: "demo-out-002",
    salesperson: "Amit",
    store: "Noida",
    clientName: "Mr. Sharma",
    clientPhone: "9999887766",
    clientAddress: "Tower 4 Flat 1102, Jaypee Greens, Noida",
    returnBy: isoDays(3),
    dateSent: isoDays(-4),
    purpose: "master bedroom blinds + cushions",
    status: "Out in Field",
    approvedBy: "Sunita Gupta",
    approvedAt: isoDays(-4),
    books: [
      { bookId: "d5", name: "Hunter Douglas Roller Blinds", category: "Blinds" },
      { bookId: "d7", name: "Edelman Italian Leather Swatches", category: "Leather" },
      { bookId: "d2", name: "Warwick Linen Naturals", category: "Fabric" },
    ],
  },
  {
    dispatchId: "demo-overdue-003",
    salesperson: "Neha",
    store: "Preet Vihar",
    clientName: "Mrs. Iyer",
    clientPhone: "9820011223",
    clientAddress: "C-8 Vasant Vihar, New Delhi",
    returnBy: isoDays(-2),
    dateSent: isoDays(-12),
    purpose: "study room wallpaper",
    status: "Out in Field",
    approvedBy: "Sunita Gupta",
    approvedAt: isoDays(-12),
    books: [
      { bookId: "d3", name: "Cole & Son Wallpaper — Botanical", category: "Wallpaper" },
      { bookId: "d11", name: "Zoffany — English Rose", category: "Wallpaper" },
    ],
  },
  {
    dispatchId: "demo-recalled-004",
    salesperson: "Ravi",
    store: "Noida",
    clientName: "Dr. Mehta",
    clientPhone: "9971234567",
    clientAddress: "E-204 DLF Phase 4, Gurgaon",
    returnBy: isoDays(-10),
    dateSent: isoDays(-20),
    purpose: "lobby reupholstery",
    status: "Recalled",
    approvedBy: "Rohan Gupta",
    approvedAt: isoDays(-20),
    recalledAt: isoDays(-8),
    books: [
      { bookId: "d10", name: "Pierre Frey — Heritage", category: "Upholstery" },
    ],
  },
];

export function isDemo(env: { DEMO_MODE?: string }): boolean {
  return env.DEMO_MODE === "1";
}

export function demoJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
}
