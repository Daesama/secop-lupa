-- =====================================================================
-- Plataforma de análisis IA de contratos SECOP II — Bogotá
-- Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Idempotente: se puede re-ejecutar sin borrar datos existentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla: contracts  (un registro por contrato de SECOP II)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  secop_id         TEXT UNIQUE NOT NULL,            -- id_contrato (CO1.PCCNTR.xxxx)
  contractor_name  TEXT,                            -- proveedor_adjudicado
  contractor_id    TEXT,                            -- documento_proveedor (NIT/cédula)
  contractor_doc_type TEXT,                         -- tipodocproveedor
  entity_name      TEXT,                            -- nombre_entidad
  entity_nit       TEXT,                            -- nit_entidad
  contract_object  TEXT,                            -- objeto_del_contrato
  contract_value   NUMERIC,                         -- valor_del_contrato
  start_date       DATE,                            -- fecha_de_inicio_del_contrato
  end_date         DATE,                            -- fecha_de_fin_del_contrato
  signing_date     DATE,                            -- fecha_de_firma
  selection_method TEXT,                            -- modalidad_de_contratacion
  contract_type    TEXT,                            -- tipo_de_contrato
  contract_status  TEXT,                            -- estado_contrato
  secop_url        TEXT,                            -- urlproceso.url
  department       TEXT,                            -- departamento
  city             TEXT,                            -- ciudad
  entity_order     TEXT,                            -- orden (Nacional / Territorial)
  -- Campos para el patrón "redes de contratistas" (Hito 2)
  legal_rep_name   TEXT,                            -- nombre_representante_legal
  legal_rep_id     TEXT,                            -- identificaci_n_representante_legal
  legal_rep_address TEXT,                           -- domicilio_representante_legal
  raw_data         JSONB,                           -- registro crudo original de SECOP
  synced_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Tabla: alerts  (anomalías detectadas)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type         TEXT NOT NULL,   -- repeated_contractor | inflated_amount |
                                      -- unrealistic_timeline | concentration |
                                      -- fragmentation | network
  severity           TEXT NOT NULL,   -- critical | suspicious | low
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,   -- explicación generada por IA
  related_contracts  UUID[] NOT NULL, -- IDs de contratos involucrados
  entity_name        TEXT,
  contractor_name    TEXT,
  total_amount       NUMERIC,
  ai_analysis        TEXT,            -- análisis completo de la IA
  is_reviewed        BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Tabla: reports  (reportes PDF generados con Sonnet)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  period_start DATE,
  period_end   DATE,
  content      TEXT NOT NULL,   -- contenido generado por Sonnet
  alert_ids    UUID[],          -- alertas incluidas
  pdf_url      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Tabla: sync_logs  (bitácora de sincronización con SECOP)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_logs (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_date             TIMESTAMPTZ DEFAULT NOW(),
  contracts_downloaded  INTEGER,
  contracts_new         INTEGER,
  contracts_updated     INTEGER,
  status                TEXT,        -- success | partial | failed
  error_message         TEXT,
  duration_seconds      INTEGER
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contracts_contractor_id     ON contracts(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_entity_nit        ON contracts(entity_nit);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date        ON contracts(start_date);
CREATE INDEX IF NOT EXISTS idx_contracts_signing_date      ON contracts(signing_date);
CREATE INDEX IF NOT EXISTS idx_contracts_selection_method  ON contracts(selection_method);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_value    ON contracts(contract_value);
CREATE INDEX IF NOT EXISTS idx_contracts_legal_rep_id      ON contracts(legal_rep_id);

CREATE INDEX IF NOT EXISTS idx_alerts_severity   ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
