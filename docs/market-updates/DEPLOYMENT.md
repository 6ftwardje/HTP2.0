# HTP 2.0 databaseschema — 24 september 2026

Doelproject: **HTP 2.0**, ref `swohtycdqbydqrtjzwwf`, West EU (Paris). Gecontroleerd via het Supabase-dashboard en de bestaande `.env.local`-projectref.

De migratie `20260924000000_weekly_update_content_formats.sql` is op dit project met `psql -1 -v ON_ERROR_STOP=1` als één transactie uitgevoerd. Uitkomst: drie kolommen en vier constraints toegevoegd. De twee bestaande `weekly_updates`-rijen bleven `content_format = 'video'`. Er is geen contentdata gewijzigd.

Ook `20260924010000_market_update_chart_storage.sql` is transactioneel op hetzelfde project uitgevoerd. De bucket `market-update-charts` is privé, maximaal 10 MB per object. Een oudere brede Storage-SELECT-policy liet level-2-studenten in alle buckets kijken. De nieuwe **restrictive** SELECT-policy sluit alleen deze bucket af voor directe clienttoegang; de serverroute controleert lidmaatschap en publicatiestatus en leest met service role. De bestaande buckets behouden hun gedrag.

De Supabase-migratiehistorie toonde aanvankelijk slechts vijf versies, tot `20260904010000_live_sessions`. Na een read-only schema-audit zijn `20260922010000_market_insight_content.sql` en direct aansluitend `20260922020000_restore_level_two_content_access.sql` in één transactie uitgevoerd. Zo zijn de ontbrekende Marktinzicht-kolommen en read-model toegevoegd zonder de huidige level-2-toegang te verliezen. De twee bestaande updates bleven video. Acht aantoonbaar aanwezige migratie-effecten, waaronder de twee featuremigraties, zijn met [het gecontroleerde herstel-SQL](./repair-htp2-migration-history.sql) in de historie geregistreerd.

**De historische migratiereeks is nog niet volledig geschikt voor een algemene `supabase db push`.** Vroege migraties ontbreken in de historie en sommige effecten ontbreken in het actuele schema. Bovendien mag `20260904020000_subscription_content_cutover.sql` expliciet niet worden uitgevoerd: betaalde abonnementen blijven uitgeschakeld. Een app-merge naar `main` gebruikt daarom géén automatische brede databasepush; de voor deze feature noodzakelijke schemawijzigingen zijn reeds gericht op HTP 2.0 uitgevoerd.

Voor een latere algemene migratierun is een aparte baseline van de oudere, deels handmatig toegepaste schemawijzigingen nodig. Voer de abonnements-cutover alleen uit na een afzonderlijk productbesluit.
