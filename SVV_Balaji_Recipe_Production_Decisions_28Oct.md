# SVV Balaji — Recipe & Production: Decisions Needed

**Prepared by:** Appzeto · **Date:** 28 October 2026 · **For:** SVV Balaji management, via Ravi Tiwari

A review of how recipes drive production found three points that need a business rule from you. For each
we set out the calculation, the options and our recommendation. **Until you answer, the system keeps its
current behaviour** (shown as "today" below). We will not change production rules without your reply.

Please reply with the option letter for each (for example "1-C 5%/10%, 2-B, 3-A").

---

## 1. How closely must the raw material used match the recipe?

**Today.** When a production run is created, the system checks that each raw material is an ingredient of
the approved recipe, that it passed quality checks and that there is enough stock. For blends
(multi-grain) it also checks the **mix ratio** to within 0.5 percentage points. It does **not** check the
**amount** used against what the recipe says. An operator can enter 500 kg of wheat for a run the recipe
says needs 105 kg; the extra simply shows up later as "loss".

**The expected calculation.** Every approved recipe records:

- **Batch yield** (Y): output of one full recipe batch, e.g. 100 kg atta
- **Expected loss** (L%): weight lost in cleaning, grinding, roasting, e.g. 5%
- **Ingredient quantities** (q) for that one full batch, e.g. wheat 105.3 kg

For a run planned at **P**:

```
scale factor            = P ÷ Y
expected input of each  = q × scale factor
variance %              = (actual input − expected input) ÷ expected input × 100
```

*Worked example.* Atta recipe: Y = 100 kg, L = 5%, wheat q = 105.3 kg (= 100 ÷ (1 − 0.05)).
Run planned at 500 kg → scale 5 → expected wheat **526.5 kg**.

| Operator enters | Variance | Under option C (5% / 10%) |
|---|---|---|
| 530 kg | +0.7% | Accepted |
| 560 kg | +6.4% | Accepted with a warning and a reason recorded |
| 600 kg | +14.0% | Blocked unless a Production Manager overrides |
| 470 kg | −10.7% | Blocked (too little input for the planned output) |

We would also check once, when a recipe is approved, that the ingredient total agrees with
Y ÷ (1 − L%), so the two figures on a recipe can't contradict each other.

**Options**

| | What happens when the amount differs from the recipe | Effect |
|---|---|---|
| **A. Today: no check** | Nothing | Over-issue of raw material is invisible until the loss report |
| **B. Hard limit** (e.g. ±2%) | Run refused outside the limit | Strong control; blocks genuine cases (wetter grain, a partial last bag) |
| **C. Warn band + block band** (e.g. warn ±5%, block ±10%) | Inside warn: accepted. Warn–block: accepted with a reason, shown on the variance report. Beyond block: needs Production Manager override with a reason | Day-to-day flexibility, every deviation explained, large ones approved |
| **D. Record only** | Accepted; variance shown on a report | Visibility without stopping anyone |

**Recommendation: C**, with the two percentages set by you. Please also confirm:
- whether the limits are **one figure for all products** or **per recipe** (oil and atta lose very differently);
- who may override: **Production Manager**, **Super Admin**, or both.

---

## 2. What happens to planned runs when a new recipe version is approved?

**Today.** Approving version 2 of a recipe automatically retires version 1, so only one version is ever
live. A run already **started** on version 1 finishes on version 1 and records that version for
traceability. This is unaffected by any option below.

A run that is only **planned** on version 1 (raw material reserved, not yet started) **cannot be
started**. The planner has to cancel it and plan it again on version 2. Cancelling returns the reserved
stock automatically.

| | Planned runs on the old version | Effect |
|---|---|---|
| **A. Today: block, re-plan** | Cannot start; must be cancelled and re-planned on the new version | Nothing is ever made to a retired formula. Planners must redo the work, and nothing currently warns them |
| **B. Block, plus help** | As A, but the approval screen lists the affected planned runs, the planner is notified, and "re-plan on new version" is one click | Same control as A without the surprise |
| **C. Allow to finish on old version** | Planned runs may still start on the version they were planned with | No re-planning. Some output is made to a formula you have just replaced |
| **D. Approver chooses** | At approval, the approver picks A or C for the planned runs | Flexible. One more decision at every approval |

**Recommendation: B.** A new version usually exists because the old formula was wrong or changed, so it
should not keep being produced. B removes the only real drawback of today's rule.

---

## 3. Loss on products measured in litres (oil)

**What we found.** Production loss is "raw material in − product out − by-product". Raw material is
weighed in kg, but oil output is entered in **litres**. The system was subtracting litres from kilograms,
so loss figures and the yield/cost reports for oil runs were wrong. **This is now fixed** (see note below):
for litre-measured output the loss is recorded as **"not measurable"** instead of a wrong number.

To show a real loss for oil we need one figure from you:

| | How oil loss is measured | Needs from you |
|---|---|---|
| **A. Density per product** | Litres converted to kg with the oil's density (e.g. groundnut oil ≈ 0.91 kg/L), then loss = seed kg − oil kg − cake kg | One density figure per oil product |
| **B. Weigh output in kg** | Operators enter oil output in kg at production; litres used only on packs | A change in shop-floor practice |
| **C. Leave as is** | Oil runs show output and by-product but no loss % | Nothing |

**Recommendation: A.** One figure per product, and no change on the shop floor.

---

*Already corrected without needing a decision:* the oil loss calculation above (it now refuses to produce
a wrong number). Nothing about what operators can or cannot do has changed.
