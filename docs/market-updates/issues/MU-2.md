## Prompt voor uitvoerder

Bouw veilige chartupload en beeldtoegang voor MU-1. Zet dit issue **voor de eerste codewijziging** op `status:in-progress` en koppel branch/PR. Gebruik de bestaande Supabase signed-uploadstijl als vertrekpunt, maar sla charts in een private bucket op.

Admin mag maximaal vier PNG/JPEG/WebP-afbeeldingen van maximaal 10 MB per stuk uploaden. Valideer bestandstype en grootte op client en server, gebruik onvoorspelbare objectnamen en sla alleen objectpaden op. Lever na de bestaande contenttoegangscontrole kortlevende leeslinks of een beveiligde route. Zorg dat mislukte upload geen publiceerbare lege chart oplevert en dat vervanging niet stilletjes oude beelden verwijdert.

## Acceptatie

- Upload, preview en herhaalpoging werken voor toegestane bestanden.
- Ongeldig formaat/grootte wordt geweigerd.
- Een niet-gerechtigde gebruiker kan de afbeelding niet via een directe URL ophalen.
- Er zijn tests voor toegangscontrole en foutpaden.

Afhankelijkheid: MU-1.
