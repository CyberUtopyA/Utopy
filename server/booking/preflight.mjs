import {NodeAdminInvitations} from './admin-invitations.mjs';
import {LivingBookingStore} from './store.mjs';
import {createNodeBookingHost} from './node-host.mjs';
const host=await createNodeBookingHost({identityFile:process.env.UTOPY_BOOKING_IDENTITY_FILE,manifestFile:process.env.UTOPY_BOOKING_MANIFEST_FILE});
const store=new LivingBookingStore(':memory:');
try{const invitations=new NodeAdminInvitations(store,host);await invitations.manifest(host.runtime.identity.nodeId);console.log('OK: Runtime, manifiesto firmado, clave del servidor y permisos limitados coinciden. Falta comprobar el proxy HTTPS y el recorrido en el navegador real.');}finally{store.close();await host.runtime.stop();}
