import {useId,useState,type ReactNode} from 'react';
import {Check,ChevronDown} from 'lucide-react';
import './interactiveFields.css';
/** Controlled inputs remain owned by their caller, so collapsing never discards data. */
export default function InteractiveField({icon:Icon,title,summary,done=false,open,initialOpen=false,onToggle,children}:{icon:any;title:string;summary?:string;done?:boolean;open?:boolean;initialOpen?:boolean;onToggle?:()=>void;children:ReactNode}){
 const [expanded,setExpanded]=useState(initialOpen),id=useId(),visible=open??expanded;
 return <section className={`uif-card ${visible?'is-open':''}`}><button type="button" className="uif-card-toggle" aria-expanded={visible} aria-controls={id} onClick={()=>onToggle?onToggle():setExpanded(!expanded)}><span className="uif-icon"><Icon size={22} strokeWidth={1.5}/></span><span><b>{title}</b><small>{summary||'Tocá para completar'}</small></span>{done?<Check size={18} className="uif-done" aria-label="Completado"/>:<ChevronDown size={18}/>}</button><div id={id} hidden={!visible} className="uif-card-content">{children}</div></section>;
}
