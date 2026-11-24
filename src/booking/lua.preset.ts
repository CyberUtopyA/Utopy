export function luaBookingPreset(nodeId:string){
 return {schema:'utopy.living-booking/1',nodeId,name:'LUA Centro Estético y Spa',timeZone:'America/Asuncion',confirmation:'approval',slotMinutes:15,
  presentation:{preset:'lua-editorial-spa',tagline:'Priorizamos tu bienestar',logo:'',hero:'',address:'',instagram:'katherin_paniagua_'},
  resources:[{id:'professional:katherin',name:'Katherin Paniagua',kind:'professional',windows:[],blocks:[]}],
  services:[['masajes','Masajes relajantes','Masajes'],['reductores','Tratamientos reductores con aparatología','Corporales'],['faciales','Limpiezas faciales','Faciales'],['depilacion','Depilación','Depilación'],['maquillaje','Maquillaje profesional','Maquillaje']].map(([id,name,category])=>({id,name,category,description:'',image:'',price:null,currency:'PYG',durationMinutes:null,active:false,professionalIds:['professional:katherin'],resourceIds:[],acceptsReferences:false})),gallery:[]};
}
