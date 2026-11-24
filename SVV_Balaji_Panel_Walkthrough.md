# SVV Balaji — Panel Walkthrough & Dependency Guide

*Prepared 23 Nov 2026 by Appzeto. For SVV Balaji operations staff, Super Admin and the project team.*

This guide walks through every panel in the system in the order the work actually happens, explains
what each step needs before it can run, and what breaks downstream if it is skipped. The last section
lists what we still need from SVV Balaji.

---

## 0. The big picture

```
 FARM SIDE                        SUPPLIER SIDE
 Farmer ─► Approval (SVV code)    Supplier ─► Verification
   │                                │
 Agreement / Seeds / Training     Purchase Order (optional)
 Field Visits                       │
   │                              Transport ─► Receive
 Procurement Plan                   │
   │                                │
 Harvest Inspection (quality)       │
   │                                │
 Collection (weight, rate) ─────────┴──►  RAW MATERIAL BATCH  RM-YYYYMMDD-NNN
                                              │   (warehouse stock)
                                              ▼
                       Cleaning & Grading ─► QA Verify
                                              │
                       Recipe (approved) ─► PRODUCTION BATCH  PB-YYYYMMDD-NNN
                                              │   (+ cost, machine, loss)
                                              ▼
                       Quality Inspection ─► FINISHED GOODS   FG-YYYYMMDD-NNN  (QR label)
                                              │   QA release ─► Stock in
                                              ▼
                 Storefront (B2C / B2B) · POS counter · Franchise supply
                                              │
                         Order ─► Dispatch / Quick Delivery (rider) ─► Invoice (GST)
                                              │
                          Returns · Support · Loyalty · Referrals · Affiliates
```

**The traceability promise:** a QR on any pack (`FG-…`) resolves back to the production run
(`PB-…`), the raw batches (`RM-…`) and the farmer (`SVV-2026-…`). Every gate below exists to keep that
chain unbroken.

**Gates are hard, not warnings.** Where this guide says "blocked", the system refuses the action with
a reason. It does not let it through with a warning.

The admin panel has two halves, switched at the top: **Supply Chain** (sections 1–7) and
**Customer & Retail** (sections 8–15). Section 16 covers the separate apps.

---

## 1. Administration — set up first

Done once, before anything else. Most other screens depend on these.

| Step | Panel | What to do |
|---|---|---|
| 1 | **Branches** | Create each branch. Farmers, plans, collections and production all belong to a branch. |
| 2 | **Users** | Create staff accounts (Super Admin only). |
| 3 | **Roles & Permissions** | Decide what each role sees and does. Changes apply on the user's next action. |
| 4 | **GST Settings** | Company GSTIN, legal name, address, invoice numbering, e-invoice switch. |
| 5 | **Checkout & Delivery** | Delivery radius, fees, ETAs, COD limit, stock-hold time. |
| 6 | **Terms & Privacy Policies** | Shown live on storefront and rider sign-in screens. |
| 7 | **Warehouses** (Warehouse menu) | Create warehouses / outlets with capacity. Needed before any stock can exist. |

**If missing:**
- No branch → farmers, plans and collections cannot be created.
- No warehouse → raw batches cannot be stored, finished goods cannot be stocked, nothing can be sold.
- No GSTIN → invoices print without valid company details; e-invoicing cannot run.
- Only one user → steps that need a *second person* (Cleaning QA verify) cannot be completed.

---

## 2. Farm Sourcing — farmers

| Step | Panel | What happens | Needs before |
|---|---|---|---|
| 1 | **Farmer Onboarding** / **Farmers** | Register farmer, add details and documents, verify. **Super Admin approves** → system issues the traceability code `SVV-YYYY-NNNNNN`. | Branch |
| 2 | **Agreements** | Pre-season rate, quality and quantity agreed with the farmer. | Approved farmer |
| 3 | **Seed Stock** | Seed / agri-input lots per branch. | Branch |
| 4 | **Seed Distribution** | Seeds handed to farmers; deducts from Seed Stock. | Seed Stock, farmer |
| 5 | **Training** | Executive trains farmers at the farm, records the session here (no farmer login). | Farmer |
| 6 | **Field Visits** | Crop growth, health, pest/disease, advice, yield prediction. Also captured offline in the Field app. | Farmer |

