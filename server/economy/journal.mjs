import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { validateDoubleEntry } from '../../src/economy/journalRules.mjs';
const canonical=v=>JSON.stringify(stable(v));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(key=>[key,stable(v[key])])):v;
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9:._-]{1,160}$/.test(value);
export function moneyToMinor(amount,currency){
  const digits=currency==='PYG'?0:['USD','BRL'].includes(currency)?2:-1;
  const match=/^(0|[1-9]\d{0,12})(?:\.(\d{1,2}))?$/.exec(String(amount));
  if(digits<0||!match||(match[2]||'').length>digits)throw Error('INVALID_AMOUNT');
  const value=BigInt(match[1])*10n**BigInt(digits)+BigInt((match[2]||'').padEnd(digits,'0')||'0');
  if(value<=0n)throw Error('INVALID_AMOUNT');
  return String(value);
}
/** Server library only. Not an HTTP service and not a custody/balance ledger. */
export class DirectEconomicJournal {
  constructor(path,{verifyReceipt,allowSimulation=false}={}){
    this.verifyReceipt=verifyReceipt;
    this.allowSimulation=allowSimulation;
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS economy_direct_journal (
      sequence INTEGER PRIMARY KEY, node_id TEXT NOT NULL, reference TEXT NOT NULL, request_key TEXT NOT NULL,
      content_hash TEXT NOT NULL, previous_hash TEXT NOT NULL, audit_hash TEXT NOT NULL, payload TEXT NOT NULL,
      UNIQUE(node_id,reference), UNIQUE(node_id,request_key));`);
  }
  async record(receipt,requestKey){
    receipt=structuredClone(receipt);
    if(typeof this.verifyReceipt!=='function')throw Error('NODE_ADAPTER_NOT_CONFIGURED');
    const proof=await this.verifyReceipt(receipt);
    if(proof?.verified!==true||proof?.scope!=='direct-node-receipt')throw Error('UNVERIFIED_RECEIPT');
    const a=receipt?.attrs||{}, nodeId=receipt?.meta?.authority;
    if((a.simulation===true||receipt.simulation===true||receipt.meta?.simulation===true)&&!this.allowSimulation)throw Error('SIMULATION_NOT_ALLOWED');
    if(receipt.kind!=='payment.outcome'||a.status!=='paid'||nodeId!==a.sellerNodeId||proof.nodeId!==nodeId
      ||!id(nodeId)||!id(receipt.id)||!id(requestKey)||!id(a.buyerActorId)||!id(a.orderId)
      ||!Array.isArray(receipt.meta?.scopes)||receipt.meta.scopes.includes('public')||!receipt.meta.scopes.some(s=>['private','participants'].includes(s)))throw Error('INVALID_RECEIPT');
    const amountMinor=moneyToMinor(a.amount,a.currency);
    const payload={schema:'utopy.economy.entry/1',classification:'direct-external-record',nodeId,actorId:a.buyerActorId,orderId:a.orderId,reference:receipt.id,
      simulation:a.simulation===true||receipt.simulation===true||receipt.meta?.simulation===true,nonTradable:true,custody:'external',withdrawable:false,
      lines:[{account:'external-node-payment',side:'debit',amountMinor,currency:a.currency},{account:'external-node-sale',side:'credit',amountMinor,currency:a.currency}]};
    validateDoubleEntry(payload.lines);
    const contentHash=hash(payload);
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const prior=this.db.prepare('SELECT * FROM economy_direct_journal WHERE node_id=? AND (reference=? OR request_key=?)').all(nodeId,receipt.id,requestKey);
      if(prior.length){if(prior.length!==1||prior[0].content_hash!==contentHash||prior[0].reference!==receipt.id)throw Error('IDEMPOTENCY_CONFLICT');this.db.exec('COMMIT');return JSON.parse(prior[0].payload);}
      const previous=this.db.prepare('SELECT audit_hash FROM economy_direct_journal ORDER BY sequence DESC LIMIT 1').get()?.audit_hash||'root';
      this.db.prepare('INSERT INTO economy_direct_journal(node_id,reference,request_key,content_hash,previous_hash,audit_hash,payload) VALUES(?,?,?,?,?,?,?)').run(nodeId,receipt.id,requestKey,contentHash,previous,hash({previous,payload}),canonical(payload));
      this.db.exec('COMMIT');return payload;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  reconcile(){
    let previous='root';let entries=0;
    for(const row of this.db.prepare('SELECT * FROM economy_direct_journal ORDER BY sequence').all()){
      const payload=JSON.parse(row.payload);validateDoubleEntry(payload.lines);
      if(row.content_hash!==hash(payload)||row.previous_hash!==previous||row.audit_hash!==hash({previous,payload}))throw Error('AUDIT_MISMATCH');
      previous=row.audit_hash;entries++;
    }
    return {entries,balanced:true,classification:'direct-external-record',walletBalance:null};
  }
  close(){this.db.close();}
}
