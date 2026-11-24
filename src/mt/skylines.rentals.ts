import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import { mtLiveSnapshot } from "./mt.liveStore";
import {KM2_CONTRACT_DEFAULTS} from './skylines.contractPreset';

const MIGRATION_VERSION = "skylines-rentals-v3-private-owner";
const MARKER_KEY = `utopy.migration.${MIGRATION_VERSION}`;
const KM2_MIGRATION_VERSION = "skylines-rentals-v4-km2-monoambiente";
const KM2_MARKER_KEY = `utopy.migration.${KM2_MIGRATION_VERSION}`;
const PROPERTY_ID = "renta-eduardo-falcon-001";
const KM2_PROPERTY_ID = "renta-001";
const PHOTOS = [
  "https://res.cloudinary.com/dis9vjmth/image/upload/v1739996066/479543370_1154573325996568_2432839311647142243_n_gw7hgl.jpg",
  "https://res.cloudinary.com/dis9vjmth/image/upload/v1739996066/475270437_1316404892832630_3454567777079407693_n_d1pyey.jpg",
  "https://res.cloudinary.com/dis9vjmth/image/upload/v1739996066/477020209_2456564464709461_2318158793830985208_n_bszk1c.jpg",
];

function legacyDVs() {
  const meta = { ns: "skylines:rental", scopes: ["public", "market", "falcon.skylines"], migration: MIGRATION_VERSION };
  const ownerId = "82fcaaee-ac3a-4d08-86f8-9ccc950e4f28";
  const owner = { id: ownerId, kind: "skylines.owner.profile", attrs: { ownerId, actorId: ownerId, nombreCompleto: "EDUARDO DERLIS FALCON MORINGO", documento: "1.195.155", domicilio: "Santa Teresa", ciudad: "Salto del Guairá", departamento: "Canindeyú", pais: "Paraguay", documentRepresentation: "Eduardo Derlis Falcon Moringo, C.I. Nº 1.195.155, domiciliado en Santa Teresa, Salto del Guairá, Canindeyú, Paraguay." }, traits: ["identity.owner", "skylines:owner"], meta: { ns: "skylines:private", scopes: ["participants"], migration: MIGRATION_VERSION } };
  const property = { id: PROPERTY_ID, kind: "rental.property", attrs: { propertyId: PROPERTY_ID, name: "Apartamentos Eduardo Falcon", ownerId, operation: "Alquiler", tipo: "alquiler", propertyType: "apartamentos", city: "Salto del Guairá", jurisdiccion: "Salto del Guairá, Canindeyú, Paraguay", description: "Propiedad de alquiler con 5 unidades en Salto del Guairá.", image: PHOTOS[0], photos: PHOTOS, location: [-24.067593291641767, -54.31018622113842], geo: { lat: -24.067593291641767, lng: -54.31018622113842 }, state: "ACTIVE" }, traits: ["rental:property", "skylines:rental", "frequency:discoverable"], meta };
  const prices = [800000, 800000, 1000000, 1000000, 1500];
  const units = prices.map((price, index) => { const unitId = `${PROPERTY_ID}-unidad-${index + 1}`; const currency = index === 4 ? "BRL" : "PYG"; return { id: unitId, kind: "rental.unit", attrs: { propertyId: PROPERTY_ID, unitId, roomId: unitId, number: index + 1, floor: index === 4 ? "segundo piso" : "", price, currency, state: "AVAILABLE", available: true, revision: 1, image: PHOTOS[0], photos: PHOTOS }, traits: ["rental:unit", "skylines:rental"], meta }; });
  const offers = units.map((unit) => ({ id: `rental.offer:${unit.id}`, kind: "rental.offer", attrs: { propertyId: PROPERTY_ID, unitId: unit.id, sellerNodeId: "utopy.node.skylines", operation: "Alquiler", amount: unit.attrs.price, price: unit.attrs.price, currency: unit.attrs.currency, territory: "Salto del Guairá", available: true, capability: "alquilar vivienda", image: PHOTOS[0] }, traits: ["rental:offer", "frequency:offer", "skylines:rental"], meta }));
  return [owner, property, ...units, ...offers];
}

