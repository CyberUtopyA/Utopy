import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mtLiveSnapshot, mtLiveSubscribe, mtLiveSetAccessContext } from '../mt/mt.liveStore';
import { acquireLiveSymbiosis } from '../utopy/liveSymbiosis.singleton';
import { BUSINESS_CONFIGURATIONS, isCommercialWorkspaceEntry, searchBusinessEcosystem, businessAccess, businessPath, businessRegistry, belongsToBusiness, explicitPublic, validBusinessGrant, type BusinessEntry } from '../utopy/businessWorkspace';
import { publishAuthorizedDV, verifyAuthorizedDV } from '../utopy/authorizedPublish';
import { buildNodeAuthorizationDV, buildNodeAuthorizationRevokedDV, resolveCurrentIdentityContext, type CurrentIdentityContext } from '../utopy/identityContext';
import { resolveLivingIdentity } from '../social/liveProfile';
import {refreshRemoteAdmin} from '../booking/adminClient';
import { projectUniversalProduct, formatUniversalMoney } from '../mt/universalProduct';
import '../components/businessWorkspace.css';
import { ArrowLeft, ArrowUpRight, Fingerprint, Network, Plus, Search, ShieldCheck, Sparkles, Store, X } from 'lucide-react';
const Queue = lazy(() => import('../mt/ProducerQueuePanel'));
const Automation = lazy(() => import('../components/LivingAutomationPanel'));
const Wallet = lazy(() => import('../utopy/WalletPanel'));
const NodeLivingInterface = lazy(() => import('../components/NodeLivingInterface'));
const AvailabilityControl = lazy(() => import('../components/CapabilityAvailabilityControl'));
const BookingExperience = lazy(() => import('../booking/BookingExperience'));
const BookingSetup = lazy(() => import('../booking/BookingSetup'));
const NodeAdminDelegation = lazy(() => import('../components/NodeAdminDelegation'));
const ProfileQuickView = lazy(() => import('../components/LivingProfileQuickView'));
const BookingDataExport = lazy(()=>import('../booking/BookingDataExport'));
const Communication=lazy(()=>import('../components/CommunicationViva'));
const Conversations=lazy(()=>import('../components/GlobalConversationsModal'));

