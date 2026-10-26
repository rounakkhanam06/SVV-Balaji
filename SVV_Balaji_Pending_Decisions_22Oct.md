# SVV Balaji — Decisions Needed Before We Build

**Prepared by:** Appzeto · **Date:** 22 October 2026 · **For:** SVV Balaji management, via Ravi Tiwari

A review of the full farm-to-customer flow found seven points where the system needs a business rule
from you before we finish building it. For each one we set out the options, what each does to **stock,
invoicing, refunds and delivery**, and our recommendation.

Until you answer, the system runs on the **safe default** shown for each point. Nothing is lost by
waiting: each default prevents the problem and doesn't commit you to any option.

Please reply with the option letter for each (for example "1-A, 2-B, …"), or ask us to discuss any of them.

---

## 1. Shop-counter pickup without a delivery OTP

**Situation.** Today every local delivery is closed with the 4-digit OTP the customer reads to the rider.
The revised SOW (point 22) asks for this to be **mandatory**. Sometimes a customer collects the order at
the shop counter instead, and staff want to mark it delivered there.

| | A. OTP always required *(safe default, now live)* | B. Allow a Super Admin "counter pickup" without OTP |
|---|---|---|
| Delivery | Counter staff ask the customer for the OTP shown in their app, as a rider would | Super Admin can mark it delivered with a written reason |
| Stock / invoice | Unchanged: stock leaves and the invoice is raised when the order goes out | Unchanged |
| Refunds / disputes | Proof the customer received it in every case | No customer proof for those orders; a "never received" claim can't be disproved |
| Loyalty / affiliate | Credited only on confirmed delivery | Credited on staff's word |

**Recommendation: A.** The OTP is the only proof of hand-over. The counter flow already works with it.

---

## 2. An order where part of the stock is not available (partial shipment)

**Situation.** An order for 10 packs finds only 6 in the warehouse. Until now the system could pack the 6
and still invoice and charge for all 10.

**Safe default, now live:** the order **cannot be dispatched** until it's fully allocated. Staff must wait
for stock, re-allocate from another batch, or cancel. No one is billed for packs they don't receive.

| | A. Wait for full stock *(current default)* | B. Ship what's there, refund the rest | C. Split into two shipments |
|---|---|---|---|
| Delivery | One delivery, possibly late | One delivery now; the rest never comes | Two deliveries: 6 now, 4 when stock arrives |
| Stock | Held for the order until complete | Shortfall released immediately | Shortfall stays reserved for the second shipment |
| Invoicing | One invoice for the full order | One invoice for the 6 shipped | Two invoices, one per shipment |
| Refunds | None | Automatic refund for the 4, to the customer's chosen method (see point 5) | None, unless the second shipment is later cancelled |
| Delivery fee | Once | Once | Charged once or twice? *(needs a rule)* |
| Customer experience | Slowest | Fast, but the customer gets less than they ordered | Fast and complete, but two hand-overs |
| Effort to build | Done | Medium | Largest (second rider task, second OTP, two GST invoices) |

**Recommendation:** **B for B2C customers** (they would rather have most of it today), and **A or C
for B2B retailers** (they usually need the full quantity). Please tell us whether B2B and B2C should
differ.

---

## 3. Products with no pack weight recorded

**Situation.** You chose to assign quick deliveries **by weight** (10 Oct): riders state how many kg they
can carry, and Super Admin sets a pay-per-kg rule. Both need each product's pack weight. Where a product
has none, the system today **silently skips** the carry-limit check and pays **no per-kg amount**.

| | A. Make pack weight compulsory for anything sold online | B. Unknown weight → no automatic offer; staff assign a rider by hand | C. Keep today's behaviour |
|---|---|---|---|
| Delivery | Every order is checked against rider capacity | Those orders wait on the Delivery Board for staff | Riders may be offered more than they can carry |
| Rider pay | Per-kg pay always correct | Correct once staff assign; per-kg amount still missing | Per-kg pay missing on those orders |
| Catalogue work | Every live product (and each pack size) needs a weight before it can be published | None up front | None |

