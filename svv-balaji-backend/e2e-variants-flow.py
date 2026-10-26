#!/usr/bin/env python3
"""
End-to-end check that pack sizes (product variants) are real stock units,
against a RUNNING API on a THROWAWAY database.

  product + 5 kg variant -> production -> one FG batch per pack size -> QA release
  -> storefront: each pack shows its own stock -> one order with BOTH pack sizes
  -> each line allocated only from its own pack's batch -> task weight per pack
  -> a sold variant removed from the product form is retired, not deleted

  BASE_URL=http://localhost:3110/api/v1 python e2e-variants-flow.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date

BASE = os.environ.get("BASE_URL", "http://localhost:3000/api/v1")
EMAIL = os.environ.get("SEED_SUPER_ADMIN_EMAIL", "admin@svvbalaji.com")
PASSWORD = os.environ.get("SEED_SUPER_ADMIN_PASSWORD", "admin@123")
STAMP = str(int(time.time()))
TODAY = date.today().isoformat()
token = ""
failures = 0


def call(method, path, body=None, auth=True, tok=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    t = tok or (token if auth else None)
    if t:
        req.add_header("Authorization", f"Bearer {t}")
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def step(t):
    print(f"\n==> {t}")


def check(ok, msg, detail=None):
    global failures
    if ok:
        print(f"  PASS {msg}")
    else:
        failures += 1
        print(f"  FAIL {msg}" + (f"\n       {json.dumps(detail, default=str)[:600]}" if detail is not None else ""))
    return ok


def must(method, path, body=None, expect=(200, 201), tok=None, auth=True):
    status, data = call(method, path, body, auth=auth, tok=tok)
    if status not in expect:
        print(f"  FATAL {method} {path} -> HTTP {status}: {json.dumps(data)[:500]}")
        sys.exit(2)
    return data


def rows(d):
    return d["data"] if isinstance(d, dict) and "data" in d else d


# ---------------------------------------------------------------------------
step("1. Login, a central depot that ships by courier, COD on")
_, lg = call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD}, auth=False)
token = lg["accessToken"]
BR = rows(must("GET", "/branches"))[0]["id"]
WH = must("POST", "/warehouses", {"name": f"Variant Depot {STAMP}", "location": "Bhopal", "branchId": BR, "capacity": 50000,
                                  "kind": "CENTRAL", "latitude": 23.2599, "longitude": 77.4126})["id"]
must("PATCH", "/checkout-settings", {"centralWarehouseId": WH, "codEnabled": True})
check(True, "depot ready")

step("2. Product with its own 1 kg pack and a 5 kg variant, each with its own price and pack weight")
p = must("POST", "/products", {
    "name": f"Variant Atta {STAMP}", "sku": f"VA-{STAMP}", "unit": "PACK", "showOnStorefront": True, "packWeightKg": 1,
    "pricing": {"b2cPrice": 100, "gstRatePercent": 5},
    "variants": [{"name": "5 kg", "sku": f"VA5-{STAMP}", "packWeightKg": 5, "pricing": {"b2cPrice": 450}}],
})
P = p["id"]
V5 = p["variants"][0]["id"]
check(float(p["variants"][0]["packWeightKg"]) == 5, "variant saved with its own pack weight", p["variants"][0])

step("3. Raw material -> production -> one FG batch per pack size -> QA release")
farmer = must("POST", "/farmers", {
    "fullName": f"Variant Farmer {STAMP}", "mobile": f"96{STAMP[-8:]}", "village": "Ashta", "district": "Sehore",
    "state": "Madhya Pradesh", "farmSizeAcres": 4, "cropDetails": "Wheat", "branchId": BR, "aadhaarNumber": f"{STAMP}34"[:12],
    "address": "Ashta", "landType": "Irrigated", "irrigationType": "Canal", "bankAccountName": "VF", "bankName": "SBI",
    "bankAccountNo": f"{STAMP}11", "ifscCode": "SBIN0001234",
})
must("PATCH", f"/farmers/{farmer['id']}/verify", {"action": "APPROVED", "remarks": "e2e"})
insp = must("POST", "/harvest-inspections", {"farmerId": farmer["id"], "cropName": "Wheat", "inspectionDate": TODAY,
                                             "moistureLevel": 11, "foreignMatter": 0.4, "result": "APPROVED"})
coll = must("POST", "/collections", {"inspectionId": insp["id"], "branchId": BR, "collectionDate": TODAY, "collectionLocation": "Gate",
                                     "grossWeight": 700, "netWeight": 650, "warehouseId": WH, "purchaseRate": 25})
rm = next(b for b in rows(must("GET", f"/batches?warehouseId={WH}")) if b.get("collectionId") == coll["id"])
recipe = must("POST", "/recipes", {"recipeCode": f"VR-{STAMP}", "productId": P, "name": "Variant Atta", "productionType": "SINGLE_GRAIN",
                                   "batchYieldQuantity": 300, "ingredients": [{"cropName": "Wheat", "quantity": 300, "unit": "KG"}]})
must("PATCH", f"/recipes/{recipe['id']}/approve", {})
pb = must("POST", "/production-batches", {"recipeId": recipe["id"], "branchId": BR, "warehouseId": WH, "productionDate": TODAY,
                                          "plannedQuantity": 300, "consumptions": [{"rawMaterialBatchId": rm["id"], "quantityUsed": 300}]})
must("PATCH", f"/production-batches/{pb['id']}/complete", {"actualQuantity": 290})


def pack(net, unit, count, variant=None, expect=(200, 201)):
    body = {"productionBatchId": pb["id"], "packagingType": "pouch", "netWeight": net, "weightUnit": unit, "packCount": count,
            "mrp": 500, "packagingDate": TODAY, "manufacturingDate": TODAY, "shelfLifeDays": 180}
    if variant:
        body["variantId"] = variant
    return call("POST", "/finished-goods", body) if expect == "raw" else must("POST", "/finished-goods", body, expect=expect)


s, bad = pack(1, "KG", 10, V5, expect="raw")
check(s == 400 and "5 kg" in json.dumps(bad), "a 1 kg pack cannot be labelled as the 5 kg pack size", bad)
s, bad = pack(5000, "KG", 1, expect="raw")
check(s == 400, "pack weight beyond the run's output is refused", bad)
FG1 = pack(1000, "G", 20)            # own pack, entered in grams: 20 kg of 290 kg output
FG5 = pack(5, "KG", 8, V5)           # 40 kg
for fg in (FG1, FG5):
    must("POST", "/quality-inspections", {"stage": "FINISHED_GOODS", "finishedGoodsBatchId": fg["id"], "productAppearance": "Good",
                                          "productWeight": 1, "result": "PASS"})
    must("PATCH", f"/quality-inspections/release/{fg['id']}", {})
check(FG5.get("variantId") == V5 and FG1.get("variantId") is None, "each batch records its pack size", {"fg1": FG1.get("variantId"), "fg5": FG5.get("variantId")})

step("4. Storefront shows each pack size's own stock")
cat = must("GET", f"/storefront/catalogue/products/{P}", auth=False)
v = next(x for x in cat["variants"] if x["id"] == V5)
check(cat["availableQuantity"] == 20, "own pack: 20 in stock", cat["availableQuantity"])
check(v.get("availableQuantity") == 8, "5 kg pack: 8 in stock", v)

step("5. One order with both pack sizes (used to fail: 'no longer available')")
phone = f"9{STAMP[-6:]}777"
call("POST", "/storefront/auth/otp/request", {"phone": phone}, auth=False)
_, sess = call("POST", "/storefront/auth/otp/verify", {"phone": phone, "code": "123456", "audience": "CUSTOMER", "fullName": "Pack Shopper"}, auth=False)
CT = sess["accessToken"]
addr = must("POST", "/storefront/addresses", {"label": "Home", "fullName": "Pack Shopper", "phone": "9876543210", "line1": "1 Street",
                                              "city": "Indore", "state": "Madhya Pradesh", "pincode": "452001",
                                              "latitude": 22.7196, "longitude": 75.8577}, tok=CT)["id"]
cart = [{"productId": P, "quantity": 3}, {"productId": V5, "quantity": 2}]
q = must("POST", "/storefront/checkout/quote", {"addressId": addr, "items": cart, "paymentMode": "COD"}, tok=CT)
lines = {(l["productId"], l["variantId"]): l for l in q["lines"]}
check(set(lines) == {(P, None), (P, V5)}, "quote has a line per pack size, both under the parent product", list(lines))
check(lines[(P, V5)]["unitPrice"] == 450 and lines[(P, None)]["unitPrice"] == 100, "each pack priced by its own rule", {k[1]: l["unitPrice"] for k, l in lines.items()})
check(lines[(P, V5)]["sku"] == f"VA5-{STAMP}" and "5 kg" in lines[(P, V5)]["name"], "variant line carries the variant SKU and name", lines[(P, V5)])
s, bad = call("POST", "/storefront/checkout/quote", {"addressId": addr, "items": [{"productId": V5, "quantity": 9}], "paymentMode": "COD"}, tok=CT)
check(s in (400, 409), "9 x 5 kg refused - only 8 of that pack size, whatever the 1 kg stock", bad)

so = must("POST", "/storefront/checkout/sessions", {"addressId": addr, "items": cart, "paymentMode": "COD"}, tok=CT)
placed = must("POST", f"/storefront/checkout/sessions/{so['sessionId']}/confirm", {}, tok=CT)
OID = placed["orderId"]
od = must("GET", f"/orders/{OID}")
items = {i.get("variantId"): i for i in od["items"]}
check(set(items) == {None, V5} and items[V5]["quantity"] == 2, "order lines keep their pack size", [(i.get("variantId"), i["quantity"]) for i in od["items"]])

after = must("GET", f"/storefront/catalogue/products/{P}", auth=False)
check(next(x for x in after["variants"] if x["id"] == V5)["availableQuantity"] == 6 and after["availableQuantity"] == 17,
      "holds are per pack size: 5 kg 8->6, own pack 20->17", {"own": after["availableQuantity"]})

step("6. Allocation draws each line only from its own pack size's batch")
plan = must("POST", f"/orders/{OID}/start-packing", {})
check(plan["complete"], "fully allocated", plan.get("shortfalls"))
by_line = {}
for a in plan["plan"]:
    by_line.setdefault(a["fgBatchNumber"], 0)
    by_line[a["fgBatchNumber"]] += a["quantity"]
check(by_line == {FG1["fgBatchNumber"]: 3, FG5["fgBatchNumber"]: 2}, "3 from the 1 kg batch, 2 from the 5 kg batch", by_line)
for a in plan["plan"]:
    must("POST", f"/orders/{OID}/scan", {"code": a["fgBatchNumber"]})
check(must("GET", f"/orders/{OID}")["status"] == "PACKED", "scanned -> PACKED")

step("7. A sold pack size removed from the product form is retired, not deleted")
full = must("GET", f"/products/{P}")
s, upd = call("PATCH", f"/products/{P}", {"variants": []})
check(s == 200, "saving the product without the 5 kg variant succeeds (no FK error)", upd)
again = must("GET", f"/products/{P}")
vs = again.get("variants") or []
check(len(vs) == 1 and vs[0]["id"] == V5 and vs[0]["isActive"] is False, "the sold variant is kept but inactive", vs)
s, bad = call("POST", "/storefront/checkout/quote", {"addressId": addr, "items": [{"productId": V5, "quantity": 1}], "paymentMode": "COD"}, tok=CT)
check(s == 400, "a retired pack size can no longer be bought", bad)

print("\n" + "=" * 45)
print("ALL PASSED" if failures == 0 else f"{failures} FAILURE(S)")
sys.exit(1 if failures else 0)
