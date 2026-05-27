export function flyToCart(fromEl: HTMLElement, imgUrl?: string) {
  const targetEl = (window as any).__mtCartTargetEl as HTMLElement | null;
  if (!fromEl || !targetEl) return;

  const from = fromEl.getBoundingClientRect();
  const to = targetEl.getBoundingClientRect();

  // punto inicio: centro del botón que clickeaste
  const x0 = from.left + from.width / 2;
  const y0 = from.top + from.height / 2;
        
  // punto destino: centro del carrito
  const x1 = to.left + to.width / 2;
  const y1 = to.top + to.height / 2;

  // burbuja
  const bubble = document.createElement("div");
  bubble.style.position = "fixed";
  bubble.style.left = `${x0 - 18}px`;
  bubble.style.top = `${y0 - 18}px`;
  bubble.style.width = "36px";
  bubble.style.height = "36px";
  bubble.style.borderRadius = "999px";
  bubble.style.zIndex = "9999";
  bubble.style.pointerEvents = "none";
  bubble.style.boxShadow = "0 14px 34px rgba(0,0,0,0.18)";
  bubble.style.background = "linear-gradient(120deg, rgba(24,255,92,.95), rgba(255,255,255,.9))";
  bubble.style.display = "grid";
  bubble.style.placeItems = "center";
  bubble.style.overflow = "hidden";
  bubble.style.willChange = "transform, opacity";
  bubble.style.transform = "translate3d(0,0,0) scale(1)";
  bubble.style.opacity = "1";

  // mini imagen dentro
  const img = document.createElement("img");
  img.src = imgUrl || "/placeholder.png";
  img.alt = "";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.opacity = "0.9";
  bubble.appendChild(img);

  document.body.appendChild(bubble);

  // curva (control point) para que sea “vuelo” y no línea recta
  const cx = x0 + (x1 - x0) * 0.35;
  const cy = y0 - 120; // sube un poco

  const duration = 520; // ms
  const start = performance.now();

  // pequeño “pulse” al llegar
  const pulseTarget = () => {
    targetEl.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.06)" },
        { transform: "scale(1)" },
      ],
      { duration: 220, easing: "ease-out" }
    );
  };

  const step = (t: number) => {
    const p = Math.min(1, (t - start) / duration);

    // easing suave
    const ease = 1 - Math.pow(1 - p, 3);

    // bezier cuadrática
    const x = (1 - ease) * (1 - ease) * x0 + 2 * (1 - ease) * ease * cx + ease * ease * x1;
    const y = (1 - ease) * (1 - ease) * y0 + 2 * (1 - ease) * ease * cy + ease * ease * y1;

    const scale = p < 0.2 ? 1 + p * 0.6 : 1.12 - (p - 0.2) * 0.15;

    bubble.style.left = `${x - 18}px`;
    bubble.style.top = `${y - 18}px`;
    bubble.style.transform = `translate3d(0,0,0) scale(${scale})`;
    bubble.style.opacity = `${1 - p * 0.35}`;

    if (p < 1) {
      requestAnimationFrame(step);
    } else {
      bubble.remove();
      pulseTarget();
    }
  };

  requestAnimationFrame(step);
}