**Recommendation: A**, with a one-time pass by your team to enter missing weights. We'll give you a list of
the affected products.

---

## 4. Who approves a recipe

**Situation.** The FRD says recipes are created only by the Super Admin and only approved recipes can be
used. Today the same Super Admin who writes a recipe can also approve it. An approved recipe can now only
be retired, never quietly edited (a change is always a new version).

| | A. Keep single approval by Super Admin *(current)* | B. Two-person rule: a second, named role must approve |
|---|---|---|
| Production | Unchanged | A new recipe or version can't be used until the second person approves |
| Control | One person can change a formula of record | No single person can change what goes into the product |
| Who? | — | Please name the role (e.g. QA Manager or Production Head) |

**Recommendation: B**, with the QA Manager as approver, because a recipe decides what is printed on the label.

---

## 5. How an undelivered order is refunded

**Situation.** On 10 October you decided that for **returns** the customer chooses how to be refunded:
Refund Wallet (instant), UPI or bank (paid by Super Admin, reference shown to the customer). When a
**prepaid order cannot be delivered at all**, the money still always goes to the Refund Wallet.

| | A. Same choice as returns: wallet / UPI / bank | B. Keep Refund Wallet only for undelivered orders |
|---|---|---|
| Refunds | Customer picks; UPI/bank wait for Super Admin to pay and record the reference | Instant, but the customer can only spend it with you |
| Finance work | Manual payouts for those who pick UPI/bank | None |
| Consistency | Matches the returns rule you set | Two different rules for the customer to understand |

**Recommendation: A**, for consistency with your 10 October decision.

---

## 6. What "loss" means in production cost

**Situation.** You set production cost as raw material + labour + machine + **loss** + other (10 Oct). The
raw-material figure is already "kilos consumed × purchase rate", which **includes** the kilos lost in
milling. Adding the value of the same lost kilos again as "loss" would **count it twice** and overstate
cost per pack.

| | A. "Loss" = cost of disposing of waste only (transport, handling) | B. "Loss" = value of lost material, and raw cost counts only the kilos that ended up in the product | C. Remove the separate loss line |
|---|---|---|---|
| Cost per pack | Correct; loss shown as its own small line | Correct; the loss is visible as its own figure | Correct; loss is hidden inside raw cost |
| Reports | Raw cost unchanged | Raw cost drops, loss line rises: same total | One line fewer |

**Recommendation: B.** It shows management exactly what milling loss costs, without double counting.

---

## 7. What the pack QR code shows the public

**Situation.** The FRD (30.2) and the revised SOW (point 2) say the QR page shows the **farmer's ID and
name**. We currently show only the **village, district and state**, to protect farmers' privacy, because
anyone who picks up a pack can scan it. Material bought from a **supplier** (not a registered farmer) has
no farmer, so its QR shows the supplier's region.

| | A. Region only *(current)* | B. Farmer ID + name as the FRD says | C. Farmer ID only (no name) |
|---|---|---|---|
| Farmer privacy | Protected | Name visible to anyone with a pack | Protected; the ID is meaningless outside the system |
| Consumer trust | "From farms in Ashta, Sehore" | "Grown by Ramesh Patel, SVV-2026-000123" | "Grown by farmer SVV-2026-000123" |
| Consent | None needed | You should collect each farmer's written consent | None needed |

Please also confirm: **is supplier-sourced material acceptable in packs sold as "farm-traceable"?** If not,
we can stop supplier batches being used in products that carry the farm-to-fork QR.

**Recommendation: C**, plus written consent if you choose B.

---

### Summary of safe defaults currently in force

| # | Point | Running today until you decide |
|---|---|---|
| 1 | Counter pickup | OTP always required |
| 2 | Partial shipment | Order cannot ship until fully allocated |
| 3 | Missing pack weight | Unchanged: weight checks skipped for those products (no extra risk added) |
| 4 | Recipe approval | Super Admin approves; approved recipes can only be retired |
| 5 | Undelivered refund | Refund Wallet |
| 6 | Loss in cost | Loss line entered manually as today |
| 7 | QR content | Region only |
