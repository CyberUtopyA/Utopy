/** Editable catalog preparation; no invented staff, prices, durations or availability. */
export function bassiBookingPreset(nodeId:string,name='Bassi Coiffure'){
 return {schema:'utopy.living-booking/1',nodeId,name,timeZone:'America/Asuncion',confirmation:'approval',slotMinutes:15,
  presentation:{preset:'bassi-editorial-salon',tagline:'Tu estilo, tu esencia',logo:'',hero:'',address:'',instagram:''},resources:[],
  services:[['corte-femenino','Corte femenino','Femenino'],['corte-masculino','Corte masculino','Masculino'],['cortes','Cortes','Cortes'],['barba','Diseño de barba','Barbería'],['coloracion','Coloración','Coloración'],['skincare','Skincare','Skincare'],['hidratacion-facial','Hidratación facial','Skincare'],['cejas','Diseño de cejas','Cejas'],['makeup','Maquillaje','Makeup'],['masaje-capilar','Masaje capilar','Cortes'],['lavado','Lavado en pileta','Cortes']].map(([id,name,category])=>({id,name,category,description:'',image:'',price:null,currency:'PYG',durationMinutes:null,active:false,professionalIds:[],resourceIds:[],acceptsReferences:false})),gallery:[]};
}
