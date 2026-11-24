import assert from 'node:assert/strict';
import { DirectEconomicJournal, moneyToMinor } from '../server/economy/journal.mjs';
import {validateDoubleEntry} from '../src/economy/journalRules.mjs';
import {createServer,transformWithEsbuild} from 'vite';
import {readFile} from 'node:fs/promises';
assert.equal(moneyToMinor('0.10','USD'),'10');
assert.equal(moneyToMinor('15000','PYG'),'15000');
assert.throws(()=>moneyToMinor('1.5','PYG'));
assert.throws(()=>moneyToMinor('1e3','USD'));
assert.throws(()=>validateDoubleEntry([{account:'a',side:'debit',amountMinor:'10',currency:'USD'},{account:'b',side:'credit',amountMinor:'10',currency:'BRL'}]));
const receipt={id:'simulation:receipt:one',kind:'payment.outcome',attrs:{simulation:true,nonTradable:true,orderId:'simulation:order',buyerActorId:'actor:simulation',sellerNodeId:'node:simulation',status:'paid',amount:'1.25',currency:'USD'},meta:{authority:'node:simulation',scopes:['participants']}};
const absent=new DirectEconomicJournal(':memory:');
await assert.rejects(()=>absent.record(receipt,'simulation:key'),/NOT_CONFIGURED/);absent.close();
const journal=new DirectEconomicJournal(':memory:',{allowSimulation:true,verifyReceipt:async()=>({verified:true,nodeId:'node:simulation',scope:'direct-node-receipt'})});
try{
 const posted=await journal.record(receipt,'simulation:key');
 assert.equal(posted.withdrawable,false);assert.equal(posted.simulation,true);
 assert.equal(posted.lines[0].amountMinor,'125');
 await journal.record(receipt,'simulation:key');
 await journal.record(receipt,'simulation:other-key');
 assert.equal(journal.reconcile().entries,1);
 await assert.rejects(()=>journal.record({...receipt,attrs:{...receipt.attrs,amount:'2.00'}},'simulation:key'),/CONFLICT/);
 await assert.rejects(()=>journal.record({...receipt,meta:{...receipt.meta,authority:'node:other'}},'simulation:wrong'),/INVALID/);
 assert.equal(journal.reconcile().walletBalance,null);
 journal.db.exec("UPDATE economy_direct_journal SET previous_hash='corrupted'");
 assert.throws(()=>journal.reconcile(),/AUDIT_MISMATCH/);
}finally{journal.close();}
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
 const {projectLivingEconomy}=await vite.ssrLoadModule('/src/economy/utopy.economy.ts');
 const {describeDirectPayment,privateEconomicRecord}=await vite.ssrLoadModule('/src/economy/utopy.node-adapter.ts');
 // Isolated, non-tradable classification fixtures, not bank/provider evidence.
 const order={attrs:{simulation:true,nonTradable:true,total:100}};
 const cycle=(status,state='accepted',amount=100)=>({state,paymentOutcome:status?{...receipt,attrs:{...receipt.attrs,status,amount}}:null});
 assert.equal(describeDirectPayment(order,cycle(null)).status,'pending'); // accepted/delivered != paid
 assert.equal(describeDirectPayment(order,cycle('failed')).status,'failed');
 assert.equal(describeDirectPayment(order,cycle('refunded')).status,'refunded');
 assert.equal(describeDirectPayment(order,cycle('refunded')).paidAmount,null);
 assert.equal(describeDirectPayment(order,cycle('paid','accepted',25)).paidAmount,25);
 assert.equal(describeDirectPayment(order,cycle('paid','accepted',25)).partialPayment,true);
 assert.equal(describeDirectPayment(order,cycle('paid','cancelled')).reviewRequired,true);
 assert.equal(privateEconomicRecord(receipt),false); // simulation never becomes real activity
 assert.equal(privateEconomicRecord({...receipt,meta:{...receipt.meta,scopes:['public']}}),false);
 for(const events of [[],[receipt],[{id:'fake:balance',kind:'settlement.confirmed',attrs:{actorId:'actor:simulation',available:999999,simulation:true,nonTradable:true}}]]){
  const view=projectLivingEconomy(events,'actor:simulation',new Set(events));
  assert.equal(view.available,null);assert.equal(view.pendingSettlement,null);assert.equal(view.canPayout,false);assert.equal(view.canSend,false);assert.equal(view.movements.length,0);
 }
 const {requestLivingPayout}=await vite.ssrLoadModule('/src/economy/utopy.payouts.ts');
 await assert.rejects(()=>requestLivingPayout());
 const routes=await vite.ssrLoadModule('/src/economy/utopy.payment-router.ts');
 assert.equal(routes.economicPaymentRoute('direct').walletCredit,false);
 assert.equal(routes.economicPaymentRoute('coordinated').mode,'unavailable');
 assert.equal(await routes.authorizeEconomicRoute({}, {}, {}, ()=>false),false);
 const settlement=await routes.projectSellerSettlement({evidence:{agreement:receipt},commitments:[receipt],attestations:[receipt],verification:{trust:()=>false,verifyProvider:()=>false}});
 assert.equal(settlement.view.safeToDeliver,false);
 assert.equal(settlement.view.settledAmount,0);
 assert.deepEqual(settlement.paymentOutcomes,[]);
 const {resolveCurrentIdentityContext}=await vite.ssrLoadModule('/src/utopy/identityContext.ts');
 const identity=await resolveCurrentIdentityContext({allLive:[]});
 const {explainLivingEconomy}=await vite.ssrLoadModule('/src/economy/utopy.economy-interface.ts');
 const view=projectLivingEconomy([],identity.actorId,new Set());
 const answer=await explainLivingEconomy('pagos pendientes',view,[]);
 assert.equal(answer.projection.selected,'economy.pending.read');
 assert.equal(answer.projection.executesAutomatically,false);
 assert.equal(answer.projection.proposalOnly,true);
 const sending=await explainLivingEconomy('enviar dinero',view,[]);
 assert.equal(sending.projection.selected,null);
 await assert.rejects(()=>explainLivingEconomy('mis movimientos',{...view,actorId:'actor:simulation:other'},[]));
 for(const path of ['src/economy/LivingEconomyPanel.tsx','src/components/LivingProfileQuickView.tsx','src/vault/BovedaVivaPanel.tsx','src/economy/utopy.economy-interface.ts'])await transformWithEsbuild(await readFile(new URL('../'+path,import.meta.url),'utf8'),path,{loader:path.endsWith('.tsx')?'tsx':'ts'});
}finally{await vite.close();}
console.log('OK: simulated/non-tradable isolated journals, exact minor arithmetic, per-currency double entry, transaction/idempotency conflicts, authority binding, audit corruption detection; no node event credits wallet, payout disabled, TSX. Not a provider or deployed financial integration.');
