"use client";

import { useState, useTransition } from "react";
import { completeOwnProfile } from "@/app/actions/profile";
import { PhoneField } from "./PhoneField";

export function ProfileCompletionForm({name: initialName, phone: initialPhone, next}: {name: string; phone: string; next: string}) {
  const [name,setName]=useState(initialName),[phone,setPhone]=useState(initialPhone),[country,setCountry]=useState("BE");
  const [error,setError]=useState(""); const [pending,startTransition]=useTransition();
  return <form className="mt-7 space-y-5" onSubmit={event=>{event.preventDefault();if(pending)return;const form=new FormData(event.currentTarget);setError("");startTransition(async()=>{const result=await completeOwnProfile(form);if(result?.error)setError(result.error);});}} aria-busy={pending}>
    <input type="hidden" name="next" value={next}/>
    <label className="block text-sm font-semibold">Naam<input name="name" autoComplete="name" required maxLength={100} value={name} onChange={event=>setName(event.target.value)} disabled={pending} className="mt-1.5 w-full rounded-xl border border-[var(--field-border)] bg-[var(--card)] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"/></label>
    <PhoneField country={country} onCountryChange={setCountry} phone={phone} onPhoneChange={setPhone} disabled={pending}/>
    {error&&<p role="alert" className="text-sm text-[var(--foreground)]">{error}</p>}
    <button type="submit" disabled={pending} className="cb-btn cb-btn-primary w-full">{pending?"Opslaan…":"Opslaan en verder"}</button>
  </form>;
}
