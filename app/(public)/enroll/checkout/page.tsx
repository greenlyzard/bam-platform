import { redirect } from "next/navigation";

// Legacy charge-at-checkout flow removed (superseded by the authorization checkout at
// /enroll/cart → /api/enrollment/checkout). This route is retained only to redirect any
// stale bookmarks/links to the current cart. See docs/BILLING_APPROVAL_AND_DRAW.md.
export default function CheckoutPage() {
  redirect("/enroll/cart");
}
