import {luaBookingPreset} from './lua.preset';
import {bassiBookingPreset} from './bassi.preset';
import {BOOKING_FEATURES} from './contracts.mjs';
/** Transient UI fixtures only. Never publish, sign, register or persist these IDs. */
export function bookingPreviewConfig(brand:string){
 const config=brand==='bassi'?bassiBookingPreset('preview:booking:bassi'):luaBookingPreset('preview:booking:lua');
 const professional='preview:professional';
 return {...config,simulation:true,nonTradable:true,features:{...BOOKING_FEATURES},
  resources:[{id:professional,name:'Profesional de ejemplo',kind:'professional',windows:[1,2,3,4,5].map(day=>({day,start:'09:00',end:'18:00',breaks:[{start:'12:00',end:'13:00'}]})),blocks:[]}],
  services:config.services.map((service,i)=>({...service,price:null,durationMinutes:30,professionalIds:[professional],active:i===0,image:'',extraFields:[]}))};
}
