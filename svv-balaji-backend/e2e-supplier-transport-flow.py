#!/usr/bin/env python3
"""
End-to-end check of supplier inbound material against a RUNNING API.

  supplier (approved) -> purchase order -> transport (rate from the PO) -> dispatch
  -> deliver (receipt, raw batch for the supplier, warehouse stock + movement,
  PO fulfilment) -> raw QC -> production (cost from the supplier's rate)
  -> finished goods -> trace resolves back to the SUPPLIER (CLAUDE.md rule 6)

Also: blocked supplier / wrong-supplier PO refused, a delivered transport cannot be
delivered or cancelled again, and supplier + farmer batches on the same day get
distinct RM numbers (one shared counter).

Creates its own stamped data; run it on a throwaway database.

  SEED_SUPER_ADMIN_PASSWORD=... python e2e-supplier-transport-flow.py
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


def call(method, path, body=None, auth=True):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if auth and token:
        req.add_header("Authorization", f"Bearer {token}")
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


def step(title):
    print(f"\n==> {title}")


def check(ok, msg, detail=None):
    global failures
    if ok:
        print(f"  PASS {msg}")
    else:
        failures += 1
        print(f"  FAIL {msg}" + (f"\n       {detail}" if detail is not None else ""))
    return ok


def must(method, path, body=None, expect=(200, 201), label=None):
    status, data = call(method, path, body)
    if status not in expect:
        print(f"  FATAL {label or method + ' ' + path} -> HTTP {status}: {json.dumps(data)[:400]}")
        sys.exit(2)
    return data


def rows(data):
    return data["data"] if isinstance(data, dict) and "data" in data else data


# ---------------------------------------------------------------------------
step("0. Login + setup")
status, data = call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD}, auth=False)
if status not in (200, 201):
    print("  FATAL login failed", status, data)
    sys.exit(2)
token = data["accessToken"]
BR = rows(must("GET", "/branches"))[0]["id"]
WH = must("POST", "/warehouses", {"name": f"E2E Inbound {STAMP}", "location": "Test", "branchId": BR, "capacity": 50000})["id"]

# ---------------------------------------------------------------------------
step("1. Supplier + purchase order")
sup = must("POST", "/suppliers", {"fullName": f"E2E Traders {STAMP}", "mobile": f"93{STAMP[-8:]}", "companyName": "E2E Grain Co", "city": "Indore"})
sup = must("PATCH", f"/suppliers/{sup['id']}/verify", {"action": "APPROVED", "remarks": "e2e"})
check(str(sup.get("supplierCode") or "").startswith("SUP-"), f"supplier approved, code {sup.get('supplierCode')}")
SUP_CODE = sup["supplierCode"]
other = must("POST", "/suppliers", {"fullName": f"E2E Other {STAMP}", "mobile": f"92{STAMP[-8:]}"})
po = must("POST", "/purchase-orders", {"supplierId": sup["id"], "materialName": "Wheat", "expectedQuantity": 800, "unit": "KG",
                                       "purchaseRate": 28, "totalAmount": 22400, "orderDate": TODAY})
must("PATCH", f"/purchase-orders/{po['id']}/status", {"status": "CONFIRMED"})

status, data = call("POST", "/transports", {"supplierId": other["id"], "purchaseOrderId": po["id"], "materialName": "Wheat", "quantity": 100, "scheduledDate": TODAY})
check(status == 400 and "another supplier" in json.dumps(data), "a PO cannot be used for another supplier's transport", (status, data))
must("PATCH", f"/suppliers/{other['id']}/verify", {"action": "APPROVED", "remarks": "e2e"})
must("PATCH", f"/suppliers/{other['id']}/status", {"status": "BLACKLISTED"})
status, data = call("POST", "/transports", {"supplierId": other["id"], "materialName": "Wheat", "quantity": 100, "scheduledDate": TODAY})
check(status == 400 and "blacklisted" in json.dumps(data), "a blacklisted supplier cannot send material", (status, data))

# ---------------------------------------------------------------------------
step("2. Transport -> dispatch -> deliver")
tr = must("POST", "/transports", {"supplierId": sup["id"], "purchaseOrderId": po["id"], "materialName": "Wheat", "quantity": 500, "unit": "KG",
                                  "scheduledDate": TODAY, "vehicleNumber": "MP09AB1234", "driverName": "Ramesh", "warehouseId": WH})
check(float(tr["purchaseRate"]) == 28 and float(tr["totalAmount"]) == 14000, "rate taken from the PO: 500 x 28 = 14,000", (tr.get("purchaseRate"), tr.get("totalAmount")))
must("PATCH", f"/transports/{tr['id']}/dispatch")
d = must("PATCH", f"/transports/{tr['id']}/deliver", {"warehouseId": WH, "receivedQuantity": 495})
check(d["status"] == "DELIVERED" and str(d.get("receiptNumber") or "").startswith("SR-"), f"delivered with receipt {d.get('receiptNumber')}")
check(float(d["quantity"]) == 495 and float(d["totalAmount"]) == 13860, "weighed 495 kg recorded; amount 13,860", (d.get("quantity"), d.get("totalAmount")))
RM_NO, RM_ID = d["batch"]["batchNumber"], d["batch"]["id"]
check(RM_NO.startswith("RM-") and d["batch"]["status"] == "STORED", f"raw batch {RM_NO} created, STORED")

full = must("GET", f"/transports/{tr['id']}")
check(full["batch"]["batchNumber"] == RM_NO and full["purchaseOrder"]["status"] == "PARTIALLY_FULFILLED", "transport shows its batch; PO partially fulfilled (495 of 800)", full.get("purchaseOrder"))
stock = rows(must("GET", f"/batches?warehouseId={WH}"))
b = next((x for x in stock if x["id"] == RM_ID), None)
check(b is not None, "batch listed in the receiving warehouse")
status, data = call("PATCH", f"/transports/{tr['id']}/deliver", {"warehouseId": WH})
check(status == 400, "a delivered transport cannot be delivered twice", (status, data))
status, data = call("PATCH", f"/transports/{tr['id']}/cancel", {"remarks": "x"})
check(status == 400, "a delivered transport cannot be cancelled", (status, data))

tr2 = must("POST", "/transports", {"supplierId": sup["id"], "purchaseOrderId": po["id"], "materialName": "Wheat", "quantity": 305, "scheduledDate": TODAY})
d2 = must("PATCH", f"/transports/{tr2['id']}/deliver", {"warehouseId": WH})
check(d2["batch"]["batchNumber"] != RM_NO, f"second delivery gets its own number {d2['batch']['batchNumber']}")
check(must("GET", f"/purchase-orders/{po['id']}")["status"] == "FULFILLED", "PO fulfilled once 800 kg have arrived")
status, data = call("POST", "/transports", {"supplierId": sup["id"], "purchaseOrderId": po["id"], "materialName": "Wheat", "quantity": 10, "scheduledDate": TODAY})
check(status == 400, "a fulfilled PO takes no more deliveries", (status, data))

# ---------------------------------------------------------------------------
step("3. Same-day farmer collection gets a distinct RM number (shared counter)")
farmer = must("POST", "/farmers", {
    "fullName": f"E2E Farmer {STAMP}", "mobile": f"91{STAMP[-8:]}", "village": "Ashta",
    "district": "Sehore", "state": "Madhya Pradesh", "farmSizeAcres": 5.5, "cropDetails": "Wheat",
    "branchId": BR, "aadhaarNumber": f"{STAMP}56"[:12], "address": "Ashta, Sehore", "landType": "Irrigated",
    "irrigationType": "Canal", "bankAccountName": "E2E Farmer", "bankName": "SBI",
    "bankAccountNo": f"{STAMP}22", "ifscCode": "SBIN0001234",
})
must("PATCH", f"/farmers/{farmer['id']}/verify", {"action": "APPROVED", "remarks": "e2e"})
insp = must("POST", "/harvest-inspections", {"farmerId": farmer["id"], "cropName": "Wheat", "inspectionDate": TODAY, "moistureLevel": 11, "foreignMatter": 0.5, "grainSize": "Medium", "result": "APPROVED"})
coll = must("POST", "/collections", {"inspectionId": insp["id"], "branchId": BR, "collectionDate": TODAY, "collectionLocation": "Gate",
                                     "grossWeight": 110, "netWeight": 100, "warehouseId": WH, "purchaseRate": 25})
farmer_rm = coll["batch"]["batchNumber"]
check(farmer_rm not in (RM_NO, d2["batch"]["batchNumber"]), f"farmer batch {farmer_rm} does not collide with supplier batches")

# ---------------------------------------------------------------------------
step("4. QC -> production (cost from the supplier rate) -> FG -> trace to the supplier")
product = must("POST", "/products", {"name": f"E2E Sup Atta {STAMP}", "sku": f"E2ES-{STAMP}", "unit": "PACK"})
recipe = must("POST", "/recipes", {"recipeCode": f"E2ES-{STAMP}", "productId": product["id"], "name": "E2E Wheat Flour",
                                   "productionType": "SINGLE_GRAIN", "batchYieldQuantity": 900,
                                   "ingredients": [{"cropName": "Wheat", "quantity": 1000, "unit": "KG"}]})
must("PATCH", f"/recipes/{recipe['id']}/approve", {})
run = {"recipeId": recipe["id"], "branchId": BR, "warehouseId": WH, "productionDate": TODAY, "plannedQuantity": 380,
       "consumptions": [{"rawMaterialBatchId": RM_ID, "quantityUsed": 400}]}
must("POST", "/quality-inspections", {"stage": "RAW_MATERIAL", "rawMaterialBatchId": RM_ID, "moisture": 11, "purity": 99, "foreignMatter": 0.4, "result": "PASS"})
pb = must("POST", "/production-batches", run)
check(pb["productionBatchNumber"].startswith("PB-"), f"production run {pb['productionBatchNumber']} consumed the supplier batch (stock was booked in)")
cost = must("GET", f"/production-batches/{pb['id']}/cost")
check(cost["rawMaterial"]["automatic"] == 11200 and cost["rawMaterial"]["missingRate"] == [], "raw cost from the supplier rate: 400 x 28 = 11,200", cost["rawMaterial"])
must("POST", "/quality-inspections", {"stage": "IN_PROCESS", "productionBatchId": pb["id"], "grindingQuality": "Fine", "temperature": 40, "result": "PASS"})
must("PATCH", f"/production-batches/{pb['id']}/complete", {"actualQuantity": 380})
fg = must("POST", "/finished-goods", {"productionBatchId": pb["id"], "packagingType": "pouch", "netWeight": 5, "packCount": 70,
                                      "mrp": 250, "packagingDate": TODAY, "manufacturingDate": TODAY, "shelfLifeDays": 120})
must("POST", "/quality-inspections", {"stage": "FINISHED_GOODS", "finishedGoodsBatchId": fg["id"], "productAppearance": "Good", "productWeight": 5, "result": "PASS", "shelfLifeVerified": True})
must("PATCH", f"/quality-inspections/release/{fg['id']}", {})
trace = must("GET", f"/trace/{fg['fgBatchNumber']}")
srcs = trace.get("farmers") or []
check(any(s.get("farmerCode") == SUP_CODE and s.get("rawBatchNumber") == RM_NO for s in srcs),
      f"{fg['fgBatchNumber']} -> {pb['productionBatchNumber']} -> {RM_NO} -> {SUP_CODE}", srcs)

print(f"\n{'ALL PASSED' if failures == 0 else f'{failures} FAILED'}")
sys.exit(1 if failures else 0)
