import { persistFiscalOutcome } from './outcome.mjs';
import { fiscalErrorClass } from './errors.mjs';
/** One leased job at a time per worker; independent of browser/request lifecycle. */
export class FiscalWorker {
  constructor(repository,{build,transportFor,now=Date.now}) {this.repo=repository;this.build=build;this.transportFor=transportFor;this.now=now;this.busy=false;}
  async tick() {
    if(this.busy)return;this.busy=true;
    try {
      const job=this.repo.transaction(()=>{
        const at=this.now();
        const row=this.repo.db.prepare('SELECT d.*,o.action,o.attempts FROM outbox o JOIN documents d ON d.id=o.document WHERE o.due_at<=? AND o.lease_until<=? ORDER BY o.due_at LIMIT 1').get(at,at);
        if(!row)return null;
        this.repo.db.prepare('UPDATE outbox SET lease_until=? WHERE document=?').run(at+120000,row.id);return row;
      });
      if(!job)return;
      try {
        if(job.action==='build') {
          const built=await this.build(job);
          this.repo.transaction(()=>{
            this.repo.db.prepare("UPDATE documents SET state='SIGNED',signed_xml=?,xml_hash=?,updated_at=? WHERE id=?").run(built.xml,built.hash,this.now(),job.id);
            this.repo.db.prepare("UPDATE outbox SET action='send',due_at=?,lease_until=0 WHERE document=?").run(this.now(),job.id);
          });return;
        }
        const transport=await this.transportFor(job);
        if(job.action==='send') {
          // Commit the uncertain-send state before network IO. Crash/restart ONLY queries this CDC.
          this.repo.transaction(()=>{
            this.repo.db.prepare("UPDATE documents SET state='UNKNOWN',updated_at=? WHERE id=?").run(this.now(),job.id);
            this.repo.db.prepare("UPDATE outbox SET action='query' WHERE document=?").run(job.id);
          });
        }
        const result=job.action==='send'?await transport.submit(job):await transport.query(job);
        if(!['ACCEPTED','REJECTED','PROCESSING','UNKNOWN'].includes(result.state)) throw new Error('RESPONSE_MALFORMED');
        this.repo.transaction(()=>{
          const response=this.repo.db.prepare('INSERT INTO responses(document,content,at) VALUES(?,?,?)').run(job.id,result.raw,this.now());
          this.repo.db.prepare('UPDATE documents SET state=?,batch_id=COALESCE(?,batch_id),result_code=?,response_ref=?,updated_at=? WHERE id=?')
            .run(result.state,result.batchId||null,result.code||null,String(response.lastInsertRowid),this.now(),job.id);
          this.repo.db.prepare('INSERT INTO audit(document,actor_key,action,at,adapter_version) VALUES(?,?,?,?,?)').run(job.id,'worker',result.state,this.now(),'0.1.0');
          if(['ACCEPTED','REJECTED'].includes(result.state)){
            persistFiscalOutcome(this.repo,job.id);
            this.repo.db.prepare('DELETE FROM outbox WHERE document=?').run(job.id);
          }
          else this.defer(job);
        });
      } catch (error) {
        const errorClass=fiscalErrorClass(error);
        this.repo.db.prepare('UPDATE fiscal_builds SET error_class=? WHERE document=?').run(errorClass,job.id);
        if(job.action==='build' || (job.action==='query' && errorClass!=='NETWORK_TRANSIENT')) {
          // A local mapping/signature failure is not SIFEN rejection. Once a send
          // was attempted, even a malformed/failed response must reconcile the
          // original CDC instead of pausing or sending again.
          this.repo.transaction(()=>{
            if(job.action==='build')this.repo.db.prepare("UPDATE documents SET state='DRAFT',updated_at=? WHERE id=?").run(this.now(),job.id);
            this.repo.db.prepare('UPDATE outbox SET due_at=?,lease_until=0 WHERE document=?').run(Number.MAX_SAFE_INTEGER,job.id);
          });
        } else this.repo.transaction(()=>this.defer(job));
      }
    } finally {this.busy=false;}
  }
  defer(job) {
    const attempts=job.attempts+1;
    // Ten-minute minimum; bounded reconciliation, no automatic re-emission after UNKNOWN.
    const due=attempts>=144?Number.MAX_SAFE_INTEGER:this.now()+Math.min(3600000,600000*2**Math.min(attempts-1,3));
    this.repo.db.prepare('UPDATE outbox SET attempts=?,due_at=?,lease_until=0 WHERE document=?').run(attempts,due,job.id);
  }
  start(){if(!this.timer)this.timer=setInterval(()=>void this.tick().catch(()=>{console.warn(JSON.stringify({event:'fiscal.worker.error',code:'REPOSITORY_ERROR'}));}),1000);return()=>{clearInterval(this.timer);this.timer=null;};}
}
