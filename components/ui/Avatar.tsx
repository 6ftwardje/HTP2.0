"use client";

import { useEffect, useState } from "react";

export function Avatar({ name, objectPath = null, studentId, size = 52 }: { name: string; objectPath?: string | null; studentId?: string; size?: number }) {
  const [path, setPath] = useState(objectPath);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setPath(objectPath); setFailed(false); }, [objectPath, studentId]);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (studentId && detail?.studentId === studentId) { setPath(detail.objectPath); setFailed(false); }
    };
    window.addEventListener("avatar-updated", update);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("profile-avatar") : null;
    if (channel) channel.onmessage = (event) => update(new CustomEvent("avatar-updated", { detail: event.data }));
    return () => { window.removeEventListener("avatar-updated", update); channel?.close(); };
  }, [studentId]);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("nl-BE") || "?";
  return <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
    {path && !failed ? <img src={`/api/avatars/${path}`} alt="" width={size} height={size} onError={() => setFailed(true)} /> : initials}
  </span>;
}
