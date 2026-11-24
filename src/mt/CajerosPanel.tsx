import React, { useMemo, useState } from "react";
import styled from "styled-components";
import {
  User,
  UserCheck,
  UserCircle2,
  KeyRound,
  Building2,
  MapPin,
  Search,
  Store,
  Shield,
  Wifi,
  WifiOff,
  Radar,
  CreditCard,
  Bot,
  Clock3,
} from "lucide-react";
import type { MtCajero } from "./mt.cajeroAdapter";
import CajeroChargesPanel from "./CajeroChargepanel";
import UtopyPayCenter from "./utopypaycenter";

type Props = {
  cajeros: MtCajero[];
  currentCajeroId?: string | null;
  /** Identidad del comercio/nodo que recibe. Nunca es la clave privada ni el cajero. */
  nodeId?: string | null;
  nodeName?: string | null;
  onSelect: (cajero: MtCajero | null) => void;
};

const Wrapper = styled.div`
  display: grid;
  gap: 12px;
`;

const Card = styled.div`
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 18px;
  background: #fff;
  padding: 12px;
`;

const Header = styled.div`
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  flex-wrap: wrap;
`;

const TitleWrap = styled.div`
  display:grid;
  gap:4px;
`;

const Title = styled.div`
  font-weight: 900;
  font-size: 1rem;
  display:inline-flex;
  align-items:center;
  gap:8px;
`;

const Badge = styled.span`
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
`;

const Summary = styled.div`
  font-size: 0.88rem;
  opacity: 0.82;
  line-height: 1.4;
`;

const Toolbar = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr 220px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const SearchBox = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.10);
  background: #fff;
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  font-size: 0.92rem;
  width: 100%;
  background: transparent;
`;

const SelectNs = styled.select`
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.10);
  background: #fff;
  font-size: 0.9rem;
`;

const List = styled.div`
  display:grid;
  gap:8px;
  max-height: 420px;
  overflow: auto;
`;

const Item = styled.button<{ active?: boolean }>`
  width: 100%;
  text-align: left;
  padding: 10px;
  display: grid;
  gap: 8px;
  border: 1px solid ${({ active }) => active ? "rgba(34,197,94,0.22)" : "rgba(0,0,0,0.06)"};
  border-radius: 14px;
  background: ${({ active }) => active ? "rgba(34,197,94,0.08)" : "#fff"};
  cursor: pointer;

  &:hover {
    background: ${({ active }) => active ? "rgba(34,197,94,0.10)" : "rgba(0,0,0,0.025)"};
  }
`;

const ItemTop = styled.div`
  display:flex;
  align-items:center;
  gap:10px;
`;

const Avatar = styled.div<{ active?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ active }) => (active ? "#16a34a" : "#e5e7eb")};
  color: ${({ active }) => (active ? "#fff" : "#111")};
  flex: 0 0 auto;
`;

const ColMain = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const Name = styled.div`
  font-size: 0.93rem;
  font-weight: 800;
`;

const MetaLine = styled.div`
  font-size: 0.8rem;
  opacity: 0.85;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Tag = styled.span<{ tone?: "green" | "blue" | "amber" | "gray" }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 0.74rem;
  background:
    ${({ tone }) =>
      tone === "green"
        ? "rgba(34,197,94,0.12)"
        : tone === "blue"
        ? "rgba(59,130,246,0.10)"
        : tone === "amber"
        ? "rgba(245,158,11,0.12)"
        : "rgba(0, 0, 0, 0.04)"};
`;

const Right = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 0.75rem;
`;

const ClearBtn = styled.button`
  border: none;
  background: transparent;
  font-size: 0.84rem;
  color: #2563eb;
  cursor: pointer;
  padding: 0;
`;

const Empty = styled.div`
  padding: 12px;
  border: 1px dashed rgba(0,0,0,0.10);
  border-radius: 14px;
  font-size: 0.88rem;
  color: rgba(0,0,0,0.66);
  background: rgba(0,0,0,0.02);
`;

const Tiny = styled.div`
  font-size: 0.76rem;
  opacity: 0.72;