**If missing:**
- **Farmer not approved (no SVV code)** → cannot be inspected or collected from. This is the
  start of traceability, so it is a hard gate.
- No agreement → collection still works, but the rate must be typed every time (the agreement
  rate is the fallback).
- No Seed Stock → Seed Distribution cannot deduct; seed records go out of balance.
- Training / Field Visits skipped → nothing blocks, but farmer performance and yield prediction
  have no data.

---

## 3. Supplier Sourcing — traders and companies

| Step | Panel | What happens | Needs before |
|---|---|---|---|
| 1 | **Suppliers** | Register supplier (company, GSTIN, bank). **Verify** → approve (gets supplier code) or reject & blacklist. | — |
| 2 | **Transporters** | Register transport companies (contact, GSTIN/PAN, insurance). Used by supplier transports *and* farmer collections. **View** shows full details. | — |
| 3 | **Purchase Orders** | What will be bought: supplier, material, quantity, rate, dates, quality, terms. Draft → **Confirm**. | Supplier |
| 4 | **Transports** | Schedule the delivery trip: supplier, optional PO, material, quantity, rate, vehicle source (supplier / registered transporter), driver. **Dispatch** → In transit. | Supplier (+ PO, transporter if used) |
| 5 | **Transports → Receive** | Choose warehouse, weighed quantity, rate. System issues a GRN, **creates raw batch `RM-…`** and books it into stock. Linked PO moves to Partially Fulfilled / Fulfilled automatically. | Warehouse |

**If missing:**
- Supplier blacklisted / suspended → transports refused.
- Transport not linked to a PO → nothing blocks, but the PO never auto-fulfils and the PO rate is
  not used as fallback.
- **No purchase rate** on the transport or PO → production cost shows "missing rate" for that raw
  batch.
- Transport never received → no raw batch → that material cannot enter production.
- Transporter deactivated → cannot be chosen for new trips. Expired insurance is flagged in the list.

---

## 4. Procurement — buying from farmers

| Step | Panel | What happens | Needs before |
|---|---|---|---|
| 1 | **Procurement Plans** | Target: crop, branch, quantity, date window. Shows **Collected vs Planned** with a progress bar. Status moves itself: Draft/Scheduled → **In Progress** on first inspection/collection → **Completed** when the target is reached. | Branch |
| 2 | **Harvest Inspections** | **Quality only** — moisture, foreign matter, grain size/colour, smell, damage, photos. Result: Approved / Rejected / Hold. *No weight is entered here.* Link it to the plan. | Approved farmer (SVV code) |
| 3 | **Collections** | Pick an **approved** inspection; enter gross/net weight, rate, transport, warehouse. System issues a receipt and **creates raw batch `RM-…`** in the same step. | Approved inspection, warehouse |
| 4 | **Collections → Payment** | Mark Paid / Partial: method, date, UTR/cheque no., amount, **proof upload** (required for non-cash). **View** shows the full collection with proof. | Collection |
| 5 | **Raw Material Batches** | Register of all `RM-…` batches with status, warehouse and upstream trace. | — |

**If missing:**
- Inspection not **Approved** → collection refused.
- Inspection not linked to a plan → the collection does not count towards that plan's progress.
- A harvest can be collected **once**. A second collection on the same inspection is refused.
- Collection paid without proof (non-cash) → refused.
- Collection already paid → it cannot be deleted (the payment would have nothing to reconcile
  against).

---

## 5. Warehouse

| Panel | What happens |
|---|---|
| **Warehouses** | Master list, live occupancy against capacity. |
| **Stock** | Batch-wise stock with stock in / out / transfer / adjust. Low-stock alerts. |
| **Movement Ledger** | Read-only audit trail. Every stock change writes a row here. |

**If missing:** a raw batch collected/received without a warehouse stays "Collected" rather than
"Stored". Production draws from a named warehouse, so material must be in that warehouse first.

---

## 6. Processing & QA — making the product

Follow the menu order; it matches the working order.

