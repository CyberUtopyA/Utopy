// Contacto solicitado para este despliegue. No concede permisos ni envía datos.
export const rentalContactPhone=String(import.meta.env.VITE_RENTAL_CONTACT_PHONE||'595981897096').replace(/\D/g,'');
export function rentalWhatsAppUrl(){return `https://wa.me/${rentalContactPhone}?text=${encodeURIComponent('Hola, ya tengo mi contrato de alquiler en PDF. Te lo adjunto aquí.')}`;}
export async function shareRentalPDF(pdf:{blob:Blob;fileName:string}){
 const file=new File([pdf.blob],pdf.fileName,{type:'application/pdf'});
 if(!navigator.canShare?.({files:[file]})||!navigator.share)throw Error('Este navegador no permite compartir archivos. Usá el PDF descargado y adjuntalo en WhatsApp.');
 await navigator.share({files:[file],title:'Contrato de alquiler'});
}