`;

function compactList(xs?: string[] | null, max = 3) {
  const arr = Array.isArray(xs) ? xs.filter(Boolean) : [];
  if (!arr.length) return "—";
  const shown = arr.slice(0, max).join(", ");
  return arr.length > max ? `${shown} +${arr.length - max}` : shown;
}

function formatLastSeen(ts?: string) {
  if (!ts) return "sin señal";
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return "sin señal";

  const delta = Date.now() - t;
  if (delta < 60_000) return "ahora";
  if (delta < 3_600_000) return `hace ${Math.max(1, Math.floor(delta / 60_000))} min`;
  if (delta < 86_400_000) return `hace ${Math.max(1, Math.floor(delta / 3_600_000))} h`;
  return `hace ${Math.max(1, Math.floor(delta / 86_400_000))} d`;
}

export default function CajerosPanel({
  cajeros,
  currentCajeroId,
  nodeId,
  nodeName,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");
  const [nsFilter, setNsFilter] = useState<string>("__ALL__");

  const namespaces = useMemo(
    () =>
      Array.from(
        new Set(
          cajeros
            .map((c) => c.meta?.ns)
            .filter(Boolean) as string[]
        )
      ),
    [cajeros]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cajeros.filter((c) => {
      if (nsFilter !== "__ALL__" && c.meta?.ns !== nsFilter) return false;
      if (!q) return true;

      const txt = [
        c.nombre,
        c.doc,
        c.telefono,
        c.orgId,
        c.territorioId,
        c.meta?.ns,
        ...(c.payment?.accepted || []),
        ...(c.presence?.entryMethods || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return txt.includes(q);
    });
  }, [cajeros, search, nsFilter]);

  const current = useMemo(
    () => cajeros.find((c) => c.id === currentCajeroId) || null,
    [cajeros, currentCajeroId]
  );

  const commerceId = useMemo(() => {
    const anyCurrent = current as any;
    return String(
      nodeId ||
        anyCurrent?.orgId ||
        anyCurrent?.meta?.originNode ||
        anyCurrent?.meta?.nodeId ||
        anyCurrent?.meta?.authority ||
        ""
    ).trim();
  }, [current, nodeId]);

  const commerceName = useMemo(() => {
    const anyCurrent = current as any;
    return String(
      nodeName ||
        anyCurrent?.orgName ||
        anyCurrent?.meta?.storeName ||
        anyCurrent?.meta?.nodeName ||
        commerceId ||
        "Nodo"
    ).trim();
  }, [current, nodeName, commerceId]);

  const onlineCount = useMemo(
    () => cajeros.filter((c) => c.presence?.online).length,
    [cajeros]
  );

  const negotiatorCount = useMemo(
    () => cajeros.filter((c) => c.payment?.negotiator).length,
    [cajeros]
  );

  return (
    <Wrapper>
      <Card>
        <Header>
          <TitleWrap>
            <Title>
              <Store size={16} />
              Caja viva del nodo
            </Title>
            <Summary>
              {current ? (
                <>
                  En turno: <b>{current.nombre}</b>{" "}
                  <span style={{ opacity: 0.8 }}>({current.nivel})</span>{" "}
                  <ClearBtn onClick={() => onSelect(null)}>Cerrar turno</ClearBtn>
                </>
              ) : (
                <>Seleccioná quién atiende. Los métodos de pago pertenecen al comercio.</>
              )}
            </Summary>
          </TitleWrap>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge>{cajeros.length} en este nodo</Badge>
            <Badge>{onlineCount} online</Badge>
            <Badge>{negotiatorCount} negociador</Badge>
          </div>
        </Header>

        <div style={{ height: 10 }} />

        <Toolbar>
          <SearchBox>
            <Search size={15} />
            <SearchInput
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, doc, teléfono, QR, NFC, card…"
            />
          </SearchBox>

          <SelectNs
            value={nsFilter}
            onChange={(e: any) => setNsFilter(e.target.value)}
          >
            <option value="__ALL__">Todos los espacios</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </SelectNs>
        </Toolbar>

        <div style={{ height: 10 }} />

        <List>
          {filtered.length === 0 ? (
            <Empty>No hay cajeros para este filtro.</Empty>
          ) : (
            filtered.map((c) => {
              const active = c.id === currentCajeroId;
              const online = !!c.presence?.online;
              const near = !!c.presence?.near;

              return (
                <Item
                  key={c.id}
                  active={active}
                  onClick={() => onSelect(active ? null : c)}
                >
                  <ItemTop>
                    <Avatar active={active}>
                      {active ? <UserCheck size={18} /> : <UserCircle2 size={18} />}
                    </Avatar>

                    <ColMain>
                      <Name>{c.nombre}</Name>

                      <MetaLine>
                        <Tag>
                          <User size={12} />
                          {c.nivel}
                        </Tag>

                        {c.orgId && (
                          <Tag>
                            <Building2 size={12} />
                            {c.orgId}
                          </Tag>
                        )}

                        {c.territorioId && (
                          <Tag>
                            <MapPin size={12} />
                            {c.territorioId}
                          </Tag>
                        )}

                        <Tag tone={online ? "green" : "gray"}>
                          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
                          {online ? "online" : "offline"}
                        </Tag>

                        {near && (
                          <Tag tone="blue">
                            <Radar size={12} />
                            cerca
                          </Tag>
                        )}

                        {c.payment?.negotiator && (
                          <Tag tone="amber">
                            <Bot size={12} />
                            negociador
                          </Tag>
                        )}
                      </MetaLine>
                    </ColMain>

                    <Right>
                      {c.meta?.ns && <span>{c.meta.ns}</span>}
                      {c.meta?.hasPin && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <KeyRound size={12} /> PIN
                        </span>
                      )}
                      <Tiny>{formatLastSeen(c.presence?.lastSeenTs)}</Tiny>
                    </Right>
                  </ItemTop>

                  {(c.doc || c.telefono) && (
                    <MetaLine>
                      {c.doc && <Tag>CI: {c.doc}</Tag>}
                      {c.telefono && <Tag>📞 {c.telefono}</Tag>}
                      {c.presence?.deviceId && <Tag>dev: {c.presence.deviceId}</Tag>}
                      {c.presence?.stage && <Tag>stage: {c.presence.stage}</Tag>}
                    </MetaLine>
                  )}

                  <MetaLine>
                    <Tag tone="blue">
                      <CreditCard size={12} />
                      {compactList(c.payment?.accepted)}
                    </Tag>

                    {c.payment?.creditEnabled && (
                      <Tag tone="amber">crédito</Tag>
                    )}

                    {!!c.payment?.currencies?.length && (
                      <Tag>monedas: {compactList(c.payment.currencies)}</Tag>
                    )}

                    {!!c.presence?.entryMethods?.length && (
                      <Tag>entry: {compactList(c.presence.entryMethods)}</Tag>
                    )}
                  </MetaLine>

                  <MetaLine>
                    {c.runtime?.autoCharge && (
                      <Tag tone="green">
                        <Clock3 size={12} />
                        auto charge
                      </Tag>
                    )}
                    {c.runtime?.autoPropose && (
                      <Tag tone="blue">
                        <Bot size={12} />
                        auto propose
                      </Tag>
                    )}
                    {c.runtime?.autoAcceptProof && (
                      <Tag tone="amber">auto accept proof</Tag>
                    )}
                  </MetaLine>
                </Item>
              );
            })
          )}
        </List>
      </Card>

      {current?.id && commerceId && (
        <>
          <Card>
            <Header>
              <TitleWrap>
                <Title>
                  <Shield size={16} />
                  Débito automático y cobros
                </Title>
                <Summary>Herramientas del cajero en turno.</Summary>
              </TitleWrap>
            </Header>

            <div style={{ height: 8 }} />

            <CajeroChargesPanel
              sellerId={commerceId}
              sellerName={commerceName}
              ns={current.meta?.ns || "mt:market"}
            />
          </Card>

          <Card style={{ padding: 0, overflow: "hidden" as any }}>
            <UtopyPayCenter
              sellerId={commerceId}
              sellerName={commerceName}
              ns={current.meta?.ns || "mt:market"}
              onlyOpen
              embedded
            />
          </Card>
        </>
      )}
    </Wrapper>
  );
}