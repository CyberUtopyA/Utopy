/** Structural arithmetic, never financial authority. */
export function validateDoubleEntry(lines) {
  if(!Array.isArray(lines)||lines.length<2||lines.length>32)throw Error('INVALID_JOURNAL');
  const totals=new Map();
  for(const line of lines){
    if(!/^[a-zA-Z0-9:_-]{1,160}$/.test(line.account)||!['debit','credit'].includes(line.side)||!['PYG','USD','BRL'].includes(line.currency)||!/^[1-9]\d{0,17}$/.test(line.amountMinor))throw Error('INVALID_LINE');
    const total=totals.get(line.currency)||{debit:0n,credit:0n};
    total[line.side]+=BigInt(line.amountMinor);totals.set(line.currency,total);
  }
  for(const total of totals.values())if(total.debit!==total.credit)throw Error('UNBALANCED_JOURNAL');
  return true;
}
