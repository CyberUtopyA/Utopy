import { useEffect, useRef, useState } from "react";

export function useContextualVoice(onText: (text: string) => void) {
  const current = useRef(onText); current.current = onText;
  const speech = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => () => { if (speech.current) { speech.current.onresult = null; speech.current.onend = null; speech.current.abort(); } }, []);
  const start = () => {
    if (speech.current) { speech.current.abort(); speech.current = null; setListening(false); return; }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { setNotice("Podés escribir tu intención: la voz no está disponible en este navegador."); return; }
    const recognition = new Recognition(); speech.current = recognition;
    recognition.lang = navigator.language || "es-PY"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = (event: any) => { const text = event.results?.[0]?.[0]?.transcript; if (text) current.current(String(text).slice(0, 500)); };
    recognition.onend = () => { speech.current = null; setListening(false); };
    recognition.onerror = () => setNotice("No pudimos escuchar. Podés escribirlo.");
    try { recognition.start(); setListening(true); setNotice("Escuchando solo esta vez. El reconocimiento usa el servicio de tu navegador; el texto no se publica."); } catch { speech.current = null; setListening(false); setNotice("Podés escribirlo."); }
  };
  return { listening, notice, start };
}
