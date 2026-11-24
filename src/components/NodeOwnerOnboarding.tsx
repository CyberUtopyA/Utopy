import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveCurrentIdentityContext } from '../utopy/identityContext';
import { acceptNodeSetupInvitation, createNodeSetupInvitation, verifyNodeSetupInvitation } from '../utopy/nodeOwnerOnboarding';

export default function NodeOwnerOnboarding(){
  const [actorId,setActorId]=useState('');const [name,setName]=useState('');const [purpose,setPurpose]=useState('');
  const [recipient,setRecipient]=useState('');const [sender,setSender]=useState('');
  const [consent,setConsent]=useState(false);const [acceptConsent,setAcceptConsent]=useState(false);
  const [invitation,setInvitation]=useState<any>(null);const [preview,setPreview]=useState<any>(null);
  const [created,setCreated]=useState<any>(null);const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true,generation=0;
    const refresh=()=>{const current=++generation;setActorId('');setInvitation(null);setPreview(null);setCreated(null);setConsent(false);setAcceptConsent(false);
      void resolveCurrentIdentityContext().then(context=>{if(active&&current===generation)setActorId(context.actorId);}).catch(()=>{if(active)setNotice('No pudimos abrir tu identidad.');});};
    window.addEventListener('utopy.wallet.changed',refresh);refresh();
    return()=>{active=false;window.removeEventListener('utopy.wallet.changed',refresh);};
  },[]);
  const run=async(task:()=>Promise<void>)=>{if(busy)return;setBusy(true);setNotice('');try{await task();}catch(error:any){setNotice(error?.message||'No se pudo verificar la preparación.');}finally{setBusy(false);}};
  const download=async()=>{
    const dv=await createNodeSetupInvitation({name,purpose,configuration:null},recipient,consent);
    const url=URL.createObjectURL(new Blob([JSON.stringify(dv,null,2)],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='utopy-preparacion-propietario.json';anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    setConsent(false);setNotice('Preparación firmada descargada. Compartila únicamente con su destinatario. No contiene claves privadas ni concede acceso a tus nodos.');
  };
  const read=async(file?:File)=>{
    setInvitation(null);setPreview(null);setCreated(null);setAcceptConsent(false);
    if(!file)return;
    if(file.size>128000)throw Error('Archivo demasiado grande. Usá solo una preparación UTOPY.');
    const dv=JSON.parse(await file.text());
    const context=await resolveCurrentIdentityContext();
    const checked=await verifyNodeSetupInvitation(dv,context.actorId);
    setActorId(context.actorId);setInvitation(dv);setPreview(checked);
  };
  return <section className="utopy-card ub-form" aria-labelledby="owner-onboarding-title">
    <div><small>Cada persona, su identidad · cada nodo, su responsable</small><h2 id="owner-onboarding-title">Preparar un nodo para su dueño</h2><p>Las demostraciones no se transfieren. El propietario crea un nodo nuevo con sus propias claves; quien le prepara la presentación no recibe acceso.</p></div>
    {notice&&<p className="utopy-notice" role="status">{notice}</p>}
    <label className="utopy-field">Tu identificador para recibir una preparación<input className="utopy-input" readOnly value={actorId} onFocus={event=>event.target.select()}/></label>
    <p className="utopy-muted">Compartí solo este identificador. Nunca compartas claves, contraseñas ni respaldos. Para usar otro dispositivo, recuperá tu misma identidad mediante su respaldo cifrado.</p>
    <details><summary>Yo preparo el espacio de otra persona</summary><div className="ub-form">
      <p>Primero, esa persona abre su Identidad UTOPY en su dispositivo y te comparte el identificador anterior. Confirmalo con ella por un canal conocido.</p>
      <label className="utopy-field">Identificador del propietario<input className="utopy-input" maxLength={100} value={recipient} onChange={event=>{setConsent(false);setRecipient(event.target.value);}}/></label>
      <label className="utopy-field">Nombre del nodo<input className="utopy-input" maxLength={100} value={name} onChange={event=>{setConsent(false);setName(event.target.value);}}/></label>
      <label className="utopy-field">Presentación pública propuesta<textarea className="utopy-input" maxLength={500} rows={3} value={purpose} onChange={event=>{setConsent(false);setPurpose(event.target.value);}}/></label>
      <label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> Confirmé el destinatario y autorizo compartir esta presentación con él. No le concedo acceso a un nodo existente.</label>
      <button className="utopy-button" disabled={busy||!consent||name.trim().length<2||!recipient.trim()} onClick={()=>void run(download)}>Descargar preparación firmada</button>
    </div></details>
    <details><summary>Soy el propietario y recibí una preparación</summary><div className="ub-form">
      <p>Abrí «Identidad, recuperación y dispositivos» y prepará tu respaldo cifrado antes de aceptar. El archivo no inicia sesión ni otorga permisos por sí solo.</p>
      <label className="utopy-field">Archivo de preparación<input type="file" accept="application/json,.json" disabled={busy} onChange={event=>{const file=event.target.files?.[0];void run(()=>read(file));event.target.value='';}}/></label>
      {preview&&<><div className="ub-empty"><h3>{preview.setup.name}</h3><p>{preview.setup.purpose}</p><p>Vence: {new Date(preview.expiresAt).toLocaleString('es-PY')}</p><small>Firma comprobable del remitente: {preview.issuerActorId}. Esto no certifica la propiedad legal del negocio.</small></div>
      <label className="utopy-field">Identificador del remitente, confirmado por otro canal<input className="utopy-input" maxLength={100} value={sender} onChange={event=>{setAcceptConsent(false);setSender(event.target.value);}}/></label>
      <label><input type="checkbox" checked={acceptConsent} onChange={event=>setAcceptConsent(event.target.checked)}/> Reconozco al remitente, soy responsable de este negocio y autorizo crear mi nodo con esta presentación pública. No estoy reclamando ni transfiriendo un nodo existente.</label>
      <button className="utopy-button" data-primary disabled={busy||!acceptConsent||!sender.trim()} onClick={()=>void run(async()=>{const dv=await acceptNodeSetupInvitation(invitation,sender,acceptConsent);setCreated(dv);setAcceptConsent(false);setNotice('Tu nodo está firmado por tu identidad y guardado localmente. No está desplegado ni habilitado para operaciones reales.');})}>Crear mi nodo con mi identidad</button></>}
      {created&&<Link className="utopy-button" to={`/n/${encodeURIComponent(created.attrs.slug)}/gestionar`}>Abrir mi nodo →</Link>}
    </div></details>
    <p className="utopy-muted">Este alta es local y dirigida a una identidad. No es una invitación remota de uso único ni un vínculo con cuentas de un servidor existente: esos procesos requieren la verificación y sincronización del nodo real.</p>
  </section>;
}
