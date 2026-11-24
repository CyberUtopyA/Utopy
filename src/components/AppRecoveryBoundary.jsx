import React from 'react';
export default class AppRecoveryBoundary extends React.Component {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error){console.error('[UTOPY] No se pudo mostrar la aplicación',error);}
 render(){
  if(!this.state.failed)return this.props.children;
  return <main role="alert" style={{maxWidth:480,margin:'12vh auto',padding:28,fontFamily:'system-ui',color:'#392c28',background:'#faf8f5',borderRadius:22}}><h1>No pudimos abrir esta vista</h1><p>Puede haber una actualización pendiente o un error de carga. Tus datos no se borraron.</p><button type="button" style={{padding:'12px 20px',borderRadius:20,cursor:'pointer'}} onClick={()=>window.location.reload()}>Volver a cargar</button><p><a href="/lua">Abrir LUA</a> · <a href="/market">MS Market</a></p></main>;
 }
}
