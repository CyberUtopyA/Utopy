// src/utopy/WalletPanel.tsx
// Controles humanos para recuperación, dispositivos, rotación y réplicas.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  createEncryptedRecovery,
  getWalletStatus,
  restoreEncryptedRecovery,
  revokeDevice,
  rotateDeviceKey,
  rotateRootKey,
  type RecoveryEnvelope,
  type WalletStatus,
} from "./ownership";
import {
  configureReplicaEndpoints,
  flushReplication,
  getReplicationStatus,
  listLocalReplicas,
  type ReplicaStatus,
} from "./replication";

type Props = {
  compact?: boolean;
  onPublish?: (dv: any) => Promise<any> | any;
};

const Shell = styled.div`
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 15px;
  padding: 12px;
  display: grid;
  gap: 11px;
  color: #07110a;
  background: linear-gradient(145deg, #f7fbff, #fff);
`;
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 8px;
`;
const Card = styled.div`
  border: 1px solid rgba(0,0,0,.09);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255,255,255,.88);
  min-width: 0;
`;
const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(0,0,0,.15);
  border-radius: 10px;
  padding: 9px;
  margin-top: 6px;
`;
const Textarea = styled.textarea`
  width: 100%;
  min-height: 70px;
  box-sizing: border-box;
  border: 1px solid rgba(0,0,0,.15);
  border-radius: 10px;
  padding: 9px;
  margin-top: 6px;
  resize: vertical;
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 8px;
`;
const Button = styled.button<{ $danger?: boolean; $primary?: boolean }>`
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 850;
  color: ${({ $danger }) => $danger ? "#991b1b" : "#07110a"};
  background: ${({ $danger, $primary }) => $danger ? "#fff1f2" : $primary ? "#35ef55" : "#fff"};
  opacity: ${({ disabled }) => disabled ? .5 : 1};
`;
const Badge = styled.span<{ $ok?: boolean }>`
  display: inline-flex;
  border-radius: 999px;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 900;
  background: ${({ $ok }) => $ok ? "#dcfce7" : "#fff7d6"};
`;
const Message = styled.div<{ $error?: boolean }>`
  border-radius: 10px;
  padding: 8px;
  font-size: 12px;
  background: ${({ $error }) => $error ? "#fff1f2" : "#ecfdf5"};
  color: ${({ $error }) => $error ? "#991b1b" : "#075c2a"};
`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function WalletPanel({ compact = false, onPublish }: Props) {
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [replica, setReplica] = useState<ReplicaStatus | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [nextPassphrase, setNextPassphrase] = useState("");
  const [deviceName, setDeviceName] = useState("Mi dispositivo");
  const [endpoints, setEndpoints] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [nextWallet, nextReplica] = await Promise.all([getWalletStatus(), getReplicationStatus()]);
    setWallet(nextWallet);
    setReplica(nextReplica);
    setDeviceName((current) => current === "Mi dispositivo" ? nextWallet.deviceName : current);
    setEndpoints(nextReplica.endpoints.join("\n"));
  }, []);

  useEffect(() => {
    void refresh();
    const update = () => void refresh();
    window.addEventListener("utopy.wallet.changed", update);
    window.addEventListener("utopy.replica.status", update);
    return () => {
      window.removeEventListener("utopy.wallet.changed", update);
      window.removeEventListener("utopy.replica.status", update);
    };
  }, [refresh]);

  const act = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await work(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); setPassphrase(""); setNextPassphrase(""); }
  };

  const publish = async (dv: any) => {
    if (onPublish) await onPublish(dv);
  };

  const saveRecovery = () => act(async () => {
    const blob = await createEncryptedRecovery(passphrase, await listLocalReplicas());
    download(blob, `utopy-recuperacion-${Date.now()}.utopy-wallet`);
    setMessage("Respaldo cifrado creado. Guárdalo separado de tu contraseña.");
  });

  const restore = (file: File | null) => act(async () => {
    if (!file) throw new Error("Selecciona un respaldo .utopy-wallet.");
    const envelope = JSON.parse(await file.text()) as RecoveryEnvelope;
    await restoreEncryptedRecovery(envelope, passphrase, deviceName);
    setMessage("Identidad recuperada y este dispositivo fue autorizado con una clave nueva.");
  });

  const activeOtherDevices = useMemo(
    () => wallet?.activeDevices.filter((item) => item.deviceId !== wallet.deviceId) || [],
    [wallet]
  );

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950 }}>🔐 Mi identidad y mis datos</div>
          <div style={{ fontSize: 11, opacity: .67, wordBreak: "break-all" }}>{wallet?.ownerDid || "Preparando billetera…"}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge $ok={wallet?.recoveryReady}>{wallet?.recoveryReady ? "Recuperación activa" : "Falta respaldo"}</Badge>
          <Badge $ok={replica?.independent}>{replica?.independent ? "Réplica independiente" : "Solo copia local"}</Badge>
        </div>
      </div>

      {!compact || !wallet?.recoveryReady ? (
        <Grid>
          <Card>
            <strong>Recuperación cifrada</strong>
            <div style={{ fontSize: 12, opacity: .7 }}>La contraseña nunca se publica ni se guarda.</div>
            <Input type="password" autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Contraseña de 12+ caracteres" />
            <Input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="Nombre de este dispositivo" />
            <Actions><Button $primary disabled={busy || passphrase.length < 12} onClick={saveRecovery}>{wallet?.recoveryReady ? "Descargar respaldo nuevo" : "Activar y descargar"}</Button></Actions>
          </Card>

          <Card>
            <strong>Recuperar o sumar dispositivo</strong>
            <div style={{ fontSize: 12, opacity: .7 }}>Abre el respaldo en el nuevo equipo y usa la misma contraseña.</div>
            <Input type="file" accept=".utopy-wallet,application/json" disabled={busy || passphrase.length < 12} onChange={(event) => void restore(event.target.files?.[0] || null)} />
          </Card>
        </Grid>
      ) : null}

      {wallet?.recoveryReady ? (
        <Grid>
          <Card>
            <strong>Claves y dispositivos</strong>
            <div style={{ fontSize: 12, opacity: .7 }}>{wallet.activeDevices.length} activo(s) · raíz v{wallet.rootSequence}</div>
            <Input type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Contraseña actual" />
            {activeOtherDevices.map((device) => (
              <div key={device.deviceId} style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center", marginTop: 7, fontSize: 12 }}>
                <span>{device.deviceName}</span>
                <Button $danger disabled={busy || passphrase.length < 12} onClick={() => act(async () => {
                  await publish(await revokeDevice(device.deviceId, passphrase));
                  setMessage("Dispositivo revocado y evento firmado publicado.");
                })}>Revocar</Button>
              </div>
            ))}
            <Actions>
              <Button $primary disabled={busy || passphrase.length < 12} onClick={saveRecovery}>Descargar respaldo actual</Button>
              <Button disabled={busy || passphrase.length < 12} onClick={() => act(async () => {
                await publish(await rotateDeviceKey(passphrase, deviceName));
                setMessage("Clave del dispositivo rotada; la anterior quedó revocada.");
              })}>Rotar este dispositivo</Button>
              <Button disabled={busy || passphrase.length < 12} onClick={() => act(async () => {
                const newPassword = nextPassphrase || passphrase;
                await publish(await rotateRootKey(passphrase, newPassword));
                const blob = await createEncryptedRecovery(newPassword, await listLocalReplicas());
                download(blob, `utopy-recuperacion-rotada-${Date.now()}.utopy-wallet`);
                setMessage("Clave maestra rotada sin cambiar tu DID. Usa el respaldo nuevo descargado.");
              })}>Rotar clave maestra</Button>
            </Actions>
            <Input type="password" autoComplete="new-password" value={nextPassphrase} onChange={(event) => setNextPassphrase(event.target.value)} placeholder="Nueva contraseña opcional" />
          </Card>

          <Card>
            <strong>Réplicas independientes</strong>
            <div style={{ fontSize: 12, opacity: .7 }}>Una URL HTTPS por línea. Solo salen DV públicos; usa dos operadores distintos.</div>
            <Textarea value={endpoints} onChange={(event) => setEndpoints(event.target.value)} placeholder={"https://replica-a.ejemplo\nhttps://replica-b.ejemplo"} />
            <Actions>
              <Button $primary disabled={busy} onClick={() => act(async () => {
                const saved = configureReplicaEndpoints(endpoints.split(/\s+/).filter(Boolean));
                await flushReplication();
                setMessage(`${saved.length} destino(s) de réplica configurado(s).`);
              })}>Guardar réplicas</Button>
            </Actions>
            <div style={{ marginTop: 7, fontSize: 11, opacity: .68 }}>{replica?.pending || 0} pendiente(s){replica?.lastError ? ` · ${replica.lastError}` : ""}</div>
          </Card>
        </Grid>
      ) : null}

      {message ? <Message>{message}</Message> : null}
      {error ? <Message $error>{error}</Message> : null}
      <div style={{ fontSize: 11, opacity: .64 }}>La billetera protege identidad y DV. Los fondos continúan bajo las reglas del Cajero/escrow.</div>
    </Shell>
  );
}