function km2RentalDVs() {
  const meta = { ns: "skylines:rental", scopes: ["public", "market", "falcon.skylines"], migration: KM2_MIGRATION_VERSION };
  const ownerId = "6c44e912-c220-4f51-91dd-b317d639fc58";
  const photos = [
    "/media/skylines/renta-001/monoambiente-1.png",
    "/media/skylines/renta-001/monoambiente-2.png",
    "/media/skylines/renta-001/monoambiente-3.png",
  ];
  const owner = {
    id: ownerId,
    kind: "skylines.owner.profile",
    attrs: {
      ownerId,
      actorId: ownerId,
      nombreCompleto: "Mateo Valentin Falcon Villallba",
      documento: "7.636.446",
      domicilio: "Salto del Guairá",
      ciudad: "Salto del Guairá",
      departamento: "Canindeyú",
      pais: "Paraguay",
      documentRepresentation: "Mateo Valentin Falcon Villallba, C.I./RUC Nº 7.636.446, domiciliado en Salto del Guairá, Paraguay.",
    },
    traits: ["identity.owner", "skylines:owner"],
    meta: { ns: "skylines:private", scopes: ["participants"], migration: KM2_MIGRATION_VERSION },
  };
  const property = {
    id: KM2_PROPERTY_ID,
    kind: "rental.property",
    attrs: {
      propertyId: KM2_PROPERTY_ID,
      name: "Monoambiente amoblado KM 2",
      ownerId,
      operation: "Alquiler",
      tipo: "alquiler",
      propertyType: "monoambientes",
      city: "Salto del Guairá",
      address: "Zona KM 2, Ruta 10 Las Residentas",
      jurisdiccion: "Salto del Guairá, Canindeyú, Paraguay",
      description: "Monoambiente amoblado, cómodo y cerca de todo. Incluye agua, energía eléctrica, recolección de basura e internet Wi‑Fi.",
      servicesIncluded: ["Agua", "Energía eléctrica", "Recolección de basura", "Internet Wi‑Fi"],
      image: photos[0],
      photos,
      location: [-24.084719346081716, -54.33066832504672],
      geo: { lat: -24.084719346081716, lng: -54.33066832504672 },
      state: "ACTIVE",
    },
    traits: ["rental:property", "skylines:rental", "frequency:discoverable"],
    meta,
  };
  const roomNumbers: Array<number | string> = [1, 2, 3, 4, 5, 6, 7, "Salón"];
  const units = roomNumbers.map((number) => {
    const available = number === 6;
    const unitId = `${KM2_PROPERTY_ID}-unidad-${String(number).toLowerCase().replace(/ó/g, "o")}`;
    const salon = number === "Salón";
    return {
      id: unitId,
      kind: "rental.unit",
      attrs: {
        propertyId: KM2_PROPERTY_ID,
        unitId,
        roomId: unitId,
        number,
        floor: "planta baja",
        price: salon ? 1300000 : 900000,
        standardPrice: salon ? 1300000 : 900000,
        contractPrice: salon ? 1300000 : 850000,
        longTermPrice: salon ? null : 850000,
        minimumMonthsForLongTermPrice: salon ? null : 6,
        currency: "PYG",
        state: available ? "AVAILABLE" : "UNAVAILABLE",
        available,
        revision: 1,
        ...([5,6].includes(Number(number))?{contractDefaults:{...KM2_CONTRACT_DEFAULTS},contractTemplate:'km2-owner-model-v1'}:{}),
        furnished: !salon,
        airConditioning: !salon,
        servicesIncluded: property.attrs.servicesIncluded,
        description: salon ? "Salón comercial." : property.attrs.description,
        image: photos[0],
        photos,
      },
      traits: ["rental:unit", "skylines:rental"],
      meta,
    };
  });
  const offers = units.map((unit) => ({
    id: `rental.offer:${unit.id}`,
    kind: "rental.offer",
    attrs: {
      propertyId: KM2_PROPERTY_ID,
      unitId: unit.id,
      sellerNodeId: "utopy.node.skylines",
      operation: "Alquiler",
      amount: unit.attrs.price,
      price: unit.attrs.price,
      contractPrice: unit.attrs.contractPrice,
      minimumMonthsForLongTermPrice: unit.attrs.minimumMonthsForLongTermPrice,
      currency: "PYG",
      territory: "Salto del Guairá",
      available: unit.attrs.available,
      capability: "alquilar vivienda",
      image: photos[0],
    },
    traits: ["rental:offer", "frequency:offer", "skylines:rental"],
    meta,
  }));
  return [owner, property, ...units, ...offers];
}

