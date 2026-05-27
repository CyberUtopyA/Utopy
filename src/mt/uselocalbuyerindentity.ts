// src/mt/useLocalBuyerIdentity.ts
import { useEffect, useMemo, useState } from "react";

const KEY_NAME = "mt.buyer.name";
const KEY_ID = "mt.buyer.id";

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function useLocalBuyerIdentity() {
  const [name, setNameState] = useState<string>("");
  const [id, setIdState] = useState<string>("");

  // init
  useEffect(() => {
    const savedName = (localStorage.getItem(KEY_NAME) || "").trim();
    let savedId = (localStorage.getItem(KEY_ID) || "").trim();

    // si no hay id, crearlo UNA sola vez y persistirlo
    if (!savedId) {
      savedId = `buyer:anon:${uid().slice(0, 8)}`;
      localStorage.setItem(KEY_ID, savedId);
    }

    // si hay nombre y el id es anon, opcional: convertir a name:...
    // (esto hace que sea estable cuando el usuario elige nombre)
    if (savedName) {
      const nameId = `name:${savedName.toLowerCase()}`;
      savedId = nameId;
      localStorage.setItem(KEY_ID, savedId);
    }

    setNameState(savedName);
    setIdState(savedId);
  }, []);

  const setName = (next: string) => {
    const v = String(next || "").trim();
    localStorage.setItem(KEY_NAME, v);

    // si pone nombre, fijamos buyerId por nombre (estable)
    if (v) {
      const nameId = `name:${v.toLowerCase()}`;
      localStorage.setItem(KEY_ID, nameId);
      setIdState(nameId);
    }

    setNameState(v);
  };

  const buyerId = useMemo(() => id || "buyer:anon:boot", [id]);

  return { name, setName, buyerId };
}