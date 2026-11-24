import { useEffect, useState } from "react";
import { requireActiveSessionIdentity, signIdentitySessionProof } from "../utopy/ownership";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { mtLiveSnapshot } from "../mt/mt.liveStore";

const STUDIO = "https://studio.utopy.space";
export default function IdentitySessionSigner() {
  const [challenge, setChallenge] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const value = event.data?.challenge;
      if (event.origin !== STUDIO || event.source !== window.opener || event.data?.type !== "identity.session.challenge") return;
      if (value?.audience !== "studio.utopy.space" || !/^[a-f0-9]{64}$/.test(value.nonce || "") || !/^[a-f0-9]{32}$/.test(value.challengeId || "") || Date.parse(value.expiresAt) <= Date.now() || Date.parse(value.expiresAt) > Date.now() + 125000) return;
      setChallenge(value);
    };
    window.addEventListener("message", receive);
    window.opener?.postMessage({ type: "identity.session.ready" }, STUDIO);
    return () => window.removeEventListener("message", receive);
  }, []);
  const continueSession = async () => {
    if (!challenge || busy) return;
    setBusy(true);
    try {
      if (Date.parse(challenge.expiresAt) <= Date.now()) throw new Error("La solicitud venció. Volvé a Studio.");
      await requireActiveSessionIdentity();
      const identity = await resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() });
      const proof = await signIdentitySessionProof({ kind: "identity.session.proof", ...challenge, actorId: identity.actorId, issuedAt: new Date().toISOString() });
      window.opener?.postMessage({ type: "identity.session.proof", proof }, STUDIO);
    } catch (cause: any) { setError(cause?.message || "No pudimos confirmar tu identidad."); setBusy(false); }
  };
  return <section className="mx-auto my-12 max-w-md rounded-[32px] bg-white p-8 shadow-xl"><h1 className="text-2xl font-bold">Studio quiere usar tu Identidad Viva</h1><p className="my-4 text-slate-500">Tu clave permanece en este dispositivo. Los permisos de tus nodos se verifican por separado.</p>{error ? <p role="alert">{error}</p> : null}<div className="flex gap-3"><button disabled={!challenge || busy} onClick={() => void continueSession()} className="rounded-full bg-indigo-600 px-6 py-3 text-white">{busy ? "Confirmando…" : "Continuar"}</button><button onClick={() => { window.opener?.postMessage({ type: "identity.session.cancelled" }, STUDIO); window.close(); }} className="rounded-full border px-6 py-3">Cancelar</button></div></section>;
}
