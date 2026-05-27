// src/mt/mt.cajeroRoles.ts
import type { MtCajero } from "./mt.cajeroAdapter";

export function isAdminOrSupervisor(c: MtCajero | null | undefined): boolean {
  const n = String(c?.nivel || "").toLowerCase();
  return n === "admin" || n === "supervisor";
}