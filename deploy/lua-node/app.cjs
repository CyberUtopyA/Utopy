// Optional startup wrapper for hosts that request a CommonJS entry point.
import('./server/booking/run.mjs').catch(()=>{
 console.error('No se pudo iniciar el nodo. Revisá sus variables y ejecutá npm run preflight en el entorno privado.');
 process.exitCode=1;
});