| Step | Panel | What happens | Needs before |
|---|---|---|---|
| 1 | **Products** | Product master: details, category, B2B + B2C price, media, pack sizes (variants), inventory thresholds. The form is in 7 steps with **Next / Back**. | Category |
| 2 | **Recipes** | Formula per product: ingredients (crop, quantity, %), batch yield, expected loss %. **Super Admin approves.** Approved = locked; a change is a new version. | Product |
| 3 | **Machines** | Machine list; utilisation is calculated from runs. | — |
| 4 | **Cleaning & Grading** | Record cleaning of a raw batch: grading, moisture, purity, wastage, by-product. Then **a different user with QA rights clicks Verify**. | Raw batch |
| 5 | **Production Batches** | Create run with the **approved** recipe + raw batches + warehouse + machine → **Start** (stock is consumed) → **Complete** with actual output and by-product. System calculates loss. Creates `PB-…`. The recipe version is pinned to the run. | Approved recipe, verified cleaning, stock |
| 6 | **Production Cost** | Open a production batch → **Record cost**: labour, machine, loss, other. Raw-material cost fills itself from the rate paid. The report shows total and cost per unit by product. | Started run |
| 7 | **Quality Inspections** | Raw-material, in-process and finished-goods checks. **Hard gates:** raw FAIL rejects the batch; in-process non-PASS blocks completion; FG FAIL withdraws QA release. | — |
| 8 | **Loss & Yield Tracking** | Read-only: loss at each stage, yield %, alert above the 4–8% normal band, farmer / supplier / machine health flags. | Completed runs |
| 9 | **Finished Goods** | Pack from a **completed** run: pack size, net weight, number of packs → `FG-…` with QR + barcode label. **QA release**, then **Stock in** to a warehouse. | Completed run, QA release |

**If missing:**
- Recipe not approved → production batch refused.
- Raw batch not an ingredient of the recipe → refused. Multigrain blend off by more than 0.5
  percentage points → refused.
- **Cleaning not QA-verified** → production refuses that raw batch. The person who recorded the
  cleaning cannot verify it.
- Raw batch rejected by QA, or not in the chosen warehouse → refused.
- Run not started → it cannot be completed or costed. Last in-process inspection not PASS →
  completion refused.
- Output + by-product more than the input consumed → completion refused.
- Run not completed → cannot be packed. Packing more than was produced → refused.
- **FG batch not QA-released** → cannot be stocked. **This is the usual reason a new product shows
  "Out of stock"** on the storefront.
- Cost not recorded → Production Cost shows raw material only; labour/machine/other are 0.

> **Note on multi-output products (e.g. soybean oil + meal):** recipes currently have one loss %, so
> by-products are treated as loss when planning. A full fix is planned
> (`SVV_Balaji_Recipe_ByProducts_Plan.md`). Until then, enter the loss % as everything that is not
> main output, and record the meal as the by-product when completing the run.

---

## 7. Overview — monitoring and traceability

| Panel | What it shows |
|---|---|
| **Dashboard** | Summary across sourcing, procurement, production and sales. |
| **Sales Analytics** | Revenue and orders vs previous period, by channel, product, category, region. |
| **Farmer Onboarding** | Onboarding desk (see section 2). |
| **Trace a Pack** | Enter `FG-…` → production run → raw batches → farmers. Same chain the customer QR resolves. |
| **Recall & Batch Audit** | Forward trace (who received a batch) and backward trace; freeze / recall a batch. |

**If missing:** Trace a Pack only works if every step in sections 2–6 was done in the system. A
batch received outside the system, or stock adjusted in by hand, has no upstream to show.

---

## 8. Catalog & storefront setup

| Step | Panel | What to do |
|---|---|---|
| 1 | **Main Categories / Sub-Categories** | Category tree for the storefront. |
| 2 | **Product List & Editor** | SKU, variants, images, SEO (same product as section 6). **Published** switch controls visibility. |
| 3 | **Tiered Pricing** | B2C MRP and B2B rate cards / volume pricing. |
| 4 | **Inventory & Warehouse** | Reorder point (flag LOW), safety stock (flag CRITICAL), allow backorder. Stock is never typed — it comes from QA-released FG stock minus reservations. |
| 5 | **Banner Management / Homepage Sections** | What the storefront home page shows. |

