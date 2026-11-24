function text(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

export function humanVisibleText(value: unknown, fallback = "Perfil Vivo") {
  const raw = text(value);
  if (!raw || /^(?:utopy\.node\.|did:|mt:|manifest(?:[.:/\s-]|$)|namespace\b|executor\b|sourceRef\b|threadId\b|[a-z]+(?:[._:][a-z0-9]+){2,})/i.test(raw)) return fallback;
  return raw.replace(/\b(?:utopy\.node\.[\w.-]+|did:[\w:.-]+|mt:[\w:.-]+|manifest(?:-live\.php)?|(?:threadId|sourceRef|namespace|executor)\s*[:=]\s*\S+)\b/gi, "").trim() || fallback;
}

function titleFrom(dv: any) {
  return humanVisibleText(
    dv?.labels?.[0] ||
      dv?.attrs?.title ||
      dv?.attrs?.text ||
      dv?.attrs?.name ||
      dv?.attrs?.nombre ||
      dv?.attrs?.materialName ||
      dv?.kind ||
      "Señal Viva",
  );
}

function authorFrom(dv: any) {
  return humanVisibleText(
    dv?.attrs?.actorName ||
      dv?.attrs?.node?.name ||
      dv?.attrs?.sellerName ||
      dv?.attrs?.storeName ||
      dv?.attrs?.productor?.nombre ||
      "Nodo Vivo",
  );
}

export function humanizeLiveDV(dv: any) {
  const kind = text(dv?.kind).toLowerCase();
  const mode = text(dv?.attrs?.intent?.mode).toLowerCase();
  const available =
    dv?.attrs?.availability?.availableNow === true ||
    dv?.traits?.includes?.("presence:available");
  let type = "Actividad";
  let icon = "✦";
  let action = "Ver";

  if (kind === "composition.publish" && dv?.attrs?.protocol === "utopy.living-composition/1") {
    type = "Composición viva";
    icon = "✦";
    action = "Me interesa";
  } else if (kind === "node.profile") {
    type = available ? "Disponible ahora" : "Perfil Vivo";
    icon = "◉";
    action = "Ver perfil";
  } else if (kind === "booking.request") {
    type = "Turno solicitado";
    icon = "◷";
    action = "Responder";
  } else if (kind === "booking.status") {
    type =
      dv?.attrs?.status === "accepted"
        ? "Turno confirmado"
        : "Turno actualizado";
    icon = "✓";
    action = "Ver turno";
  } else if (
    mode === "need" ||
    kind.includes("demand") ||
    kind === "work.intent"
  ) {
    type = "Necesita";
    icon = "◎";
    action = "Puedo ayudar";
  } else if (
    kind === "capability.offer" ||
    mode === "offer" ||
    available
  ) {
    type = available ? "Disponible ahora" : "Puede ayudar";
    icon = available ? "●" : "✦";
    action = "Contactar";
  } else if (
    kind.includes("producto") ||
    kind.includes("product") ||
    kind === "mt:offer"
  ) {
    type = "Vende";
    icon = "▣";
    action = "Ver oferta";
  } else if (kind.includes("delivery")) {
    type = "Entrega";
    icon = "➜";
    action = "Seguir";
  } else if (kind === "match.proposal") {
    type = "Resonancia";
    icon = "⌁";
    action = "Ver conexión";
  } else if (kind.startsWith("value.")) {
    type = "Aporte";
    icon = "◇";
    action = "Ver aporte";
  }

  const price = Number(dv?.attrs?.price ?? dv?.attrs?.precio);
  const currency = text(dv?.attrs?.currency || "PYG");

  return {
    id: text(dv?.id),
    title: kind === "composition.publish" ? humanVisibleText(dv?.attrs?.intent?.summary, "Composición viva") : titleFrom(dv),
    author: authorFrom(dv),
    type,
    icon,
    action,
    image: text(dv?.attrs?.image || dv?.attrs?.imagen) || null,
    price: Number.isFinite(price) && price > 0 ? price : null,
    currency,
    threadId: text(dv?.attrs?.threadId || dv?.meta?.threadId) || null,
    status: text(dv?.attrs?.status || "open"),
  };
}
