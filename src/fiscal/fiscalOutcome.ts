export type FiscalState = "DRAFT" | "GENERATED" | "SIGNED" | "SENT" | "PROCESSING" | "UNKNOWN" | "ACCEPTED" | "REJECTED";
/** Private adapter attestation. UTOPY signature does not replace XMLDSig or SIFEN acceptance. */
export type FiscalOutcome = {
  commercialDocumentId: string;
  revision: number;
  documentHash: string;
  issuerNodeId: string;
  environment: "test" | "production";
  state: FiscalState;
  cdc?: string;
  resultCode?: string;
  processedAt: string;
  responseRef?: string;
  sourceRefs: { id: string; kind: string }[];
  adapterAuthority: string;
  kudeAvailable: boolean;
  simulation?: boolean;
};