export default function BusinessWorkspace({ manage = false }: { manage?: boolean }) {
  const { slug } = useParams();
  const [allLive,setAllLive] = useState<any[]>(mtLiveSnapshot);
  const [registry,setRegistry] = useState<BusinessEntry[]>([]);
  const [identity,setIdentity] = useState<CurrentIdentityContext|null>(null);
  const [records,setRecords] = useState<any[]>([]);
  const [checking,setChecking] = useState(true);
  const [notice,setNotice] = useState('');
  const [section,setSection] = useState('Hoy');
  const [automation,setAutomation] = useState(false);
  const [conversationOpen,setConversationOpen]=useState(false);
  const [ecosystemQuery,setEcosystemQuery] = useState('');
  const [busy,setBusy] = useState(false);
  const running = useRef(false);
  const openedContext = useRef<string | null>(null);
  const [accessClock,setAccessClock] = useState(0);
  const checkedSource = useRef<any>(null);
  const checkedRoute = useRef('');
  const [subject,setSubject] = useState('');
  const [role,setRole] = useState('worker');
  const [until,setUntil] = useState('');
  const [grantConsent,setGrantConsent] = useState(false);
  const [managed,setManaged] = useState<BusinessEntry[]>([]);
  const [viewer,setViewer]=useState<CurrentIdentityContext|null>(null);
  const [profileOpen,setProfileOpen]=useState(false);
  const ownProfile=viewer?resolveLivingIdentity(viewer.actorId,allLive):null;
  useEffect(()=>{let active=true,request=0;const refresh=()=>{const ticket=++request;setViewer(null);setProfileOpen(false);setManaged([]);setAccessClock(value=>value+1);void resolveCurrentIdentityContext({allLive:mtLiveSnapshot()}).then(value=>{if(active&&ticket===request)setViewer(value);}).catch(()=>{});};refresh();window.addEventListener('utopy.wallet.changed',refresh);return()=>{active=false;++request;window.removeEventListener('utopy.wallet.changed',refresh);};},[]);
  const [spacesOpen,setSpacesOpen] = useState(false);
  const [spacesView,setSpacesView] = useState<'find'|'prepare'>('find');
  const [spacesQuery,setSpacesQuery] = useState('');
  const spacesDialog=useRef<HTMLDialogElement>(null);
  const visibleSpaces=spacesQuery.trim()?searchBusinessEcosystem(managed,spacesQuery):managed;
  const entry = registry.find(item => item.slug === slug);
  const config = entry?.configuration ? BUSINESS_CONFIGURATIONS[entry.configuration] : null;
  const hasBooking=Boolean(entry?.manifest.attrs?.booking)||Boolean(entry?.manifest.attrs?.capabilities?.some((c:any)=>(typeof c==='string'?c:c.id)==='living-booking'));
  const ecosystemMatches = searchBusinessEcosystem(registry,ecosystemQuery);
  useEffect(()=>{if(!manage||!entry?.manifest.attrs.administration)return;let active=true;const refresh=()=>{if(active)void refreshRemoteAdmin(entry).catch(()=>{});};refresh();const timer=window.setInterval(refresh,240000);return()=>{active=false;window.clearInterval(timer);};},[manage,entry?.nodeId]);
  useEffect(()=>{if(hasBooking&&identity?.authorizations.some(grant=>grant.id?.startsWith('node.authorization:node-admin:')))setSection('Agenda');},[slug,identity?.actorId]);
  useEffect(()=>{
    const dialog=spacesDialog.current;
    if(!dialog)return;
    if(spacesOpen&&!slug&&!checking){if(!dialog.open)dialog.showModal();}
    else if(dialog.open)dialog.close();
    if(!spacesOpen)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[spacesOpen,slug,checking]);
  useEffect(()=>{setSpacesOpen(false);setSpacesQuery('');},[slug]);

  useEffect(() => { const release = acquireLiveSymbiosis(); const stop = mtLiveSubscribe(setAllLive); return () => { stop(); release(); }; },[]);
  useEffect(() => {
    if (!manage || !entry || !identity) return;
    const now = Date.now();
    const deadlines = identity.authorizations.filter(grant=>grant.nodeId===entry.nodeId).map(grant=>new Date(grant.validUntil || '').getTime());
    if (entry.manifest.meta?.ttl_ms) deadlines.push(new Date(entry.manifest.meta.updatedAt || entry.manifest.meta.ts).getTime()+Number(entry.manifest.meta.ttl_ms));
    const next = Math.min(...deadlines.filter(value=>Number.isFinite(value) && value>now));
    if (!Number.isFinite(next)) return;
    const timer=window.setTimeout(()=>setAccessClock(value=>value+1),Math.min(next-now+1,2_147_483_647));
    return ()=>window.clearTimeout(timer);
  },[manage,entry,identity]);
  useEffect(() => {
    let current = true;
    const routeKey = `${slug || ''}:${manage}`;
    if (checkedSource.current !== allLive || checkedRoute.current !== routeKey) {
      setChecking(true);
      // Keep task state mounted during background verification; hide it until verified.
      // A route/identity boundary still discards its prior projection immediately.
      if(checkedRoute.current !== routeKey){setIdentity(null);setRecords([]);setManaged([]);}
      checkedSource.current=allLive; checkedRoute.current=routeKey;
    }
    void (async () => {
      const entries = (await businessRegistry(allLive)).filter(isCommercialWorkspaceEntry);
      const selected = entries.find(item => item.slug === slug);
      const context = selected && manage ? await businessAccess(selected,allLive) : null;
      const allowed = !slug ? (await Promise.all(entries.map(async item => await businessAccess(item,allLive) ? item : null))).filter(Boolean) as BusinessEntry[] : [];
      const privateRecords = context && selected ? (await Promise.all(allLive.filter(dv => belongsToBusiness(dv,selected.nodeId)).map(async dv => {
        const scopes = dv.meta?.scopes || [];
        const participants = dv.attrs?.participants || [];
        const canRead = explicitPublic(dv) || (scopes.includes('private') ? dv.attrs?.actorId === context.actorId : participants.includes(context.actorId) || participants.includes(selected.nodeId));
        if (!canRead) return null;
        const result = await verifyAuthorizedDV(dv,allLive);
        return result.accepted && result.proof === 'verified' ? dv : null;
      }))).filter(Boolean) : [];
      if (current) {
        setRegistry(entries); setIdentity(context); setManaged(allowed); setRecords(privateRecords);
        if (context && selected) { openedContext.current=context.actorId; mtLiveSetAccessContext({actorId:context.actorId,nodeId:selected.nodeId}); }
        else if (openedContext.current) { const actorId=openedContext.current; openedContext.current=null; mtLiveSetAccessContext({actorId}); }
      }
    })().catch(() => { if (current) {
      setIdentity(null); setRecords([]); setManaged([]); setRegistry([]);
      if (openedContext.current) { const actorId=openedContext.current; openedContext.current=null; mtLiveSetAccessContext({actorId}); }
      setNotice('No pudimos verificar el acceso. No se habilitaron operaciones.');
    } }).finally(() => { if (current) setChecking(false); });
    return () => { current = false; };
  },[allLive,slug,manage,accessClock]);
  useEffect(() => {
    return () => { if (openedContext.current) { const actorId=openedContext.current; openedContext.current=null; mtLiveSetAccessContext({actorId}); } };
  },[slug,manage]);
  useEffect(() => { setAutomation(false); setSection('Hoy'); setSubject(''); setGrantConsent(false); },[slug]);

  const perform = async (operation: () => Promise<void>) => {
    if (running.current) return;
    running.current = true; setBusy(true); setNotice('');
    try { await operation(); } catch(error: any) { setNotice(error?.message || 'No pudimos completar esta acción.'); }
    finally { running.current = false; setBusy(false); }
  };
  const membership = (revoke?: any) => perform(async () => {
    if (!entry || !grantConsent) throw Error('Revisá y confirmá la autorización.');
    const current = await businessAccess(entry,mtLiveSnapshot(),'node.authorization');
    if (!current || entry.manifest.meta?.ownership?.ownerDid !== current.ownerDid) throw Error('Solo la identidad controladora puede administrar estos permisos.');
    if (current.wallet.custody !== 'device') throw Error('Una identidad temporal no puede emitir permisos de negocio.');
    if (!revoke && (!/^actor:utopy:[a-z0-9]+$/i.test(subject) || !until || new Date(until).getTime() <= Date.now())) throw Error('Indicá una identidad UTOPY y un vencimiento futuro.');
    // Initial delegation is intentionally read-only; a role label does not grant execution.
    const dv = revoke ? buildNodeAuthorizationRevokedDV({authorizationId:revoke.id,actorId:revoke.attrs.actorId,nodeId:entry.nodeId}) : buildNodeAuthorizationDV({actorId:subject,nodeId:entry.nodeId,roles:[role],allowedActions:['node.workspace.read'],validUntil:new Date(until).toISOString(),issuedByActorId:current.actorId});
    await publishAuthorizedDV({dv,allLive:mtLiveSnapshot(),actingAsNodeId:entry.nodeId,targetNodeId:entry.nodeId,action:dv.kind,requiredAuthority:entry.nodeId,sensitivity:'sensitive',localOnly:true});
    setSubject(''); setGrantConsent(false); setNotice('Permiso firmado localmente. No implica entrega a otro dispositivo ni confirmación del receptor.');
  });

  const publicRecords = entry ? allLive.filter(dv => explicitPublic(dv) && belongsToBusiness(dv,entry.nodeId)) : [];
  const products = publicRecords.filter(dv=>['mt:producto','producto','market.product'].includes(dv.kind)).map(dv=>projectUniversalProduct(dv));
  return <main className={`ub-workspace utopy-ui ${!slug?'ub-console':''}`}>
    <header className="ub-header"><Link to="/market"><ArrowLeft size={16}/> MS Market</Link>{!slug?<button className="ub-console-avatar" type="button" disabled={!viewer} aria-label="Abrir mi perfil" onClick={()=>setProfileOpen(true)}>{ownProfile?.avatar?<img src={ownProfile.avatar} alt=""/>:<Fingerprint size={30} strokeWidth={1.3}/>}<span>{ownProfile?.name&&ownProfile.name!=='Persona'?ownProfile.name:'Mi perfil'}</span></button>:null}<Link to="/mi-espacio"><Network size={16}/> Mi espacio</Link></header>
    {notice && <p className="utopy-notice" role="status">{notice}</p>}
    {checking && <p role="status">Verificando identidad y permisos…</p>}
    <div className="ub-content" hidden={checking&&Boolean(slug)}>
    {!slug ? <>
      <section className="ub-console-title"><span className="ub-eyebrow">UTOPY</span><h1>Mis espacios</h1><p>Elegí dónde querés seguir.</p></section>
      <section id="mis-nodos" className="ub-section" aria-labelledby="my-nodes-title"><div className="ub-section-heading"><div><span className="ub-eyebrow">Tu espacio de trabajo</span><h2 id="my-nodes-title">Mis nodos</h2></div><span className="ub-count">{managed.length} con acceso verificado</span></div>
      <div className="ub-grid"><button type="button" className="ub-add-space" aria-label="Añadir o encontrar un espacio" aria-haspopup="dialog" aria-expanded={spacesOpen} onClick={()=>{setSpacesView('find');setSpacesOpen(true);}}><span className="ub-plus-square"><Plus size={30} strokeWidth={1.5}/></span><b>Un nuevo espacio</b><small>Buscá el tuyo o prepará uno</small></button>{managed.map(item => <Link className="utopy-card ub-business" key={item.nodeId} to={businessPath(item,true)}><div className="ub-business-top"><span className="ub-node-avatar" aria-hidden="true">{item.name.slice(0,1)}</span><ArrowUpRight size={19}/></div><h3>{item.name}</h3><p>{item.manifest.attrs?.workspaceIntent||'Tu espacio de administración'}</p><span className="ub-node-status"><i/>{item.manifest.attrs?.setupOnly?'En preparación':'Ver estado del negocio'}</span></Link>)}</div>
      {!managed.length && <div className="ub-empty ub-empty-refined"><span className="ub-node-avatar"><Store size={24}/></span><h3>Tu próximo espacio empieza acá</h3><p>No hay nodos vinculados con acceso verificable en este dispositivo. Podés explorar la red o revisar tu identidad.</p><a className="utopy-button" href="#mi-identidad">Revisar mi identidad <ArrowUpRight size={15}/></a></div>}
      </section>
      <dialog ref={spacesDialog} className="ub-spaces-dialog" aria-labelledby="ub-spaces-title" onCancel={()=>setSpacesOpen(false)} onClose={()=>setSpacesOpen(false)}>
      <header className="ub-spaces-heading"><div><span className="ub-eyebrow">A tu manera</span><h2 id="ub-spaces-title">Tus espacios</h2></div><button type="button" className="ub-icon-button" aria-label="Cerrar espacios" onClick={()=>setSpacesOpen(false)}><X size={22}/></button></header>
      <div className="ub-spaces-switch" role="group" aria-label="Elegir una opción"><button type="button" aria-pressed={spacesView==='find'} onClick={()=>setSpacesView('find')}><Search size={17}/> Encontrar el mío</button><button type="button" aria-pressed={spacesView==='prepare'} onClick={()=>setSpacesView('prepare')}><Plus size={17}/> Preparar un espacio</button></div>
      <div className="ub-spaces-body">
      {spacesView==='find'?<section className="ub-form"><label htmlFor="ub-spaces-search">Buscá entre tus nodos</label><input id="ub-spaces-search" autoFocus type="search" className="utopy-input" value={spacesQuery} onChange={event=>setSpacesQuery(event.target.value)} placeholder="Nombre o qué hacés…" maxLength={160}/><div className="ub-grid" aria-live="polite">{visibleSpaces.map(item=><Link className="ub-product" key={item.nodeId} to={businessPath(item,true)} onClick={()=>setSpacesOpen(false)}><span className="ub-node-avatar" aria-hidden="true">{item.name.slice(0,1)}</span><b>{item.name}</b><span>Abrir mi espacio <ArrowUpRight size={15}/></span></Link>)}</div>{!visibleSpaces.length?<p>{managed.length?'No encontramos un espacio con ese nombre.':'Todavía no tenés negocios vinculados en este dispositivo.'}</p>:null}<Suspense fallback={<p>Abriendo invitaciones…</p>}><NodeAdminDelegation allLive={allLive}/></Suspense><button className="utopy-button" type="button" onClick={()=>setSpacesView('prepare')}>Preparar un nuevo espacio <Plus size={16}/></button></section>:<>
      <Suspense fallback={<p>Abriendo agendamiento…</p>}><BookingSetup/></Suspense>
      <section className="utopy-card ub-owner-journey" aria-labelledby="owner-journey-title"><div className="ub-section-heading"><div><span className="ub-eyebrow"><ShieldCheck size={14}/> Continuidad y confianza</span><h2 id="owner-journey-title">Preparalo hoy. Que siga siendo suyo mañana.</h2><p>La persona y el negocio tienen identidades distintas. Cambiar quién administra no debe cambiar el nodo ni perder su historia.</p></div></div><ol className="ub-journey"><li><span>01</span><b>Preparar el negocio</b><p>Su identidad comercial, contenidos y capacidades, con un administrador autorizado.</p></li><li><span>02</span><b>Vincular a su dueño</b><p>Su Identidad Viva, su aceptación y una autorización verificable sobre el mismo nodo.</p></li><li><span>03</span><b>Continuar sin empezar de nuevo</b><p>Los datos y el identificador se conservan. Los permisos anteriores se revisan y revocan.</p></li></ol><div className="ub-service-state" id="ub-provisioning-state" role="status"><ShieldCheck size={19}/><p><b>Alta y cambio de administración no habilitados en este entorno.</b><br/>Falta conectar el servicio del nodo que conserva su autoridad, datos y autorizaciones. No se reemplaza por una creación local ni se concede acceso por conocer un enlace.</p></div><button className="utopy-button" data-primary disabled aria-describedby="ub-provisioning-state"><Plus size={16}/> Crear nodo</button></section>
      <section className="utopy-card ub-ecosystem ub-form" aria-labelledby="ecosystem-title">
        <div><span className="ub-eyebrow"><Network size={14}/> Conexiones que abren posibilidades</span><h2 id="ecosystem-title">Tu lugar en el ecosistema</h2><p>Buscá lo que necesitás. Encontrá con quién construirlo, sin encajar en una categoría.</p></div>
        <label className="utopy-field">¿Qué querés hacer o encontrar?<input type="search" className="utopy-input" maxLength={500} value={ecosystemQuery} onChange={event=>setEcosystemQuery(event.target.value)} placeholder="Buscar por nombre o capacidad…" aria-describedby="ecosystem-help"/></label>
        <p id="ecosystem-help" className="utopy-muted">Busca en los nodos verificables disponibles en este dispositivo. Encontrar uno no concede acceso ni confirma disponibilidad.</p>
        {ecosystemQuery.trim() && <div aria-live="polite">{ecosystemMatches.length ? <div className="ub-grid">{ecosystemMatches.map(item=><Link className="ub-product" key={item.nodeId} to={businessPath(item)}><b>{item.name}</b><span>{item.manifest.attrs?.setupOnly ? 'En preparación' : 'Ver su espacio'} →</span></Link>)}</div> : <p>No encontramos coincidencias en los nodos cargados. Tu idea no está limitada por esta búsqueda.</p>}</div>}
        <div className="ub-ecosystem-actions"><Link className="utopy-button" to="/market?tab=categorias">Explorar la red <ArrowUpRight size={16}/></Link><button type="button" className="utopy-button" onClick={()=>setSpacesView('find')}>Volver a mis nodos</button></div>
      </section>
      </>}
      </div></dialog>
      <details id="mi-identidad" className="utopy-card ub-identity-details"><summary><span className="ub-node-avatar"><Fingerprint size={23}/></span><span><b>Tu Identidad Viva</b><small>Recuperación, dispositivos y resguardo de tus accesos</small></span><Plus size={19} className="ub-accordion-indicator"/></summary><div className="ub-accordion-body"><Suspense fallback={<p>Abriendo identidad…</p>}><Wallet compact/></Suspense></div></details>
    </> : !entry ? <section className="utopy-card"><h1>Espacio no disponible</h1><p>No hay una presentación vigente y verificable con este enlace. No se seleccionó otro negocio en su lugar.</p><Link to="/mi-espacio">Volver a mis negocios</Link></section> : manage && !identity ? <section className="utopy-card"><h1>Acceso no autorizado</h1><p>Usá la identidad autorizada por el responsable del negocio. Cambiar el enlace o el almacenamiento del navegador no concede permisos.</p><Link to={businessPath(entry)}>Ver presentación pública</Link></section> : <>
      <section className="utopy-card"><small>{manage ? 'Mi espacio de trabajo' : 'Espacio del negocio'}</small><h1>{entry.name}</h1><p>{entry.manifest.attrs?.setupOnly ? 'En preparación · espacio local, no habilitado para recibir operaciones.' : 'Capacidades y datos publicados por este negocio.'}</p><Link to={businessPath(entry,!manage)}>{manage ? 'Ver espacio público' : 'Administrar este negocio'}</Link></section>
      {manage && identity ? <>
        <nav className="utopy-activity-nav" aria-label="Espacio de trabajo">{['Hoy','Trabajos','Agenda','Catálogo','Comunicación','Procedimientos','Configuración'].map(item=><button className="utopy-button" key={item} aria-pressed={section===item} onClick={()=>setSection(item)}>{item}</button>)}</nav>
        {section==='Comunicación'?<Suspense fallback={<p>Abriendo Comunicación Viva…</p>}><Communication key={`${identity.actorId}:${entry.nodeId}`} entry={entry} actorId={identity.actorId} allLive={allLive} onChat={()=>setConversationOpen(true)}/></Suspense>:null}
        {section==='Agenda'&&<Suspense fallback={<p>Abriendo agenda…</p>}>{entry.manifest.meta?.ownership?.ownerDid===identity.ownerDid?<details className="utopy-card"><summary>Conexión del servidor · avanzado</summary><BookingSetup entry={entry}/></details>:null}{hasBooking?<BookingExperience key={`${identity.actorId}:${entry.nodeId}`} entry={entry} manage/>:null}</Suspense>}
        {section==='Hoy' && <Suspense fallback={<p>Abriendo tus herramientas…</p>}><AvailabilityControl key={`presence:${identity.actorId}:${entry.nodeId}`} entry={entry} allLive={allLive}/><NodeLivingInterface key={`${identity.actorId}:${entry.nodeId}`} entry={entry} records={records} actorId={identity.actorId} canConfigure={entry.manifest.meta?.ownership?.ownerDid===identity.ownerDid || identity.authorizations.some(grant=>validBusinessGrant(grant,entry.nodeId,identity.actorId,'composition.publish'))}/></Suspense>}
        {section==='Trabajos' && <Suspense fallback={<p>Abriendo trabajos…</p>}><Queue allLive={records} actorId={identity.actorId} nodeId={entry.nodeId} hideOpen readOnly/></Suspense>}
        {section==='Procedimientos' && <section className="utopy-card"><h2>Mi forma de trabajar</h2>{config && <ol>{config.steps.map(step=><li key={step}>{step}</li>)}</ol>}<p>La secuencia es una guía configurable, no una automatización activa. No inventa tiempos, precios ni resultados.</p><button className="utopy-button" onClick={()=>setAutomation(true)}>Expresar mi procedimiento</button></section>}
        {section==='Configuración' && entry.manifest.meta?.ownership?.ownerDid===identity.ownerDid && <Suspense fallback={<p>Abriendo administración…</p>}><NodeAdminDelegation entry={entry} allLive={allLive}/></Suspense>}
        {section==='Configuración'&&hasBooking?<Suspense fallback={<p>Abriendo respaldo…</p>}><BookingDataExport entry={entry}/></Suspense>:null}
        {section==='Configuración' && <section className="utopy-card ub-form"><h2>Permisos de consulta</h2><p>Esta opción sólo concede lectura. Para administrar agenda, servicios y fotos usá la invitación con aceptación de arriba.</p>
          {entry.manifest.meta?.ownership?.ownerDid === identity.ownerDid ? <><label className="utopy-field">Identidad de la persona<input className="utopy-input" value={subject} onChange={event=>setSubject(event.target.value)} placeholder="Identidad UTOPY del operador"/></label><label className="utopy-field">Responsabilidad<select className="utopy-input" value={role} onChange={event=>setRole(event.target.value)}><option value="worker">Operador</option><option value="manager">Encargado</option><option value="owner">Responsable</option></select></label><label className="utopy-field">Hasta cuándo<input className="utopy-input" type="datetime-local" value={until} onChange={event=>setUntil(event.target.value)}/></label><label><input type="checkbox" checked={grantConsent} onChange={event=>setGrantConsent(event.target.checked)}/> Confirmo esta modificación de permisos.</label><button className="utopy-button" disabled={busy || !grantConsent} onClick={()=>void membership()}>Autorizar consulta</button>{records.filter(dv=>dv.kind==='node.authorization' && dv.attrs?.nodeId===entry.nodeId && !records.some(revocation=>revocation.kind==='node.authorization.revoked' && revocation.attrs?.authorizationId===dv.id)).map(dv=><div key={dv.id}><span>Operador {String(dv.attrs?.actorId || '').slice(-8)} · Consulta hasta {dv.attrs?.validUntil ? new Date(dv.attrs.validUntil).toLocaleDateString('es-PY') : 'sin vencimiento'}</span><button className="utopy-button" disabled={busy || !grantConsent} onClick={()=>void membership(dv)}>Revocar</button></div>)}</> : <p>Solo el controlador del nodo puede cambiar estos permisos.</p>}
        </section>}
      </> : null}
      {!manage&&hasBooking?<Suspense fallback={<p>Abriendo servicios…</p>}><BookingExperience key={entry.nodeId} entry={entry}/></Suspense>:null}
      {(!manage&&!hasBooking || manage&&section==='Catálogo') && <section className="utopy-card"><h2>Catálogo público</h2>{products.length ? <div className="ub-grid">{products.map(product=>product && <Link className="ub-product" key={product.id} to={`/producto/${encodeURIComponent(product.productId || product.id)}`}><b>{product.title}</b><span>{formatUniversalMoney(product.finalPrice,product.currency)}</span></Link>)}</div> : <p>No hay productos publicados. No se inventaron precios ni disponibilidad.</p>}</section>}
      {!manage && !entry.manifest.attrs?.setupOnly && <Link className="utopy-button" to={`/market?tab=crear&createWith=${encodeURIComponent(entry.manifest.id)}`}>Consultar qué necesito</Link>}
      {automation && identity && <Suspense fallback={<p>Abriendo procedimiento…</p>}><Automation allLive={records} actorId={identity.actorId} suggestions={config ? [...config.steps] : []} node={{nodeId:entry.nodeId,capabilities:entry.manifest.attrs?.capabilities || []}} onClose={()=>setAutomation(false)}/></Suspense>}
    </>}
    </div>
    {conversationOpen?<Suspense fallback={<p>Abriendo conversaciones…</p>}><Conversations open onClose={()=>setConversationOpen(false)} from="market" returnTo={window.location.pathname+window.location.search} onOpenProfile={()=>{setConversationOpen(false);setProfileOpen(true);}}/></Suspense>:null}
    {profileOpen&&viewer?<Suspense fallback={<p role="status">Abriendo tu perfil…</p>}><ProfileQuickView open own allLive={allLive} activeActor={{id:viewer.actorId,actorId:viewer.actorId}} onClose={()=>setProfileOpen(false)}/></Suspense>:null}
  </main>;
}
