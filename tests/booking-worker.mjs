import {parentPort,workerData} from 'node:worker_threads';
import {LivingBookingStore} from '../server/booking/store.mjs';
const store=new LivingBookingStore(workerData.path,{now:()=>workerData.now,authorize:async({proof,nodeId,action})=>proof.simulation===true&&proof.nonTradable===true?{verified:true,actorId:proof.actorId,nodeId,allowedActions:[action]}:null});
try{await store.command({actorId:workerData.actorId,simulation:true,nonTradable:true},'node:lua',workerData.actorId,workerData.command);parentPort.postMessage('accepted');}
catch(error){parentPort.postMessage(error.message);}
finally{store.close();}
