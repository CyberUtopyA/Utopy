import {useEffect,useId,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
import './bookingCards.css';

export default function BookingEditorPopup({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{const element=dialog.current;const previous=document.activeElement as HTMLElement|null;element?.showModal();return()=>{element?.close();previous?.focus();};},[]);
 return <dialog ref={dialog} className="lb-editor-popup" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();onClose();}}>
  <header><h2 id={titleId}>{title}</h2><button type="button" aria-label="Cerrar editor" onClick={onClose}><X size={22}/></button></header>
  <div className="lb-popup-content">{children}</div>
  <footer><small>Los cambios quedan en tu configuración pendiente.</small><button type="button" onClick={onClose}>Listo</button></footer>
 </dialog>;
}
