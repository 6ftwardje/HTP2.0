# HTP 2.0 databaseschema — 24 september 2026

Doelproject: **HTP 2.0**, ref `swohtycdqbydqrtjzwwf`, West EU (Paris). Gecontroleerd via het Supabase-dashboard en de bestaande `.env.local`-projectref.

De migratie `20260924000000_weekly_update_content_formats.sql` is op dit project met `psql -1 -v ON_ERROR_STOP=1` als één transactie uitgevoerd. Uitkomst: drie kolommen en vier constraints toegevoegd. De twee bestaande `weekly_updates`-rijen bleven `content_format = 'video'`. Er is geen contentdata gewijzigd.

Ook `20260924010000_market_update_chart_storage.sql` is transactioneel op hetzelfde project uitgevoerd. De bucket `market-update-charts` is privé, maximaal 10 MB per object. Een oudere brede Storage-SELECT-policy liet level-2-studenten in alle buckets kijken. De nieuwe **restrictive** SELECT-policy sluit alleen deze bucket af voor directe clienttoegang; de serverroute controleert lidmaatschap en publicatiestatus en leest met service role. De bestaande buckets behouden hun gedrag.

De Supabase-migratiehistorie van dit project toonde op dat moment als nieuwste geregistreerde migratie `20260904010000_live_sessions`, terwijl de database wel enkele latere schema-elementen zoals `weekly_updates.type` bevat. Daarom zijn alleen de twee nieuwe, herhaalbare migraties uitgevoerd. **Voer geen volledige `supabase db push` uit voordat de bestaande schema- en historiedrift is onderzocht.** De twee nieuwe migraties staan nog niet als toegepast in `supabase_migrations.schema_migrations`; bij een latere reguliere migratierun kunnen ze veilig opnieuw worden uitgevoerd en dan geregistreerd worden.

Voor release: vergelijk de database met de repo-migraties, herstel de historie gecontroleerd en verifieer daarna de toegangspolicies voor alle formats. Dit onderzoek hoort niet in een featuremigratie die bestaande toegang zou kunnen veranderen.
