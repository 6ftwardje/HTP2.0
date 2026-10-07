"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";

export function AvatarEditor({ name, studentId, objectPath }: { name: string; studentId: string; objectPath: string | null }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(objectPath);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setCurrent(objectPath); }, [objectPath]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const close = () => { dialog.current?.close(); setFile(null); setUrl(null); setArea(null); };
  const changed = (path: string | null) => {
    setCurrent(path);
    const detail = { studentId, objectPath: path };
    window.dispatchEvent(new CustomEvent("avatar-updated", { detail }));
    // Cross-tab updates are optional; a browser restriction must not turn a
    // successful Supabase commit into an apparent save failure.
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel("profile-avatar");
        try { channel.postMessage(detail); } finally { channel.close(); }
      } catch { /* The current tab already received avatar-updated. */ }
    }
    router.refresh();
  };
  async function select(photo: File | undefined) {
    if (!photo) return;
    setError(""); setMessage("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) { setError("Kies een JPEG, PNG of WebP van maximaal 5 MB."); return; }
    const source = URL.createObjectURL(photo);
    try {
      const image = new Image(); image.src = source; await image.decode();
      if (image.naturalWidth > 10_000 || image.naturalHeight > 10_000 || image.naturalWidth * image.naturalHeight > 25_000_000) throw new Error();
      setFile(photo); setUrl(source); setCrop({ x: 0, y: 0 }); setZoom(1); setArea(null);
      dialog.current?.showModal();
    } catch { URL.revokeObjectURL(source); setError("Deze afbeelding kan niet worden geopend. Kies een andere foto."); }
  }
  async function save() {
    if (!file || !area || busy) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("photo", file); form.set("crop", JSON.stringify(area));
      const response = await fetch("/api/account/avatar", { method: "POST", body: form });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      changed(result.objectPath); close(); setMessage("Je profielfoto is opgeslagen.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Opslaan mislukt. Probeer opnieuw."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account/avatar", { method: "DELETE" });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      changed(null); setMessage("Je profielfoto is verwijderd.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Verwijderen mislukt. Probeer opnieuw."); }
    finally { setBusy(false); }
  }
  return <div className="avatar-editor">
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} studentId={studentId} objectPath={current} size={80} />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cb-btn cb-btn-secondary" disabled={busy} onClick={() => { if (input.current) input.current.value = ""; input.current?.click(); }}>{current ? "Foto wijzigen" : "Foto uploaden"}</button>
          {current ? <button type="button" className="cb-btn cb-btn-secondary" disabled={busy} onClick={remove}>Foto verwijderen</button> : null}
        </div>
        <p className="text-sm text-[var(--muted)]">JPEG, PNG of WebP · maximaal 5 MB</p>
      </div>
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Profielfoto kiezen" onChange={(event) => void select(event.target.files?.[0])} />
    {!url && error ? <p role="alert" className="mt-3 text-sm text-[var(--foreground)]">{error}</p> : null}
    <p role="status" aria-live="polite" className="mt-3 text-sm text-[var(--muted)]">{busy && !url ? "Foto verwijderen…" : message}</p>
    <dialog ref={dialog} className="media-dialog avatar-dialog" aria-labelledby="avatar-crop-title" onCancel={(event) => { if (busy) event.preventDefault(); else close(); }} onClose={() => { if (!busy) { setUrl(null); setFile(null); } }}>
      <h2 id="avatar-crop-title">Profielfoto bijsnijden</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Verschuif je foto of gebruik de pijltjestoetsen. De vierkante uitsnede is je nieuwe foto.</p>
      <div className="avatar-crop-preview">
        {url ? <Cropper image={url} crop={crop} zoom={zoom} aspect={1} cropShape="rect" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} /> : null}
      </div>
      <label className="mt-4 flex items-center gap-4 text-sm">Zoom <input aria-label="Zoom" type="range" min={1} max={3} step={0.05} value={zoom} disabled={busy} onChange={(event) => setZoom(Number(event.target.value))} className="min-h-11 flex-1 accent-[var(--accent)]" /></label>
      {error ? <p role="alert" className="mt-2 text-sm">{error}</p> : null}
      <p role="status" aria-live="polite" className="text-sm text-[var(--muted)]">{busy ? "Foto valideren en opslaan…" : ""}</p>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className="cb-btn cb-btn-secondary" disabled={busy} onClick={close}>Annuleren</button>
        <button type="button" className="cb-btn cb-btn-primary" disabled={busy || !area} onClick={save}>{busy ? "Opslaan…" : "Foto opslaan"}</button>
      </div>
    </dialog>
  </div>;
}
