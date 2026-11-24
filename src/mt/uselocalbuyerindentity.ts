// src/mt/useLocalBuyerIdentity.ts
import { useEffect, useMemo, useState } from "react";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";

const KEY_NAME = "mt.buyer.name";

export function useLocalBuyerIdentity() {
  const [name, setNameState] = useState<string>("");
  const [id, setIdState] = useState<string>("");

  // init
  useEffect(() => {
    const savedName = (localStorage.getItem(KEY_NAME) || "").trim();
    setNameState(savedName);
    let active = true;
    void resolveCurrentIdentityContext({
      activeActor: savedName ? { displayName: savedName } : null,
      contextKey: "personal",
    }).then((context) => {
      if (active) setIdState(context.actorId);
    });
    return () => {
      active = false;
    };
  }, []);

  const setName = (next: string) => {
    const v = String(next || "").trim();
    localStorage.setItem(KEY_NAME, v);

    setNameState(v);
  };

  const buyerId = useMemo(() => id, [id]);

  return { name, setName, buyerId, ready: Boolean(id) };
}
