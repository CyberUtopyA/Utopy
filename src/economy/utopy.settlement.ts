export type JournalLine={account:string;side:'debit'|'credit';amountMinor:string;currency:string};
/** Mathematical validation only, not evidence of payment, settlement or custody. */
export { validateDoubleEntry } from './journalRules.mjs';
