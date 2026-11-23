# Recipe outputs & by-products — plan (parked 23 Nov 2026, awaiting Raunak's go-ahead)

**Why:** a recipe has one `expectedLossPercent`, so anything that is not main output counts as loss.
Wrong for multi-output products (soybean → ~18% oil + ~78% meal + loss): 100 KG oil computes as
102 KG soybean instead of ~556 KG. Interim workaround: enter loss % = everything that is not main output
and record the meal as the batch by-product at completion.

## Formula (generic, no product hardcoding)
`Input 100% = Main output % + Σ By-product % + Loss %`
- Required input = main output qty ÷ main %
- Expected by-product = input × by-product %; expected loss = input × loss %
- Existing recipes: main % = 100 − loss %, no by-products → numbers unchanged.

## Current state (reviewed 23 Nov)
- ✅ Recipe per product, versioned; approved = immutable; ProductionBatch pins recipeId + recipeVersion.
- ✅ Multiple ingredients (crop, qty, unit, %); multigrain blend enforced at production.
- ⚠️ Input calc lives only in admin `RecipeFormModal.tsx` (`quantityFromShare`), not backend.
- ⚠️ ProductionBatch has ONE by-product (byProductQuantity/Name/Revenue); loss = input − output − by-product (kgOf/toUnit).
- ❌ No by-products on recipe; no litre↔KG density (oil loss null — see 28 Oct decision §3).

## Planned changes (all additive / optional)
1. `Recipe.mainOutputPercent?`, `Recipe.densityKgPerLitre?`
2. New `RecipeByProduct` (name, expected %, unit, optional productId).
3. New `ProductionByProduct` (rows per run: name, qty, unit, revenue, recipeByProductId?); backfill from the single fields, keep them.
4. `ProductionBatch` snapshot: expectedInput, expected by-products, expectedLoss at creation.
5. One backend formula function; validation main + by-products + loss = 100; litre/KG mix requires density.
6. `GET /recipes/:id/requirements?output=&unit=`.
7. Complete production accepts by-product array (single fields still accepted).
8. Expected vs actual in reports / Loss & Yield.
9. Admin: recipe Outputs section with live 100% total + required-input preview; production create suggests input; complete form pre-fills expected by-products.
10. Tests: formula, by-products, existing production-flow, farmer → FG trace still resolves.

Estimate steps 1–2 (backend + admin, by-products recorded not stocked): ~3–4 days.

## Pending Raunak's confirmation
1. Output total: **must equal 100%** (block) vs warn only. Default proposed: block.
2. By-products entered as **% or fixed qty** (system converts). Default proposed: both.
3. Litre/KG mix **blocked until density entered**. Default proposed: block.

## Needs the client (scope)
- Should by-products (e.g. soybean meal) become **sellable stock** (own FG batch, price, QR, GST)? Not in this build;
  the build leaves an optional product link so it can be added later as a separate phase.
- Approved per-product data: main %, by-products %, loss %; oil sold by litre or KG + density.
