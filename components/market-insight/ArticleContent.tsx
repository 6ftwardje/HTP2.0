"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function ArticleContent({ html }: { html: string }) {
  const body = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState<{ src: string; alt: string; caption: string } | null>(null);
  // Viewer state must not rewrite the enhanced HTML and remove its focused
  // chart button. Keep the innerHTML prop stable until actual content changes.
  const markup = useMemo(() => ({ __html: html }), [html]);
  useEffect(() => {
    const root = body.current;
    if (!root) return;
    const cleanup: Array<() => void> = [];
    root.querySelectorAll("img").forEach((img) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "article-chart-control";
      button.setAttribute("aria-label", img.alt ? `Vergroot grafiek: ${img.alt}` : "Vergroot grafiek");
      const parent = img.parentNode;
      if (!parent) return;
      parent.insertBefore(button, img); button.appendChild(img);
      const label = document.createElement("span"); label.className = "chart-zoom-label"; label.textContent = "Vergroot grafiek"; button.appendChild(label);
      const open = () => { setImage({ src: img.src, alt: img.alt, caption: img.closest("figure")?.querySelector("figcaption")?.textContent ?? "" }); dialog.current?.showModal(); };
      const fail = () => { button.disabled = true; label.textContent = "Afbeelding niet beschikbaar"; button.classList.add("chart-failed"); };
      button.addEventListener("click", open); img.addEventListener("error", fail);
      if (img.complete && !img.naturalWidth) fail();
      cleanup.push(() => { button.removeEventListener("click", open); img.removeEventListener("error", fail); if (button.parentNode) { button.parentNode.insertBefore(img, button); button.remove(); } });
    });
    return () => cleanup.forEach((clean) => clean());
  }, [html]);
  return <>
    <div ref={body} className="market-article-body" dangerouslySetInnerHTML={markup} />
    <dialog ref={dialog} className="media-dialog chart-dialog" aria-labelledby="chart-dialog-title" onClose={() => setImage(null)}>
      <div className="flex items-center justify-between gap-4">
        <h2 id="chart-dialog-title">{image?.alt || "Grafiek"}</h2>
        <button type="button" className="cb-btn cb-btn-secondary shrink-0" onClick={() => dialog.current?.close()} autoFocus>Sluiten</button>
      </div>
      {image ? <img src={image.src} alt={image.alt} className="chart-full-image" /> : null}
      {image?.caption ? <p className="mt-3 text-sm text-[var(--muted)]">{image.caption}</p> : null}
    </dialog>
  </>;
}