**If missing:**
- Product not published → invisible to shoppers.
- No price for a channel → that channel cannot buy it.
- No FG stock for that **pack size** in the serving warehouse → "Out of stock" (unless backorder is on).
- Thresholds left at 0 → no LOW/CRITICAL warning until the product is sold out.

---

## 9. Selling — Orders, POS, Franchise

| Panel | What happens |
|---|---|
| **B2C Orders** | Customer checkout orders; payment; stock is reserved, then allocated from FG batches (oldest expiry first). |
| **B2B Orders & Quotes** | Retailer orders, quotes, payment terms, bulk fulfilment. Retailer must be approved first. |
| **Franchise Supply Orders** | Stock supplied to franchise stores. |
| **New Sale (Billing Terminal)** | Walk-in sales at a company store: open a shift, bill from store stock, GST invoice per sale. |
| **POS Counter Orders** | Every counter sale: payment mode, batches sold, re-print, refunds. |
| **Sale Reports & Shift Reconciliation** | Counter sales, payment split, cashier shifts, cash drawer reconciliation. |

**If missing:**
- No FG stock in the store/warehouse → cannot bill or allocate.
- Shift not opened → POS cannot bill.
- Retailer not approved → B2B ordering blocked.
- Because orders allocate real FG batches, Recall can later find exactly which customers got which
  batch.

---

## 10. Quick Delivery — riders

| Step | Panel | What happens |
|---|---|---|
| 1 | **Delivery Zones** | Where Quick Delivery runs: boundaries/pincodes/radius, outlet, promised time, fee. |
| 2 | **Delivery Settings** | Auto-offer timing, geofence, COD rules, failure reasons. |
| 3 | **Pay Rules** | Base, distance slabs, peak, incentives, targets, compensation. |
| 4 | **Pending Approval → Document Verification** | Rider signs up in the Rider app, uploads documents and PCC; staff verify, then approve with a home outlet. |
| 5 | **Delivery Board / Live Riders** | Orders auto-offered to riders; track live; handle failed / re-attempts. |
| 6 | **Rider Earnings → Rider Payouts / Cash & Deposits** | What riders earned, payouts, COD cash held and deposited. |

**If missing:**
- No zone covering the address → no Quick Delivery for that customer.
- Rider not approved / documents pending → rider gets no orders.
- No pay rules → earnings calculate as zero.
- COD cash not deposited → shows as outstanding against the rider.

---

## 11. Billing, finance and GST

| Panel | What happens |
|---|---|
| **Tax Invoices** | GST invoice at dispatch (CGST/SGST or IGST), HSN summary, e-invoice (IRN) status for B2B. |
| **Invoicing & Payments** | Gateway logs, offline payment reconciliation. |
| **Earnings & Financial MIS** | Billed vs collected per channel, refunds, GST liability, receivables, payables. |
| **GSTR-1** (Administration) | Monthly outward supplies + JSON for the GST offline tool. |

**If missing:** no GSTIN in GST Settings → invoices invalid. No GSP credentials → no IRN on B2B
invoices (see client requirement A-11).

---

## 12. Customers & retailers (CRM)

| Panel | What happens |
|---|---|
| **B2C Customers** | Profiles, order history, lifetime value, addresses. |
| **Retailer Approvals & B2B Accounts** | Retailers self-register with GSTIN; Super Admin approves after checks. |

**If missing:** retailer not approved → cannot see B2B prices or order.

---

## 13. Returns, support and notifications

| Panel | What happens |
|---|---|
| **Return & Exchange Settings** | Windows, reasons, photo/QC rules, refund methods — separately for customers and retailers. |
| **Customer Returns / Retailer Returns** | Approve → pickup (rider / courier) → QC → refund or replacement (retailers get credit notes). |
| **Support & Complaints Hub** | One desk for messages, evidence, batch trace and refunds. |
| **Helpdesk & Support Settings** | Helpline, WhatsApp, hours, FAQs shown in the apps. |
| **Push Notifications** | Send to customers, retailers, riders, staff or individuals. |

