# Client answers — recipe, production & by-products (received 24 Nov 2026)

Answers to the questions in `SVV_Balaji_Recipe_Production_Decisions_28Oct.md` and A-15
(`SVV_Balaji_Recipe_ByProducts_Plan.md`). Relayed by Raunak. **Not built yet.**

## 1. Processing loss — gross-up the raw requirement, cost the loss into FG
- Example: 100 kg finished product needs **102.04 kg** raw; loss = **2.04 kg** (i.e. loss is 2% of raw input: raw = FG / (1 − loss%)).
- The 2.04 kg loss cost is **absorbed into the finished-product cost** (cost/kg of FG = total run cost ÷ good FG qty), not written off separately.

## 2. Raw-material consumption limit — hard block both ways without manager approval
- Recipe sets the expected consumption; system sets a **max (and min) consumption limit**.
- Over (or under) the limit → **warning shown**, **Production Manager is notified**.
- **Excess or short consumption is not allowed without Production Manager approval.**
- Answers 28 Oct §1 (tolerance). Open detail: tolerance width (% band) per recipe or global?

## 3. Cleaning / grinding waste — classify, by-products are full sellable stock
- Each waste quantity (e.g. 5 kg) must be classified: **real waste (non-recoverable)** vs **recoverable → by-product**.
- By-products are **sellable**: own **inventory stock, sales, invoices — everything** a normal product has.
- Answers A-15 client scope question: **yes, by-products become sellable stock.** This is scope growth vs the SOW (CLAUDE.md rule 4) — Ravi to confirm commercial impact.

## 4. Machine cost — hourly rate, idle time, rated throughput
- Machine cost measured **per hour**; track **idle time** separately from running time.
- Each machine has a **rated capacity (e.g. 200 kg/hour)**; expected run hours = qty ÷ capacity, used for costing and utilisation.
- Extends the 10 Oct machine-utilisation build (machine list + runs).

## 5. New recipe version — applies forward only
- Once a new recipe version is approved, **no one can use the old version** for new processing.
- Already-produced batches keep their old version (no retroactive change — traceability preserved).
- All processing after approval uses the new version everywhere.
- Answers 28 Oct §2. Open detail: runs *planned* but not started on the old version — auto-move to new version, or stay blocked and re-plan (today's behaviour)?

## Still open
- 28 Oct §3: oil (litre) loss measurement — not answered.
- Tolerance band width (2) and planned-run handling (5) above.
- Raunak's 3 build choices for by-products (100% rule, %/qty entry, density gate).

## Follow-up answers (24 Nov, later)
- **Consumption limit band:** dynamic field — **Super Admin sets the limit** (configurable, not hard-coded).
- **Existing records on a new recipe version:** existing GRs / production already created **stay on their original recipe version**; only production **created after** approval uses the latest approved version. Clarified by Raunak: anything **not yet produced** (planned but not started) uses **Version 2**. Only started/completed runs keep the old version. Build: on approval, switch not-started planned runs to the new version (instead of today's block at /start + re-plan).
- **By-product entry:** **both** percentage and fixed quantity.
- **KG ↔ litre:** **density mandatory** — block mixing units until density is entered.
- **Oil loss (28 Oct §3):** record the **actual loss quantity** (operator entry), not only a computed figure.

## Still open
- Per-product by-product %s (client data).
- Scope sign-off on sellable by-products (Ravi).

## Final confirmations (Raunak, 24 Nov)
- Outputs ≠ 100% → **block** recipe save.
- On new version approval, not-started planned runs **auto-switch** to the new version.
