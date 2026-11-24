export const COMMUNICATION_SCHEMA='utopy.communication/1';
export const COMMUNICATION_CHANNELS=Object.freeze([
 {id:'whatsapp',label:'WhatsApp Business',adapter:'communication.meta'},
 {id:'instagram',label:'Instagram',adapter:'communication.meta'},
 {id:'messenger',label:'Messenger',adapter:'communication.meta'},
 {id:'telegram',label:'Telegram',adapter:'communication.telegram'},
 {id:'sms',label:'SMS',adapter:'communication.sms'},
 {id:'phone',label:'Teléfono',adapter:'communication.phone'},
 {id:'email',label:'Correo',adapter:'communication.email'},
 {id:'internal',label:'Chat UTOPY',adapter:'communication.internal'},
]);
export const COMMUNICATION_TEMPLATES=Object.freeze([
 {id:'booking-confirmed',label:'Reserva confirmada',event:'booking.confirm',requiredStatus:'confirmed',text:'Tu reserva de {{service}} está confirmada para {{time}}.'},
 {id:'booking-reminder',label:'Recordar una cita',event:'booking.reminder.due',text:'Recordatorio: {{service}}, {{time}}.'},
 {id:'booking-cancelled',label:'Cita cancelada',event:'booking.cancel',requiredStatus:'cancelled',text:'Tu cita de {{service}} fue cancelada.'},
 {id:'order-confirmed',label:'Pedido confirmado',event:'market.order.accept',text:'Tu pedido {{order}} está confirmado.'},
 {id:'order-ready',label:'Pedido preparado',event:'order.ready',text:'Tu pedido {{order}} está preparado.'},
 {id:'delivery',label:'Entrega completada',event:'delivery.completed',text:'La entrega de {{order}} fue completada.'},
]);
export function communicationChannel(id){const channel=COMMUNICATION_CHANNELS.find(c=>c.id===id);if(!channel)throw Error('INVALID_CHANNEL');return channel;}
export function internationalPhone(value){const phone=String(value||'').trim();if(!/^\+[1-9]\d{6,14}$/.test(phone))throw Error('Usá formato internacional, por ejemplo +595…');return phone;}
export function renderCommunicationTemplate(template,variables){return String(template).replace(/\{\{([a-zA-Z]+)\}\}/g,(_,key)=>{if(typeof variables[key]!=='string'||!variables[key].trim())throw Error(`Falta el dato autorizado: ${key}`);return variables[key];});}
export function normalizeTelegramUpdate(update){
 const message=update?.message;
 if(!Number.isSafeInteger(update?.update_id)||!message||!Number.isSafeInteger(message.message_id)||!Number.isSafeInteger(message.chat?.id)||typeof message.text!=='string'||!Number.isSafeInteger(message.date))return null;
 return {schema:COMMUNICATION_SCHEMA,channel:'telegram',externalEventId:String(update.update_id),externalMessageId:String(message.message_id),externalConversationId:String(message.chat.id),sender:{externalId:message.from?.id==null?null:String(message.from.id)},direction:'inbound',text:message.text.slice(0,4096),occurredAt:new Date(message.date*1000).toISOString(),identityLinked:false};
}