**If missing:** no return settings → return requests cannot be validated. A complaint about a pack
can be traced to its farmer only if section 6 was completed for that batch.

---

## 14. Promotions and loyalty

| Panel | What happens |
|---|---|
| **Schemes & Offers** | Offers shown on the storefront. |
| **Loyalty Rewards** | Earn % per channel, point value, caps, expiry. Points credited when an order is **delivered**. |
| **Referral & Reward Settings / Referral Management** | Refer-a-friend coins and tracking. |
| **Coin & Points Ledger** | Every point and coin given, used, reversed or expired. |
| **Affiliates / Affiliate Commission Rates / Affiliate Payouts** | Approve affiliates, commission per category, pay matured commission. |

**If missing:** order never marked delivered → loyalty points never credit. Commission rates not set
→ affiliates earn nothing.

---

## 15. One complete example — from field to customer

1. Branch "Indore" exists; warehouse "Indore Main" exists.
2. Farmer registered → Super Admin approves → `SVV-2026-000026`.
3. Procurement Plan: soybean, 50,000 KG, November.
4. Harvest Inspection (linked to plan): moisture 11%, Approved.
5. Collection: 5,000 KG net @ ₹40, transporter TRN-0001 → raw batch `RM-20261123-001` in Indore Main.
   Plan progress shows 10%.
6. Payment: UPI, UTR entered, screenshot uploaded → Paid.
7. Cleaning & Grading recorded by operator → QA user verifies.
8. Production Batch with approved recipe v1 → Start → Complete → `PB-20261124-001`. Record cost.
9. In-process QA PASS → Finished Goods: 1,000 × 1 L packs → `FG-20261124-001` (QR printed)
   → FG QA PASS → release → Stock in to Indore Main.
10. Storefront shows **In stock**. Customer orders → stock allocated from `FG-20261124-001` →
    rider delivers → invoice issued → loyalty points credited.
11. Customer scans the QR → sees the farmer, harvest and production run.

Skip any one of steps 2, 4, 5, 7, 8 or 9 and the product never reaches "In stock".

---

## 16. Other apps

| App | Who uses it | Connects to |
|---|---|---|
| **Field app** | Agriculture experts / executives | Farmers, field visits (works offline), inspections. |
| **Customer app (storefront)** | B2C customers and retailers | Catalog, prices, stock, orders, returns, loyalty, referrals. |
| **Rider app** | Delivery riders | Sign-up & documents, offered deliveries, OTP delivery, COD cash, earnings. |

---

## 17. What we need from SVV Balaji

### Urgent

| Ref | Requirement | Why |
|---|---|---|
| **A-10** | Written agreement on cost and timeline for the added B2C scope | Commercial; open since August |
| **A-11** | GST Suvidha Provider name, company GSTIN, API credentials | Invoicing is built and waiting; no IRN without it |

### Decisions

| Ref | Decision | Today, without it |
|---|---|---|
| A-04 | Cloud storage provider; retention/access policy for farmer KYC images | Interim Cloudinary account |
| A-01 | Approve the schedule baseline | Open |
| A-08 | Hosting upgrade path | Open |
| 28 Oct §1 | How much the raw material used may differ from the recipe (recommended: warn ±5%, block ±10%, override by Production Manager); one limit for all or per recipe | No amount check, only blend ratio |
| 28 Oct §2 | What happens to planned runs when a new recipe version is approved | Blocked at Start; must re-plan |
| 28 Oct §3 | Oil measured in litres or KG; density to use | Loss left empty for litre output |
| A-15 | Should by-products (e.g. soybean meal) become sellable stock? Approved main / by-product / loss % per product | By-products treated as loss when planning |
| — | Should purchase orders be created automatically (from procurement plans, or from unplanned deliveries)? | Created by hand |

### Data and people

| Ref | Requirement |
|---|---|
| A-06 | Customer and product master data |
| A-07 | UAT participants |
| — | Purchase rates on every collection / supplier delivery (otherwise production cost is incomplete) |
| — | How staff should calculate labour, machine and "other" cost per run, so everyone enters it the same way |
| — | Product thresholds: reorder point and safety stock per product |
| — | At least one QA user separate from production operators (cleaning verification needs a second person) |
