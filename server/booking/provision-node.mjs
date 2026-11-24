import {open,realpath} from 'node:fs/promises';
import {dirname,resolve,isAbsolute} from 'node:path';
import {createIdentity,exportIdentity} from 'utopy';
const nodeId=process.env.UTOPY_BOOKING_NODE_ID,path=process.env.UTOPY_BOOKING_IDENTITY_FILE;
if(!/^[a-zA-Z0-9:._-]{1,160}$/.test(nodeId||'')||!path||!isAbsolute(path))throw Error('NODE_ID_AND_PRIVATE_ABSOLUTE_IDENTITY_FILE_REQUIRED');
const parent=await realpath(dirname(path));if([resolve(path),parent].some(value=>value.split(/[\\/]/).some(p=>['public_html','public','dist','htdocs','www'].includes(p.toLowerCase()))))throw Error('PRIVATE_PATH_REQUIRED');
const identity=await createIdentity({actorId:`${nodeId}:runtime`,nodeId});
const handle=await open(resolve(parent,path.split(/[\\/]/).at(-1)),'wx',0o600);
try{await handle.writeFile(JSON.stringify(await exportIdentity(identity),null,2));}finally{await handle.close();}
console.log('Identidad del servidor creada en la ruta privada indicada. No se imprimieron claves ni credenciales.');
