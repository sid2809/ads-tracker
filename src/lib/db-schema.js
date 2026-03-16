const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS domains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name     VARCHAR(255) UNIQUE NOT NULL,
    account_ids     JSONB DEFAULT '[]',
    pinned          BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_sheets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id       UUID REFERENCES domains(id) ON DELETE CASCADE,
    sheet_type      VARCHAR(50) NOT NULL,
    sheet_url       TEXT NOT NULL,
    worksheet_name  VARCHAR(255) DEFAULT '',
    url_column      VARCHAR(255) DEFAULT 'Final_URL',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(domain_id, sheet_type)
);

CREATE TABLE IF NOT EXISTS domain_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id       UUID REFERENCES domains(id) ON DELETE CASCADE,
    setting_key     VARCHAR(255) NOT NULL,
    setting_value   TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(domain_id, setting_key)
);

CREATE TABLE IF NOT EXISTS domain_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id       UUID REFERENCES domains(id) ON DELETE CASCADE,
    cache_type      VARCHAR(50) NOT NULL,
    cache_data      JSONB NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(domain_id, cache_type)
);
`;

let migrated = false;

export async function ensureSchema(pool) {
  if (migrated) return;
  try {
    await pool.query(SCHEMA_SQL);
    migrated = true;
    console.log("[db-schema] tables ensured");
  } catch (err) {
    console.error("[db-schema] migration failed", err);
    throw err;
  }
}
