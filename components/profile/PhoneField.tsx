"use client";

export function PhoneField({ country, onCountryChange, phone, onPhoneChange, disabled = false }: {
  country: string; onCountryChange: (value: string) => void; phone: string; onPhoneChange: (value: string) => void; disabled?: boolean;
}) {
  const field = "mt-1.5 w-full rounded-xl border border-[var(--field-border)] bg-[var(--card)] px-3 py-3 text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60";
  return <fieldset className="space-y-2"><legend className="text-sm font-semibold">Telefoonnummer</legend>
    <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1.5fr)] gap-3">
      <label className="text-sm">Land<select name="phone_country" value={country} onChange={event => onCountryChange(event.target.value)} disabled={disabled} className={field}>
        <option value="BE">België</option><option value="NL">Nederland</option><option value="international">Ander land</option>
      </select></label>
      <label className="min-w-0 text-sm">Nummer<input name="phone" type="tel" autoComplete="tel" required maxLength={80} value={phone} onChange={event => onPhoneChange(event.target.value)} disabled={disabled} placeholder={country === "international" ? "+44 …" : country === "NL" ? "06 12345678" : "0470 12 34 56"} aria-describedby="phone-help" className={field}/></label>
    </div><p id="phone-help" className="text-xs leading-5 text-[var(--muted)]">Gebruik voor een ander land het volledige nummer met landcode.</p>
  </fieldset>;
}
