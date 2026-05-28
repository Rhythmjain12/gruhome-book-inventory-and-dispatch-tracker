// Canonical column names for the Notion Dispatch Records database.
// SETUP.md requires the founder to use these names exactly when creating
// the database — any mismatch surfaces as a Notion 400 the founder can
// fix without redeploying.

export const DISPATCH_PROP = {
  bookName: "Book Name",       // Title
  dispatchId: "Dispatch ID",   // Text
  bookRelation: "Book",        // Relation → Catalogue
  category: "Category",        // Select
  salesperson: "Salesperson",  // Select
  store: "Store",              // Select
  clientName: "Client Name",   // Text
  clientPhone: "Client Phone", // Text
  clientAddress: "Client Address", // Text
  returnBy: "Return By",       // Date
  dateSent: "Date Sent",       // Date
  purpose: "Purpose",          // Text
  status: "Status",            // Select
  approvedBy: "Approved By",   // Text
  approvedAt: "Approved At",   // Date
  recalledAt: "Recalled At",   // Date
} as const;

// Extra columns added to the existing Book Catalogue database.
// The Title column keeps whatever name it already has — we read it by
// type rather than by name.
export const CATALOGUE_PROP = {
  homeStore: "Home Store",     // Select
} as const;
