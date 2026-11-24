import {useEffect,useState,useRef} from 'react';
import {businessRegistry,isCommercialWorkspaceEntry} from '../utopy/businessWorkspace';
import {loadTerritorialBookingCatalog} from './territorialBooking';
import {startVisiblePolling} from '../utils/visiblePolling.mjs';
export function useTerritorialBooking(allLive:any[],enabled:boolean){
 const source=useRef(allLive);source.current=allLive;
 const sourceKey=allLive.filter(dv=>/node\.manifest$|booking\.catalog|wallet\.device\.revoked|wallet\.root\.rotated/.test(String(dv.kind))).map(dv=>`${dv.id}:${dv.meta?.version}:${dv.meta?.updatedAt||dv.meta?.ts}:${dv.attrs?.status}`).sort().join('|');
 const [state,setState]=useState<{rows:any[];issues:any[];loading:boolean}>({rows:[],issues:[],loading:false});
 useEffect(()=>{if(!enabled)return;let active=true,busy=false;setState({rows:[],issues:[],loading:true});
 const refresh=async()=>{if(busy||document.hidden)return;busy=true;setState(prior=>({...prior,loading:true}));try{const entries=(await businessRegistry(source.current)).filter(isCommercialWorkspaceEntry);const result=await loadTerritorialBookingCatalog(entries);if(active)setState({...result,loading:false});}catch{if(active)setState({rows:[],issues:[{nodeId:'',name:'Red',message:'No se pudieron verificar los nodos de agenda.'}],loading:false});}finally{busy=false;}};
 const stop=startVisiblePolling(()=>void refresh(),60000);return()=>{active=false;stop();};
 },[sourceKey,enabled]);return state;
}
