## Prompt voor uitvoerder

Implementeer server-side validatie en publiceren per format. Zet dit issue **voor de eerste codewijziging** op `status:in-progress` en koppel branch/PR. Hergebruik admin-auth, auditing en de bestaande notificatie-idempotentie.

Een chart heeft titel, markt, duiding en minstens één afgeronde afbeelding nodig. Tekst heeft titel, markt en duiding nodig. Video houdt de bestaande Mux-ready controle. Stel `published_at` server-side vast. Dubbelklikken/retry mag geen dubbele publicatie of notificatie opleveren. Behoud de bestaande access tiers.

## Acceptatie

- Onvolledige concepten mogen bestaan, maar kunnen niet gepubliceerd worden.
- Publicatie is atomair zichtbaar; één publicatie geeft maximaal één notificatie.
- Video-publicatiegedrag en RLS blijven intact.
- Tests dekken alle drie formats, dubbele request en overgang concept→live.

Afhankelijkheden: MU-1, MU-2.
