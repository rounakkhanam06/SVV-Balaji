-- Aadhaar / photo ID: riders upload the photo only - no document number or expiry date.
UPDATE "rider_document_types" SET "requiresNumber" = false, "requiresExpiry" = false WHERE "code" = 'ID_PROOF';
