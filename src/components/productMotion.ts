import { useLayoutEffect, useRef } from "react";

type Origin = { rect: DOMRect; element: { deref: () => HTMLElement | undefined }; time: number };
let origin: Origin | null = null;
let checkoutWarmup: Promise<unknown> | null = null;
let locks = 0;
let previousOverflow = "";

/** Ephemeral geometry only: no product data, prices, identity or storage. */
export function inspectWithMotion(element: HTMLElement, action: () => void) {
  const media = element.querySelector<HTMLElement>("img") || element;
  origin = { rect: media.getBoundingClientRect(), element: typeof WeakRef === "function" ? new WeakRef(element) : { deref: () => undefined }, time: performance.now() };
  action();
}

export function prefetchProductCheckout() {
  const connection = (navigator as any).connection;
  if (!navigator.onLine || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
  // Warming code never fetches payment, stock, customer or order data.
  checkoutWarmup ||= import("../pages/checkoutmodal").catch(() => { checkoutWarmup = null; });
}

export function useProductMotionSurface(open: boolean, identity: string, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const surface = ref.current;
    if (!open || !surface) return;
    const focused = document.activeElement as HTMLElement | null;
    const intent = origin;
    origin = null;
    if (locks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    let animation: Animation | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && surface.animate) {
      const destination = surface.getBoundingClientRect();
      const valid = intent && performance.now() - intent.time < 2500 && intent.rect.width > 0 && destination.width > 0;
      const dx = valid ? intent.rect.x + intent.rect.width / 2 - destination.x - destination.width / 2 : 0;
      const dy = valid ? intent.rect.y + intent.rect.height / 2 - destination.y - destination.height / 2 : 12;
      // Bounded movement keeps text legible and avoids a large full-screen zoom.
      const clamp = (n: number) => Math.max(-90, Math.min(90, n));
      animation = surface.animate([
        { opacity: .3, transform: `translate(${clamp(dx)}px,${clamp(dy)}px) scale(.97)` },
        { opacity: 1, transform: "translate(0,0) scale(1)" },
      ], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    const focusable = () => Array.from(surface.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length && !el.closest('[inert]'));
    surface.tabIndex = -1;
    (focusable()[0] || surface).focus({ preventScroll: true });
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0] || surface, last = items[items.length - 1] || surface;
      if (!surface.contains(document.activeElement) || !items.length || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    surface.addEventListener("keydown", keyboard);
    return () => {
      animation?.cancel();
      surface.removeEventListener("keydown", keyboard);
      if (--locks === 0) document.body.style.overflow = previousOverflow;
      const returnTo = intent?.element.deref() || focused;
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [open, identity]);
  return ref;
}
