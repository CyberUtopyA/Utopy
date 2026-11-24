CREATE TABLE IF NOT EXISTS fiscal_builds (
 document INTEGER PRIMARY KEY REFERENCES documents(id), config_snapshot TEXT NOT NULL,
 signed_at TEXT NOT NULL, spec_hash TEXT NOT NULL, unsigned_xml TEXT, validation TEXT, qr TEXT,
 transport TEXT NOT NULL, error_class TEXT
);
CREATE TABLE IF NOT EXISTS fiscal_outcomes (
 document INTEGER PRIMARY KEY REFERENCES documents(id), kind TEXT NOT NULL, payload TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
