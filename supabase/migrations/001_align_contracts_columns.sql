-- Migración 001 — alinea la tabla `contracts` con el mapeo de lib/secop.ts.
-- Necesaria si `contracts` se creó con el esquema del brief (18 columnas).
-- Idempotente (ADD COLUMN IF NOT EXISTS). Ejecutar en Supabase -> SQL Editor.

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contractor_doc_type TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signing_date        DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type       TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS entity_order        TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS legal_rep_name      TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS legal_rep_id        TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS legal_rep_address   TEXT;

CREATE INDEX IF NOT EXISTS idx_contracts_signing_date ON contracts(signing_date);
CREATE INDEX IF NOT EXISTS idx_contracts_legal_rep_id ON contracts(legal_rep_id);

-- Refresca el cache de PostgREST para que reconozca las columnas nuevas.
NOTIFY pgrst, 'reload schema';
