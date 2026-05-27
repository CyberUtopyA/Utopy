// utopy/intent.ts
export type Intent = {
  sym: string;
  say: string;
  with?: any;
  ns?: string;
  from?: string;
  to?: string;
  ts?: number;
  replyTo?: string;
};

// envía un intent por el transport actual
export async function sendIntent(chan: { send: (op: string, input?: any)=>Promise<void> }, i: Intent) {
  i.ts = i.ts || Date.now();
  await chan.send("intent", i);
}
