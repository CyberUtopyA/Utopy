import type { FiscalOutcome, FiscalState } from "./fiscalOutcome";
const labels: Record<FiscalState, string> = {
  DRAFT: "Borrador de documento", GENERATED: "Documento generado", SIGNED: "Documento firmado",
  SENT: "Enviado", PROCESSING: "Procesando", UNKNOWN: "Consultando resultado",
  ACCEPTED: "Aceptado por SIFEN", REJECTED: "Rechazado por SIFEN",
};
/** Call only with an authenticated sidecar response, not an arbitrary liveStore DV. */
export function projectFiscalOutcome(outcome: FiscalOutcome | null, verified: boolean) {
  if (!outcome || !verified) return { label: "Sin aceptación fiscal verificada", isDTE: false, canViewKude: false };
  return { label: `${outcome.simulation ? "Simulación · " : ""}${labels[outcome.state]}${outcome.environment === "test" ? " · Pruebas, sin valor fiscal" : ""}`,
    isDTE: outcome.state === "ACCEPTED" && !outcome.simulation, canViewKude: outcome.state === "ACCEPTED" && outcome.kudeAvailable };
}
