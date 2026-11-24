PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS documents (
 id INTEGER PRIMARY KEY, issuer TEXT NOT NULL, document_id TEXT NOT NULL, revision INTEGER NOT NULL,
 subject TEXT NOT NULL, environment TEXT NOT NULL CHECK(environment='test'), hash TEXT NOT NULL,
 snapshot TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'DRAFT', document_type TEXT, establishment TEXT, point TEXT,
 number INTEGER, cdc TEXT UNIQUE, xml_hash TEXT, signed_xml TEXT, batch_id TEXT, response_ref TEXT,
 result_code TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(issuer,document_id,revision,environment),
 UNIQUE(subject,environment,document_type,establishment,point,number)
);
CREATE TABLE IF NOT EXISTS numbering (
 subject TEXT, environment TEXT, document_type TEXT, establishment TEXT, point TEXT, last_number INTEGER NOT NULL,
 PRIMARY KEY(subject,environment,document_type,establishment,point)
);
CREATE TABLE IF NOT EXISTS outbox (
 document INTEGER PRIMARY KEY REFERENCES documents(id), action TEXT NOT NULL, due_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS nonces (issuer TEXT, nonce TEXT, request_hash TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(issuer,nonce));
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, document INTEGER, actor_key TEXT, action TEXT NOT NULL, at INTEGER NOT NULL, adapter_version TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY, document INTEGER NOT NULL REFERENCES documents(id), content TEXT NOT NULL, at INTEGER NOT NULL);
