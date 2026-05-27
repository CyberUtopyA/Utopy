import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import OneSignal from "react-onesignal";
import Portal from "../pages/ui/portal";
import { Bell, BellOff, Check, X } from "lucide-react";

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10040;
  padding: 12px;
`;

const ModalBox = styled.div`
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
`;

const TitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const IconBubble = styled.div<{ enabled?: boolean }>`
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ enabled }) =>
    enabled ? "rgba(34,197,94,0.14)" : "rgba(0,0,0,0.06)"};
  color: #111;
`;

const Title = styled.div`
  font-weight: 950;
  font-size: 0.98rem;
  line-height: 1.1;
`;

const Subtle = styled.div`
  opacity: 0.7;
  font-size: 0.85rem;
  line-height: 1.2;
`;

const CloseBtn = styled.button`
  border: none;
  background: transparent;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
`;

const Body = styled.div`
  padding: 16px;
  display: grid;
  gap: 14px;
`;

const ToggleCard = styled.button<{ enabled?: boolean }>`
  border: 1px solid
    ${({ enabled }) =>
      enabled ? "rgba(34,197,94,0.35)" : "rgba(0,0,0,0.10)"};
  background: ${({ enabled }) =>
    enabled ? "rgba(34,197,94,0.08)" : "#fff"};
  border-radius: 16px;
  padding: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  text-align: left;
`;

const ToggleLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ToggleIcon = styled.div<{ enabled?: boolean }>`
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ enabled }) =>
    enabled ? "rgba(34,197,94,0.14)" : "rgba(0,0,0,0.06)"};
`;

const ToggleTitle = styled.div`
  font-weight: 900;
  font-size: 0.95rem;
`;

const ToggleDesc = styled.div`
  opacity: 0.72;
  font-size: 0.84rem;
  margin-top: 2px;
`;

const CheckBubble = styled.div<{ enabled?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ enabled }) =>
    enabled ? "rgba(34,197,94,0.18)" : "rgba(0,0,0,0.06)"};
`;

const Field = styled.div`
  display: grid;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 0.84rem;
  font-weight: 900;
`;

const Select = styled.select`
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 14px;
  padding: 12px 14px;
  background: #fff;
  color: #111;
  font-size: 0.92rem;

  &:focus {
    outline: none;
    border-color: rgba(34, 197, 94, 0.55);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.16);
  }
`;

const Footer = styled.div`
  padding: 0 16px 16px;
  display: flex;
  justify-content: flex-end;
`;

const DoneBtn = styled.button`
  border: 1px solid rgba(34, 197, 94, 0.45);
  background: #15ff00ff;
  color: #111;
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 950;
  cursor: pointer;
`;

type Props = {
  open: boolean;
  namespaces: string[];
  onClose: () => void;
  onStateChange?: (state: { enabled: boolean; selectedNs: string }) => void;
};

let oneSignalStarted = false;

async function initOneSignal() {
  if (oneSignalStarted) return;
  oneSignalStarted = true;

  await OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
    allowLocalhostAsSecureOrigin: true,
    serviceWorkerPath: "/OneSignalSDKWorker.js",
    serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
  });
}

function clean(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[:.\-/\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");
}

function nsTag(ns: string) {
  return `ns_${clean(ns)}`;
}

async function clearNamespaceTags(namespaces: string[]) {
  await initOneSignal();
  const keys = ["ns_all", ...namespaces.map(nsTag)];
  await OneSignal.User.removeTags(keys);
}

async function setNamespaceTag(ns: string) {
  await initOneSignal();

  if (ns === "__ALL__") {
    await OneSignal.User.addTags({ ns_all: "1" });
    return;
  }

  await OneSignal.User.removeTags(["ns_all"]);
  await OneSignal.User.addTags({ [nsTag(ns)]: "1" });
}

async function requestPushPermission(): Promise<boolean> {
  await initOneSignal();

  try {
    const perm = await OneSignal.Notifications.permission;
    if (perm === true) return true;

    const accepted = await OneSignal.Notifications.requestPermission();
    return !!accepted;
  } catch (err) {
    console.error("[OneSignal] request permission error", err);
    return false;
  }
}

async function isPushEnabled(): Promise<boolean> {
  await initOneSignal();

  try {
    return !!(await OneSignal.Notifications.permission);
  } catch (err) {
    console.error("[OneSignal] isPushEnabled error", err);
    return false;
  }
}

export default function NotificationSelectorModal({
  open,
  namespaces,
  onClose,
  onStateChange,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [selectedNs, setSelectedNs] = useState("__ALL__");

  const stableNamespaces = useMemo(() => namespaces || [], [namespaces]);

  useEffect(() => {
    initOneSignal()
      .then(async () => {
        const ok = await isPushEnabled();
        setEnabled(ok);
        onStateChange?.({ enabled: ok, selectedNs });
      })
      .catch((err) => {
        console.error("[OneSignal] init error", err);
      });
  }, []);

  useEffect(() => {
    onStateChange?.({ enabled, selectedNs });
  }, [enabled, selectedNs, onStateChange]);

  async function handleToggleEnabled() {
    if (!enabled) {
      const ok = await requestPushPermission();
      if (!ok) return;

      await clearNamespaceTags(stableNamespaces);
      await setNamespaceTag(selectedNs);
      setEnabled(true);
      return;
    }

    await clearNamespaceTags(stableNamespaces);
    setEnabled(false);
  }

  async function handleChangeNs(ns: string) {
    setSelectedNs(ns);

    if (!enabled) return;

    await clearNamespaceTags(stableNamespaces);
    await setNamespaceTag(ns);
  }

  if (!open) return null;

  return (
    <Portal>
      <Backdrop onClick={onClose}>
        <ModalBox onClick={(e) => e.stopPropagation()}>
          <Header>
            <TitleWrap>
              <IconBubble enabled={enabled}>
                {enabled ? <Bell size={18} /> : <BellOff size={18} />}
              </IconBubble>
              <div>
                <Title>Notificaciones</Title>
                <Subtle>
                  Configurá alertas de ofertas vivas por namespace
                </Subtle>
              </div>
            </TitleWrap>

            <CloseBtn onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </CloseBtn>
          </Header>

          <Body>
            <ToggleCard enabled={enabled} onClick={handleToggleEnabled}>
              <ToggleLeft>
                <ToggleIcon enabled={enabled}>
                  {enabled ? <Bell size={20} /> : <BellOff size={20} />}
                </ToggleIcon>
                <div>
                  <ToggleTitle>
                    {enabled
                      ? "Notificaciones activadas"
                      : "Notificaciones desactivadas"}
                  </ToggleTitle>
                  <ToggleDesc>
                    {enabled
                      ? "Recibirás alertas nuevas en el navegador."
                      : "Tocá aquí para activar las alertas."}
                  </ToggleDesc>
                </div>
              </ToggleLeft>

              <CheckBubble enabled={enabled}>
                {enabled ? <Check size={16} /> : null}
              </CheckBubble>
            </ToggleCard>

            <Field>
              <Label>Namespace a notificar</Label>
              <Select
                value={selectedNs}
                onChange={(e) => handleChangeNs(e.target.value)}
              >
                <option value="__ALL__">Todos</option>
                {stableNamespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </Select>

              <Subtle>
                Elegí si querés escuchar ofertas de toda la red o solo de un
                mundo.
              </Subtle>
            </Field>
          </Body>

          <Footer>
            <DoneBtn onClick={onClose}>Listo</DoneBtn>
          </Footer>
        </ModalBox>
      </Backdrop>
    </Portal>
  );
}