/** Exact, host-configured HTTPS proxy route; no secrets in URLs or CORS wildcard. */
export function communicationWebhook(communication){return async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 try{const url=new URL(req.url,'http://localhost'),match=/^\/api\/communication\/webhook\/([a-zA-Z0-9:._-]{1,160})\/(telegram)$/.exec(url.pathname);if(req.method!=='POST'||!match)throw Error('INVALID_WEBHOOK');let size=0;const chunks=[];for await(const data of req){const bytes=Buffer.from(data);size+=bytes.length;if(size>65536)throw Error('REQUEST_TOO_LARGE');chunks.push(bytes);}const result=await communication.receive(match[1],match[2],req.headers,JSON.parse(Buffer.concat(chunks).toString('utf8')));res.statusCode=200;res.end(JSON.stringify(result));}catch{res.statusCode=403;res.end(JSON.stringify({error:'WEBHOOK_REJECTED'}));}
};}
