/** Poll only while visible; revalidate immediately on return. No data or authorization cache. */
export function startVisiblePolling(refresh,interval,{documentRef=globalThis.document,setTimer=setInterval,clearTimer=clearInterval}={}){
 let timer=null,stopped=false;
 const sync=()=>{if(stopped)return;if(documentRef?.hidden){if(timer!==null)clearTimer(timer);timer=null;return;}refresh();if(timer===null)timer=setTimer(refresh,interval);};
 documentRef?.addEventListener('visibilitychange',sync);sync();
 return ()=>{stopped=true;if(timer!==null)clearTimer(timer);timer=null;documentRef?.removeEventListener('visibilitychange',sync);};
}