async function migrateLegacyRentals() {
  const current = mtLiveSnapshot();
  const ready = current.some((dv) => dv?.id === "82fcaaee-ac3a-4d08-86f8-9ccc950e4f28" && dv?.kind === "skylines.owner.profile" && dv?.meta?.migration === MIGRATION_VERSION)
    && current.some((dv) => dv?.id === PROPERTY_ID && dv?.kind === "rental.property" && dv?.meta?.migration === MIGRATION_VERSION);
  if (localStorage.getItem(MARKER_KEY) === "complete" && ready) return;
  let allLive = mtLiveSnapshot();
  for (const dv of legacyDVs()) {
    if (!allLive.some((candidate) => candidate?.id === dv.id && candidate?.meta?.migration === MIGRATION_VERSION)) {
      await publishAuthorizedDV({ dv: dv as any, allLive, action: "rental.legacy.import", sensitivity: dv.kind === "skylines.owner.profile" ? "relationship" : "ephemeral" });
      allLive = mtLiveSnapshot();
    }
  }
  await publishAuthorizedDV({ dv: { id: `rental.migration.marker:${MIGRATION_VERSION}`, kind: "rental.migration.marker", attrs: { version: MIGRATION_VERSION, completedAt: new Date().toISOString(), importedIds: [PROPERTY_ID] }, traits: ["rental:migration"], meta: { ns: "skylines:rental", scopes: ["public"] } }, allLive, action: "rental.legacy.import", sensitivity: "ephemeral" });
  localStorage.setItem(MARKER_KEY, "complete");
}

async function migrateKm2Rental() {
  const current = mtLiveSnapshot();
  const ready = current.some((dv) => dv?.id === KM2_PROPERTY_ID && dv?.kind === "rental.property" && dv?.meta?.migration === KM2_MIGRATION_VERSION)
    && current.some((dv) => dv?.id === `${KM2_PROPERTY_ID}-unidad-6` && dv?.kind === "rental.unit" && dv?.meta?.migration === KM2_MIGRATION_VERSION);
  if (localStorage.getItem(KM2_MARKER_KEY) === "complete" && ready) return;
  let allLive = mtLiveSnapshot();
  for (const dv of km2RentalDVs()) {
    if (!allLive.some((candidate) => candidate?.id === dv.id && candidate?.meta?.migration === KM2_MIGRATION_VERSION)) {
      await publishAuthorizedDV({ dv: dv as any, allLive, action: "rental.legacy.import", sensitivity: dv.kind === "skylines.owner.profile" ? "relationship" : "ephemeral" });
      allLive = mtLiveSnapshot();
    }
  }
  await publishAuthorizedDV({ dv: { id: `rental.migration.marker:${KM2_MIGRATION_VERSION}`, kind: "rental.migration.marker", attrs: { version: KM2_MIGRATION_VERSION, completedAt: new Date().toISOString(), importedIds: [KM2_PROPERTY_ID] }, traits: ["rental:migration"], meta: { ns: "skylines:rental", scopes: ["public"] } }, allLive, action: "rental.legacy.import", sensitivity: "ephemeral" });
  localStorage.setItem(KM2_MARKER_KEY, "complete");
}

async function migrateKm2RoomFive() {
  const migration = "skylines-km2-room5-v1";
  const unitId = `${KM2_PROPERTY_ID}-unidad-5`;
  let allLive = mtLiveSnapshot();
  const existing = allLive.find(dv => dv.id === unitId);
  const existingOffer = allLive.find(dv => dv.id === `rental.offer:${unitId}`);
  if (existing?.meta?.roomFiveMigration === migration && existingOffer?.meta?.roomFiveMigration === migration) return;
  const seed = km2RentalDVs().find(dv => dv.id === unitId)!;
  const attrs = {
    ...(existing?.attrs || seed.attrs),
    name: "Habitación amoblada · Pieza 5",
    number: 5,
    price: 800000,
    standardPrice: 800000,
    contractPrice: 750000,
    longTermPrice: 750000,
    minimumMonthsForLongTermPrice: 6,
    temporaryPrice: 700000,
    temporaryDays: 15,
    currency: "PYG",
    state: "AVAILABLE",
    available: true,
    description: "Habitación amoblada con baño privado, aire acondicionado y Wi-Fi. Incluye agua, electricidad y recolección de basura. Temporal de 15 días: Gs. 700.000; mensual: Gs. 800.000; desde 6 meses: Gs. 750.000 al mes.",
    image: "",
    photos: [],
    revision: Number(existing?.attrs?.revision || 1) + 1,
  };
  const meta = { ...(existing?.meta || seed.meta), roomFiveMigration: migration, updatedAt: new Date().toISOString() };
  await publishAuthorizedDV({ dv: { ...seed, attrs, meta } as any, allLive, action: "rental.legacy.import", sensitivity: "ephemeral" });
  allLive = mtLiveSnapshot();
  const offerSeed = km2RentalDVs().find(dv => dv.id === `rental.offer:${unitId}`)!;
  await publishAuthorizedDV({ dv: { ...offerSeed, attrs: { ...offerSeed.attrs, available: true, amount: 800000, price: 800000, contractPrice: 750000, image: "" }, meta } as any, allLive, action: "rental.legacy.import", sensitivity: "ephemeral" });
}

