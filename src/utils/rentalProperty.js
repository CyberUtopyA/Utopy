export function asRentalMoneyNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\./g, "");
  const numeric = Number(cleaned.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeCurrency(value) {
  return String(value || "PYG").trim().toUpperCase() || "PYG";
}

export function formatRentalMoney(amount, currency = "PYG") {
  const numeric = asRentalMoneyNumber(amount);
  if (numeric == null) return "Consultar precio";
  const code = normalizeCurrency(currency);
  const formatted = numeric.toLocaleString(code === "BRL" ? "pt-BR" : "es-PY", {
    maximumFractionDigits: 2,
  });
  if (code === "PYG") return `Gs. ${formatted}`;
  if (code === "BRL") return `R$ ${formatted}`;
  return `${code} ${formatted}`;
}

export function rentalMonthlyPrice(room, months = 0) {
  const standard = asRentalMoneyNumber(room?.standardPrice ?? room?.price ?? room?.monthly_price ?? room?.precio);
  const longTerm = asRentalMoneyNumber(room?.longTermPrice ?? room?.contractPrice);
  const minimumMonths = Number(room?.minimumMonthsForLongTermPrice || 0);
  if (longTerm != null && minimumMonths > 0 && Number(months) >= minimumMonths) return longTerm;
  return standard;
}

export function normalizeRentalRooms(property) {
  const rooms = Array.isArray(property?.rooms) ? property.rooms : [];
  return rooms.map((room, index) => {
    const price =
      asRentalMoneyNumber(room?.price) ??
      asRentalMoneyNumber(room?.monthly_price) ??
      asRentalMoneyNumber(room?.precio) ??
      asRentalMoneyNumber(property?.price) ??
      asRentalMoneyNumber(property?.precio);
    const currency = normalizeCurrency(
      room?.currency || room?.moneda || property?.currency || property?.moneda,
    );
    const image =
      room?.image || room?.cover || room?.photos?.[0] || property?.image || property?.photos?.[0] || "";
    const number = room?.number ?? index + 1;
    return {
      ...room,
      id: room?.id || `${property?.id || "property"}-room-${number}`,
      number,
      available: room?.available === true,
      price,
      currency,
      image,
      photos:
        Array.isArray(room?.photos) && room.photos.length
          ? room.photos
          : Array.isArray(property?.photos) && property.photos.length
            ? property.photos
            : image
              ? [image]
              : [],
    };
  });
}

export function rentalPriceGroups(rooms, onlyAvailable = true) {
  const grouped = new Map();
  for (const room of Array.isArray(rooms) ? rooms : []) {
    if (onlyAvailable && !room?.available) continue;
    const price = asRentalMoneyNumber(room?.price);
    if (price == null) continue;
    const currency = normalizeCurrency(room?.currency);
    const current = grouped.get(currency);
    if (current == null || price < current) grouped.set(currency, price);
  }
  return Array.from(grouped, ([currency, price]) => ({ currency, price }));
}

export function rentalDisplayPrice(rooms, fallbackPrice, fallbackCurrency = "PYG") {
  const groups = rentalPriceGroups(rooms);
  if (!groups.length) return formatRentalMoney(fallbackPrice, fallbackCurrency);
  return groups
    .map(({ currency, price }, index) =>
      `${index === 0 ? "Desde " : `Unidad en ${currency} desde `}${formatRentalMoney(price, currency)}`,
    )
    .join(" · ");
}

export function normalizeRentalProperty(property) {
  const rooms = normalizeRentalRooms(property);
  const priceGroups = rentalPriceGroups(rooms);
  const availableRooms = rooms.filter((room) => room.available).length;
  return {
    ...property,
    tipo: "alquiler",
    operation: "Alquiler",
    rooms,
    roomCount: rooms.length,
    availableRooms,
    status: availableRooms > 0 ? "available" : "unavailable",
    priceGroups,
    displayPrice: rentalDisplayPrice(
      rooms,
      property?.price ?? property?.precio,
      property?.currency ?? property?.moneda,
    ),
    image:
      property?.image ||
      rooms.find((room) => room.image)?.image ||
      rooms.find((room) => room.photos?.[0])?.photos?.[0] ||
      "",
  };
}

export function rentalMatchesPrice(property, filters = {}) {
  if (!filters.priceMin && !filters.priceMax) return true;
  const rooms = Array.isArray(property?.rooms) ? property.rooms : [];
  const requestedCurrency = normalizeCurrency(filters.currency || property?.currency || "PYG");
  const candidates = rooms.filter(
    (room) => room?.available && normalizeCurrency(room?.currency) === requestedCurrency,
  );
  if (!candidates.length) return false;
  return candidates.some((room) => {
    const price = asRentalMoneyNumber(room?.price);
    if (price == null) return false;
    if (filters.priceMin && price < Number(filters.priceMin)) return false;
    if (filters.priceMax && price > Number(filters.priceMax)) return false;
    return true;
  });
}

export function buildRentalContractDraft({ property = {}, room = {}, owner = {} }) {
  const defaults={...(property.contractDefaults||{}),...(room.contractDefaults||{})};
  const currency = normalizeCurrency(room?.currency || property?.currency);
  const price = asRentalMoneyNumber(room?.contractPrice ?? room?.longTermPrice ?? room?.price ?? property?.price);
  const includedServices = Array.isArray(room?.servicesIncluded)
    ? room.servicesIncluded.join(", ")
    : Array.isArray(property?.servicesIncluded)
      ? property.servicesIncluded.join(", ")
      : "";
  return {
    parteActual: Object.keys(defaults).length ? "arrendatario" : "arrendador",
    arrendador: {
      nombreCompleto: owner?.nombreCompleto || owner?.nombre || "",
      documento: owner?.documento || owner?.cedula || owner?.ruc || "",
      domicilio: [owner?.domicilio, owner?.ciudad, owner?.departamento, owner?.pais].filter(Boolean).join(", "),
      telefono: owner?.telefono || "",
      email: owner?.email || "",
    },
    arrendatario: { nombreCompleto: "", documento: "", domicilio: "", telefono: "", email: "" },
    inmueble: {
      propertyId: String(property?.id || property?.propertyId || ""),
      roomId: String(room?.id || room?.number || ""),
      nombre: property?.name || property?.title || "",
      direccion: property?.address || property?.direccion || (Array.isArray(property?.location) ? `${property.location[0]}, ${property.location[1]}` : ""),
      ciudad: property?.city || property?.ciudad || "",
      tipo: property?.propertyType || property?.type || "apartamento",
      numeroUnidad: String(room?.number ?? ""),
      piso: room?.floor || room?.piso || "",
      descripcion: room?.description || property?.description || "",
    },
    contrato: {
      canon: price == null ? "" : String(price),
      moneda: currency,
      deposito: "",
      diaVencimiento: "",
      plazoMeses: "",
      inicio: "",
      incluyeServicios: includedServices,
      politicaMascotas: "",
      lecturaMedidores: "",
      inventario: "",
      clausulasAdicionales: "",
      regimenMora: "",
      condicionesGarantia: "",
      preaviso: "",
      jurisdiccion: property?.jurisdiccion || [property?.city || property?.ciudad, property?.departamento, property?.pais].filter(Boolean).join(", ") || "Salto del Guairá, Canindeyú, Paraguay",
      obligacionesLocador: "",
      obligacionesLocatario: "",
      ...defaults,
    },
  };
}
