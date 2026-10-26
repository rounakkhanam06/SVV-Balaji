# Flow-integrity audit — fix status, open items, admin screen changes

**Date:** 22 October 2026 · **Branch:** `fix/audit-flow-integrity` (not merged, not deployed)
**Client decisions this depends on:** `SVV_Balaji_Pending_Decisions_22Oct.md`

## 1. Deploy notes (when this branch is merged)

Two additive migrations. Run `npx prisma migrate deploy`, then generate, then restart the API. Rebuild admin and customer.

| Migration | What |
|---|---|
| `20261022150000_product_variant_stock` | `variantId` on `finished_goods_batches`, `order_items`, `stock_reservations`; `packWeightKg` on `product_variants`; order-line unique index becomes `(orderId, productId, COALESCE(variantId,''))` |
| `20261022160000_undelivered_quarantine` | `finished_goods_stock.quarantineQuantity` + enum values `UNDELIVERED_QUARANTINE`, `QUARANTINE_RELEASE` |

⚠️ The order-line unique index is an **expression index** that Prisma cannot declare. A future
`prisma migrate dev` will propose dropping it. Remove that line from any generated migration.

## 2. Contract changes (API)

- Storefront cart `productId` may now be a **variant id** (it always was on the client; the server now accepts it).
- Quote lines and order items gain `variantId` (null = the product's own pack). Quote `lines[].productId` is now always the **parent** product.
- `POST /finished-goods` accepts optional `variantId`; the pack weight must equal the variant's `packWeightKg` when set.
- Product variants accept `packWeightKg`. A sold or packed variant removed from the form is set **inactive**, not deleted.
- Storefront product detail: `variants[].availableQuantity`. Stock figures now also subtract held/committed reservations.
- `POST /orders/:id/close-undelivered` now **quarantines** the packs (it no longer restocks them).
- New: `GET` / `POST /orders/:id/undelivered-qc` (permission `orders.closeUndelivered`).
- New refusals (400): dispatch of a short-allocated order; override to DELIVERED on a LOCAL order without a verified OTP; production status moves outside the transition table; completing an unstarted run; deleting a started run; QC "good" on a held, recalled or expired batch.

## 3. Status per fix

| Fix | Status | Verified by |
|---|---|---|
| Production transitions, deduction, reservation, delete | ✅ | unit `production-flow.spec.ts`; e2e recall, loyalty |
| By-product not counted as loss; one running run per machine; recipe re-check at start | ✅ | unit |
| Re-inspection of rejected raw batches; stock-in no longer clears a rejection | ✅ | unit `quality.reinspection.spec.ts` |
| Mandatory QA for supplier batches | ✅ | e2e supplier-transport |
| Pack-unit conversion (G / KG / QUINTAL, ML / L) | ✅ | unit `pack-units.spec.ts`; e2e variants |
| Partial transfer keeps the batch's home warehouse; cleaning uses the home row | ✅ | unit (warehouse spec) |
| Approved recipe can only be retired | ✅ | — (simple guard) |
| **Product variants end to end** | ✅ | unit `stock-holds.variants.spec.ts`, `task-weight.spec.ts`; **e2e `e2e-variants-flow.py`** |
| Partial-shipment guard (no dispatch / invoice while short) | ✅ interim; final rule = decision 2 | unit (sales spec); e2e |
| **Undelivered packs quarantined, QC before resale** | ✅ | unit `undelivered-qc.spec.ts`; e2e undelivered |
| Mandatory delivery OTP on override | ✅ default; decision 1 | e2e order-override |
| Rider assignment by exact phone | ✅ | e2e checkout (external driver path) |
| Recall re-allocation respects holds, re-pack after re-pick | ✅ | e2e recall |

### Test results (22 Oct, final)

- Unit: **957 / 957**.
- E2E, each on its own throwaway local DB: **all passed**: variants, order-override, checkout, recall, loyalty, undelivered, supplier-transport, client-decisions, returns, retailer-routing, quick-delivery, pos.
- **Existing failures (same on the pre-branch code, not caused by this work):** `e2e-broadcast-dispatch-flow.py` (deadlock when an outside driver and an app rider take one task at once) and `e2e-rider-flow.py` (a second accept of the same offer is allowed). Both trace to the 22 Oct rider-accept speed-up in `DispatchService.respond`. That needs fixing before that change is deployed.

## 4. Not done — waiting on a client decision

| Item | Decision | What gets built once answered |
|---|---|---|
| Short-ship with refund, or split shipment | 2 | Invoice from allocated quantity; refund or second task / OTP / invoice |
| Missing pack weight | 3 | Block publishing without weight, or route to manual assignment |
| Two-person recipe approval | 4 | `approve` refuses the creator; named approver role |
| Refund method for undelivered orders | 5 | Same wallet / UPI / bank choice as returns |
| Meaning of "loss" in production cost | 6 | Change the raw-cost basis or drop the line |
| Farmer details on the public QR | 7 | Trace projection change |

## 5. Not done — engineering, no decision needed

- **POS and returns replacements are still product-level.** POS sells the product's own pack only. An exchange replacement is chosen by product, not pack size. Both need a pack-size picker.
- **Staff-entered orders (`POST /orders`) have no pack size.** Lines are the product's own pack.
- **Loyalty "estimate" in the cart** posts cart ids. A variant id gets no estimate line until the endpoint resolves variants as checkout now does.
- **Storefront listing tiles** show any-pack stock; only the product page shows per-pack stock.
- **Stock checks outside transactions** (stock-out, transfer, cleaning, packing). DB constraints prevent negative stock; simultaneous actions return 500 instead of a clear message.
- **Collection gaps:** no recheck of farmer status or agreement at collection; payment status PAID can be set back to PENDING (which unlocks delete); `branchId` not validated against the farmer or warehouse.
- **Manual raw stock-in has no source document.**
- **MRP not checked against the price list; manufacturing date not tied to the production date; expiry not re-checked at dispatch.**
- `storefront-auth.service.spec.ts` (2 tests) is flaky under full-suite load: it passes alone 3 of 3.

## 6. Admin screens that need changing

Done on this branch (small, to stop screens contradicting the API):
- Production batches: **Complete** shows only for started runs; **Delete** explains that only unstarted planned runs can be deleted.
- Order fulfilment panel: after closing an undelivered order, it says the packs are quarantined, not back in stock.

To build:

| Screen | Change |
|---|---|
| **Undelivered QC (new)** | List of orders with quarantined packs (`GET /orders/:id/undelivered-qc`); per batch enter good / damaged with notes (`POST`). Show "batch held / expired, damaged only" from the 400. Entry point: the order's fulfilment panel after close. |
| Product form → pack sizes | `packWeightKg` field per variant. Show a sold variant that was removed as "retired". |
| Finished goods → pack form | Pack-size (variant) picker; prefill net weight from the variant's pack weight. Show pack size in the FG list and stock list. |
| Order detail / pick list / invoice view | Show the pack size (name snapshot already includes it). |
| Packing bench | Show `shortfalls` from start-packing and scan, and explain why "Packed" doesn't happen while short. |
| Status override | Don't offer **Delivered** for a local order without a verified OTP. Offer **Dispatched**, then OTP entry. |
| Production batches | Pause / Resume / Cancel buttons following the transition table. Show the "machine busy" refusal. |
| Recipes | Hide status options other than "Inactive" on an approved version. |
| Inventory / FG stock | Columns for quarantined and damaged quantities. |
| Rider assignment | Ask for the full 10-digit number. |