async function migrateKm2RoomFiveVideo() {
  const migration = "skylines-km2-room5-video-v1";
  const unitId = `${KM2_PROPERTY_ID}-unidad-5`;
  const video = "/media/skylines/renta-001/pieza-5/recorrido.mp4";
  // Update media only. Never reset price, availability, photographs or reservation state.
  for (const id of [unitId, `rental.offer:${unitId}`]) {
    const allLive = mtLiveSnapshot();
    const existing = allLive.find(dv => dv.id === id);
    if (!existing || existing.meta?.roomFiveVideoMigration === migration) continue;
    await publishAuthorizedDV({ dv: { ...existing, attrs: { ...existing.attrs, video }, meta: { ...existing.meta, roomFiveVideoMigration: migration } } as any, allLive, action: "rental.legacy.import", sensitivity: "ephemeral" });
  }
}

async function migrateKm2RoomFivePhoto() {
  const migration = "skylines-km2-room5-photo-v1";
  const unitId = `${KM2_PROPERTY_ID}-unidad-5`;
  const image = "/media/skylines/renta-001/pieza-5/habitacion-5.png";
  for (const id of [unitId, `rental.offer:${unitId}`]) {
    const allLive = mtLiveSnapshot();
    const existing = allLive.find(dv => dv.id === id);
    if (!existing || existing.meta?.roomFivePhotoMigration === migration) continue;
    const photos = [...new Set([image, ...(Array.isArray(existing.attrs?.photos) ? existing.attrs.photos : [])])];
    await publishAuthorizedDV({ dv: { ...existing, attrs: { ...existing.attrs, image, photos }, meta: { ...existing.meta, roomFivePhotoMigration: migration } } as any, allLive, action: "rental.legacy.import", sensitivity: "ephemeral" });
  }
}

let readiness: Promise<void> | null = null;
async function prepareKm2ContractDefaults(){
  for(const number of [5,6]){
    const allLive=mtLiveSnapshot();
    const unit=allLive.find(dv=>dv.kind==='rental.unit'&&dv.id===`${KM2_PROPERTY_ID}-unidad-${number}`);
    if(!unit||unit.attrs?.contractDefaults)continue;
    await publishAuthorizedDV({dv:{...unit,attrs:{...unit.attrs,contractDefaults:{...KM2_CONTRACT_DEFAULTS},contractTemplate:'km2-owner-model-v1'},meta:{...unit.meta,version:Number(unit.meta?.version||0)+1,updatedAt:new Date().toISOString()}},allLive,action:'rental.legacy.import',sensitivity:'ephemeral'});
  }
}
export function ensureSkylinesRentalIdentityReady() {
  if (!readiness) readiness = (async () => {
    await migrateLegacyRentals();
    await migrateKm2Rental();
    await migrateKm2RoomFive();
    await migrateKm2RoomFiveVideo();
    await migrateKm2RoomFivePhoto();
    await prepareKm2ContractDefaults();
  })().catch((error) => { readiness = null; throw error; });
  return readiness;
}

let active = false;
export function startSkylinesRentalProjection(): () => void {
  if (active || typeof window === "undefined") return () => {};
  active = true;
  void ensureSkylinesRentalIdentityReady().catch((error) => console.warn("[Skylines] La migración viva queda pendiente:", error));
  return () => { active = false; };
}
