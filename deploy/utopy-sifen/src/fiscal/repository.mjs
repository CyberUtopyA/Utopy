import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
/** Transactional test implementation. A replacement must preserve these transactions/constraints. */
export class FiscalRepository {
  constructor(filename) {
    if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000; PRAGMA synchronous=FULL;');
    this.db.exec(readFileSync(new URL('../../migrations/001.sql', import.meta.url), 'utf8'));
    this.db.exec(readFileSync(new URL('../../migrations/002.sql', import.meta.url), 'utf8'));
    if (filename !== ':memory:') chmodSync(filename, 0o600);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  consumeNonce(p, requestHash) {
    // Replays are rejected; legitimate retry uses a fresh signed nonce and the same document identity.
    try { this.db.prepare('INSERT INTO nonces VALUES(?,?,?,?)').run(p.issuerNodeId, p.nonce, requestHash, Date.now()); }
    catch { throw new Error('REPLAY_REJECTED'); }
  }
  get(issuer, documentId, revision) {
    return this.db.prepare('SELECT * FROM documents WHERE issuer=? AND document_id=? AND revision=? AND environment=\'test\'').get(issuer, documentId, revision) || null;
  }
  saveDraft(p, subject, keyId) {
    return this.transaction(() => {
      const old = this.get(p.issuerNodeId, p.commercialDocumentId, p.revision);
      if (old) { if (old.hash !== p.documentHash) throw new Error('REVISION_CONFLICT'); return old; }
      const at = Date.now();
      const result = this.db.prepare('INSERT INTO documents(issuer,document_id,revision,subject,environment,hash,snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(p.issuerNodeId, p.commercialDocumentId, p.revision, subject, 'test', p.documentHash, JSON.stringify(p.document), at, at);
      this.db.prepare('INSERT INTO audit(document,actor_key,action,at,adapter_version) VALUES(?,?,?,?,?)').run(result.lastInsertRowid, keyId, 'draft.save', at, '0.1.0');
      return this.get(p.issuerNodeId, p.commercialDocumentId, p.revision);
    });
  }
  reserve(row, numbering, cdcForNumber, buildContext) {
    return this.transaction(() => {
      const current = this.get(row.issuer, row.document_id, row.revision);
      if (current.number !== null) return current;
      const k = [row.subject, row.environment, numbering.documentType, numbering.establishment, numbering.point];
      const seq = this.db.prepare('SELECT last_number FROM numbering WHERE subject=? AND environment=? AND document_type=? AND establishment=? AND point=?').get(...k);
      if (!Number.isSafeInteger(numbering.startNumber) || numbering.startNumber < 1) throw new Error('NUMBERING_NOT_CONFIGURED');
      const number = seq ? seq.last_number + 1 : numbering.startNumber;
      if (number > 9999999) throw new Error('NUMBERING_EXHAUSTED');
      const cdc = cdcForNumber(number);
      if (!/^\d{9}[\dA-D]\d{34}$/.test(cdc)) throw new Error('CDC_INVALID');
      this.db.prepare('INSERT INTO numbering VALUES(?,?,?,?,?,?) ON CONFLICT DO UPDATE SET last_number=excluded.last_number').run(...k, number);
      this.db.prepare('UPDATE documents SET document_type=?,establishment=?,point=?,number=?,cdc=?,updated_at=? WHERE id=?')
        .run(numbering.documentType, numbering.establishment, numbering.point, number, cdc, Date.now(), row.id);
      this.db.prepare('INSERT INTO outbox(document,action,due_at) VALUES(?,?,?)').run(row.id, 'build', Date.now());
      if (buildContext) this.db.prepare('INSERT INTO fiscal_builds(document,config_snapshot,signed_at,spec_hash,transport) VALUES(?,?,?,?,?)')
        .run(row.id,JSON.stringify(buildContext.fiscal),buildContext.signedAt,buildContext.specHash,buildContext.transport);
      return this.get(row.issuer, row.document_id, row.revision);
    });
  }
  metrics() { return this.db.prepare('SELECT state,count(*) AS count FROM documents GROUP BY state').all(); }
  outcome(row) { const o=this.db.prepare('SELECT payload FROM fiscal_outcomes WHERE document=?').get(row.id);return o?JSON.parse(o.payload):null; }
  close() { this.db.close(); }
}
