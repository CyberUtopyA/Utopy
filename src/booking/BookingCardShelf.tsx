import {useState,type ReactNode} from 'react';
import {Plus,LayoutGrid,GalleryHorizontal} from 'lucide-react';
import './bookingCards.css';
export default function BookingCardShelf({label,onAdd,addLabel,children}:{label:string;onAdd:()=>void;addLabel:string;children:ReactNode}){
 const [all,setAll]=useState(false);
 return <><div className="lb-shelf-toolbar"><span>{label}</span><button type="button" aria-pressed={all} onClick={()=>setAll(!all)}>{all?<GalleryHorizontal size={18}/>:<LayoutGrid size={18}/>} {all?'Carrusel':'Ver todos'}</button></div><div className={`lb-card-carousel${all?' lb-card-grid':''}`} role="group" aria-label={label}><button type="button" className="lb-edit-card lb-add-card" aria-haspopup="dialog" onClick={onAdd}><span className="lb-card-symbol"><Plus size={28}/></span><strong>{addLabel}</strong><small>Crealo a tu manera</small></button>{children}</div></>;
}
