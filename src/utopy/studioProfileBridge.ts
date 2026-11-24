import { isTrustedStudioDV } from "./studioEntitlements";
export function safeStudioLink(input: unknown) {
  try { const url = new URL(String(input || "")); return url.protocol === "https:" && !url.username && !url.password ? url : null; } catch { return null; }
}
/** Navigation only. Studio authenticates and authorizes; no session or private data in the URL. */
export function studioProfileUrl(allLive: any[], subject: { actorId?: string; nodeId?: string }, returnTo: string) {
  const advertised = allLive.find(dv => isTrustedStudioDV(dv) && safeStudioLink(dv?.attrs?.links?.studio))?.attrs?.links?.studio;
  const url = safeStudioLink(advertised || import.meta.env.VITE_UTOPY_STUDIO_URL || "https://studio.utopy.space/studio");
  if (!url) return "";
  if (subject.nodeId) url.searchParams.set("nodeId", subject.nodeId);
  const back = safeStudioLink(returnTo);
  if (back) url.searchParams.set("returnTo", back.href);
  return url.href;
}
