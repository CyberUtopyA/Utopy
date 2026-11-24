import {timingSafeEqual} from 'node:crypto';
import {normalizeTelegramUpdate} from '../../src/communication/contracts.mjs';
const fail=code=>{throw Error(code);};
/** Official Bot API only; credentials never returned or logged. No user-account automation. */
export function telegramCommunicationAdapter({fetchImpl=fetch}={}){
 const api=async(credentials,method,payload={})=>{
  if(!/^\d+:[A-Za-z0-9_-]{20,}$/.test(credentials?.token||''))fail('INVALID_CREDENTIALS');
  let response;try{response=await fetchImpl(`https://api.telegram.org/bot${credentials.token}/${method}`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});}catch{fail('PROVIDER_RESULT_UNKNOWN');}
  let body;try{body=await response.json();}catch{fail('PROVIDER_RESULT_UNKNOWN');}
  if(!response.ok||body.ok!==true){const error=Error(body.error_code===401?'CREDENTIALS_REVOKED':body.error_code===429?'PROVIDER_RATE_LIMIT':'PROVIDER_REJECTED');if(body.error_code===429)error.retryAfter=Math.min(3600,Math.max(1,Number(body.parameters?.retry_after)||60));throw error;}return body.result;
 };
 return {id:'communication.telegram',capabilities:{send:true,receive:true,deliveryReceipts:false,oauth:false},
 async connect(credentials,webhookUrl){let url;try{url=new URL(webhookUrl);}catch{fail('PUBLIC_WEBHOOK_REQUIRED');}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)fail('PUBLIC_WEBHOOK_REQUIRED');if(!/^[A-Za-z0-9_-]{32,256}$/.test(credentials.webhookSecret||''))fail('WEBHOOK_SECRET_REQUIRED');const bot=await api(credentials,'getMe');if(bot?.is_bot!==true||!Number.isSafeInteger(bot.id))fail('INVALID_PROVIDER_IDENTITY');await api(credentials,'setWebhook',{url:url.href,secret_token:credentials.webhookSecret,allowed_updates:['message'],drop_pending_updates:false});return {id:String(bot.id),name:String(bot.first_name||''),username:String(bot.username||'')};},
 async health(credentials){const bot=await api(credentials,'getMe');if(bot?.is_bot!==true||!Number.isSafeInteger(bot.id))fail('INVALID_PROVIDER_IDENTITY');return {id:String(bot.id),name:String(bot.first_name||''),username:String(bot.username||'')};},
 async disconnect(credentials){await api(credentials,'deleteWebhook',{drop_pending_updates:false});},
 async send(credentials,message){const result=await api(credentials,'sendMessage',{chat_id:message.recipient,text:message.text,link_preview_options:{is_disabled:true}});if(!Number.isSafeInteger(result?.message_id))fail('PROVIDER_RESULT_UNKNOWN');return {externalMessageId:String(result.message_id),status:'accepted_by_provider'};},
 verifyWebhook(credentials,headers,body){const supplied=Buffer.from(String(headers['x-telegram-bot-api-secret-token']||'')),expected=Buffer.from(String(credentials.webhookSecret||''));if(!expected.length||supplied.length!==expected.length||!timingSafeEqual(supplied,expected))fail('INVALID_WEBHOOK_SIGNATURE');return normalizeTelegramUpdate(body);},
 };
}
