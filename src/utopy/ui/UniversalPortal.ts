// UniversalPortal: capa de manifestación compartida entre nodos
export type Block = { kind: string; [k: string]: any };
export type Renderer = (blocks: Block[]|Block|null) => void;

class UniversalPortal {
  private mounts: Record<string, Renderer> = {};

  register(id: string, renderFn: Renderer) { this.mounts[id] = renderFn; }
  unregister(id: string) { delete this.mounts[id]; }

  mount(blocks: Block[]|Block|null, targetId?: string) {
    const arr = !blocks ? null : (Array.isArray(blocks) ? blocks : [blocks]);
    const id = targetId || "default";
    const fn = this.mounts[id] || this.mounts["default"];
    if (fn) fn(arr);
    else console.warn("[UPortal] No renderer for:", id);
  }

  clear(targetId?: string) {
    const fn = this.mounts[targetId||"default"];
    if (fn) fn(null);
  }

  has(targetId: string) { return !!this.mounts[targetId]; }
  list() { return Object.keys(this.mounts); }
}

export const UPortal = new UniversalPortal();
(globalThis as any).__UPORTAL__ = UPortal; // acceso universal
