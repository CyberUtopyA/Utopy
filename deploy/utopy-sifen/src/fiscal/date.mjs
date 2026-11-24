import moment from 'moment-timezone';
/** Pinned tzdata avoids obsolete host ICU rules (Paraguay permanent -03: IANA 2025a). */
export function fiscalDateTime(instant) {
  if(typeof instant!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(instant)||!Number.isFinite(Date.parse(instant)))throw new Error('FISCAL_DATE_INVALID');
  return moment.parseZone(instant).tz('America/Asuncion').format('YYYY-MM-DDTHH:mm:ss');
}
