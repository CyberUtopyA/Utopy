/** Coalesce derived work, not data or authority: one worker, latest complete snapshot. */
export function createLatestTask(worker,{delay=80,setTimer=setTimeout,clearTimer=clearTimeout,onError=()=>{}}={}){
 let latest,pending=false,running=false,stopped=false,timer=null;
 const schedule=()=>{if(stopped||running||timer!==null||!pending)return;timer=setTimer(run,delay);};
 const run=async()=>{
  timer=null;if(stopped)return;running=true;pending=false;const value=latest;
  try{await worker(value);}catch(error){onError(error);}finally{running=false;schedule();}
 };
 return {push(value){if(stopped)return;latest=value;pending=true;schedule();},stop(){stopped=true;pending=false;latest=undefined;if(timer!==null)clearTimer(timer);timer=null;}};
}
