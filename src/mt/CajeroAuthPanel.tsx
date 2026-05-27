// src/mt/CajeroAuthPanel.tsx
// Panel admin-only para autorizar actores que pueden confirmar delivery.confirm por rol (carrier/witness/etc)

import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { Shield, PlusCircle, Trash2, Send } from "lucide-react";

import type { MtCajero } from "./mt.cajeroAdapter";
import type { DatoVivo } from "./mt.traitAdapter";
import { publishDatoVivo } from "./seedbus";
import { mtLiveUpsert } from "./mt.liveStore";
import { isAdminOrSupervisor } from "./mt.cajeroroles";

const Wrap = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  padding: 12px;
  background: #fff;
  display: grid;
  gap: 10px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const Title = styled.div`
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-weight: 950;
`;

const Subtle = styled.div`
  opacity: 0.75;
  font-size: 0.88rem;
`;

const Input = styled.input`
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 9px 10px;
  min-width: 0;
`;

const Select = styled.select`
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 9px 10px;
`;

const Btn = styled.button<{ tone?: "solid" | "ghost" }>`
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 9px 10px;
  background: ${({ tone }) => (tone === "solid" ? "#111" : "#fff")};
  color: ${({ tone }) => (tone === "solid" ? "#fff" : "#111")};
  cursor: pointer;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const List = styled.div`
  display: grid;
  gap: 8px;
`;

const GrantCard = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  padding: 10px;
  background: rgba(0,0,0,0.02);
  display: grid;
  gap: 8px;
`;

type Scope = "global" | "org" | "territory" | "product" | "order";

type Grant = {
  actorId: string;
  roles: string[];
  trustHint?: string;
  note?: string;
};

type Props = {
  activeCajero: MtCajero | null;
  // para rellenar org/territorio por defecto si existen
  defaultOrgId?: string;
  defaultTerritorioId?: string;
  ns?: string; // meta.ns
};

const uid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function parseRoles(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function clamp01Str(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(1, n));
}

export default function CajeroAuthPanel({
  activeCajero,
  defaultOrgId,
  defaultTerritorioId,
  ns = "mt:market",
}: Props) {
  const canSee = useMemo(() => isAdminOrSupervisor(activeCajero), [activeCajero]);
  const [scope, setScope] = useState<Scope>("territory");
  const [orgId, setOrgId] = useState(defaultOrgId || "");
  const [territorioId, setTerritorioId] = useState(defaultTerritorioId || "");
  const [productId, setProductId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");

  const [actorId, setActorId] = useState("");
  const [roles, setRoles] = useState("carrier,witness");
  const [trustHint, setTrustHint] = useState("");

  const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!canSee) return null;

  const addGrant = () => {
    const r = parseRoles(roles);
    if (!actorId.trim() || !r.length) {
      setMsg("Completa actorId y roles (coma).");
      return;
    }
    setGrants((g) => [
      ...g,
      { actorId: actorId.trim(), roles: r, trustHint: trustHint.trim() || undefined },
    ]);
    setActorId("");
    setTrustHint("");
    setMsg(null);
  };

  const removeGrant = (i: number) => {
    setGrants((g) => g.filter((_, idx) => idx !== i));
  };

  const buildAttrs = () => {
    const base: any = {
      scope,
      active: true,
      ts: Date.now(),
      by: { id: String(activeCajero?.id || "admin"), nombre: activeCajero?.nombre || "Admin" },
      grants: grants.map((g) => ({
        actorId: g.actorId,
        roles: g.roles,
        trustHint: clamp01Str(g.trustHint || ""),
        note: g.note,
      })),
      note: note.trim() || undefined,
    };

    if (scope === "org") base.orgId = orgId.trim() || undefined;
    if (scope === "territory") base.territorioId = territorioId.trim() || undefined;
    if (scope === "product") base.productId = productId.trim() || undefined;
    if (scope === "order") base.orderId = orderId.trim() || undefined;

    return base;
  };

  const publish = async () => {
    setBusy(true);
    setMsg(null);

    try {
      if (!grants.length) throw new Error("Agrega al menos un grant.");
      if (scope === "org" && !orgId.trim()) throw new Error("scope org requiere orgId.");
      if (scope === "territory" && !territorioId.trim()) throw new Error("scope territory requiere territorioId.");
      if (scope === "product" && !productId.trim()) throw new Error("scope product requiere productId.");
      if (scope === "order" && !orderId.trim()) throw new Error("scope order requiere orderId.");

      const dv: DatoVivo = {
        id: `mt:cajero.auth:${scope}:${uid()}`,
        kind: "mt:cajero.auth",
        traits: ["mt:cajero.auth", "mt:auth"],
        attrs: buildAttrs(),
        meta: { ns, ts: Date.now() },
      };

      // eco local + publicar
      mtLiveUpsert(dv);
      await publishDatoVivo(dv);

      setMsg("Autorización publicada ✅");
      setGrants([]);
      setNote("");
    } catch (e: any) {
      setMsg(e?.message || "No se pudo publicar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <Title>
        <Shield size={18} /> Autorizaciones (admin/supervisor)
      </Title>
      <Subtle>
        Define qué actores pueden emitir <code>delivery.confirm</code> por rol (carrier/witness/etc) sin pasarela centralizada.
      </Subtle>

      <Row>
        <Select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
          <option value="global">Global</option>
          <option value="org">Organización</option>
          <option value="territory">Territorio</option>
          <option value="product">Producto</option>
          <option value="order">Orden</option>
        </Select>

        {scope === "org" && (
          <Input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="orgId (ej: org:mt)" />
        )}
        {scope === "territory" && (
          <Input value={territorioId} onChange={(e) => setTerritorioId(e.target.value)} placeholder="territorioId" />
        )}
        {scope === "product" && (
          <Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="productId" />
        )}
        {scope === "order" && (
          <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="orderId" />
        )}
      </Row>

      <Row>
        <Input
          style={{ flex: 2, minWidth: 220 }}
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          placeholder="actorId (ej: node:deliverybot, mt:cajero:juan, evm:0x...)"
        />
        <Input
          style={{ flex: 2, minWidth: 220 }}
          value={roles}
          onChange={(e) => setRoles(e.target.value)}
          placeholder="roles (coma): carrier,witness"
        />
        <Input
          style={{ width: 120 }}
          value={trustHint}
          onChange={(e) => setTrustHint(e.target.value)}
          placeholder="trust 0..1"
        />
        <Btn onClick={addGrant} disabled={busy}>
          <PlusCircle size={16} /> Agregar
        </Btn>
      </Row>

      {grants.length > 0 && (
        <List>
          {grants.map((g, i) => (
            <GrantCard key={`${g.actorId}-${i}`}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {g.actorId}
                </div>
                <Btn tone="ghost" onClick={() => removeGrant(i)} disabled={busy}>
                  <Trash2 size={16} /> Quitar
                </Btn>
              </div>
              <Subtle>Roles: {g.roles.join(", ")}</Subtle>
              {g.trustHint && <Subtle>trustHint: {g.trustHint}</Subtle>}
            </GrantCard>
          ))}
        </List>
      )}

      <Row>
        <Input
          style={{ flex: 1, minWidth: 240 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota opcional (ej: bot autorizado para delivery)"
        />
        <Btn tone="solid" onClick={publish} disabled={busy || grants.length === 0}>
          <Send size={16} /> Publicar regla
        </Btn>
      </Row>

      {msg && <Subtle>{msg}</Subtle>}
    </Wrap>
  );
}