## Prompt voor uitvoerder

Onderzoek en herstel de migratiehistorie van het juiste Supabase-project **HTP 2.0** (`swohtycdqbydqrtjzwwf`) vóór een brede databasepush. Zet dit issue **voor de eerste wijziging** op `status:in-progress` en in de boardkolom `In Progress`; koppel branch/PR. Begin met een read-only vergelijking van `supabase_migrations.schema_migrations`, de werkelijke schemaobjecten en de repo-migraties. Maak een klein, expliciet herstelplan per afwijking. Voer geen ontbrekende migraties blind uit en verander geen studentdata of toegangsbeleid zonder gerichte verificatie.

De featuremigratie `20260924000000_weekly_update_content_formats.sql` is al als één transactie op HTP 2.0 toegepast, maar staat nog niet in de migratiehistorie. Zij is herhaalbaar. Zie `docs/market-updates/DEPLOYMENT.md`.

## Acceptatie

- Het actuele schema en de migratiehistorie zijn per versie verklaard.
- Er is een veilige, geteste volgorde voor ontbrekende/handmatig toegepaste migraties.
- De featuremigratie is uiteindelijk als toegepast geregistreerd zonder dubbel effect.
- Bestaande video, toegang en publicatie zijn na het herstel gecontroleerd.

Afhankelijkheid voor een reguliere database-release van MU-1 t/m MU-6.
