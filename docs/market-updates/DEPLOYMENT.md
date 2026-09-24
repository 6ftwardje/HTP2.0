# HTP 2.0 databaseschema — 24 september 2026

Doelproject: **HTP 2.0**, ref `swohtycdqbydqrtjzwwf`, West EU (Paris). Gecontroleerd via het Supabase-dashboard en de bestaande `.env.local`-projectref.

De migratie `20260924000000_weekly_update_content_formats.sql` is op dit project met `psql -1 -v ON_ERROR_STOP=1` als één transactie uitgevoerd. Uitkomst: drie kolommen en vier constraints toegevoegd. De twee bestaande `weekly_updates`-rijen bleven `content_format = 'video'`. Er is geen contentdata gewijzigd.

De Supabase-migratiehistorie van dit project toonde op dat moment als nieuwste geregistreerde migratie `20260904010000_live_sessions`, terwijl de database wel enkele latere schema-elementen zoals `weekly_updates.type` bevat. Daarom is alleen de nieuwe, herhaalbare migratie uitgevoerd. **Voer geen volledige `supabase db push` uit voordat de bestaande schema- en historiedrift is onderzocht.** De nieuwe migratie staat nog niet als toegepast in `supabase_migrations.schema_migrations`; bij een latere reguliere migratierun kan deze veilig opnieuw worden uitgevoerd en dan geregistreerd worden.

Voor release: vergelijk de database met de repo-migraties, herstel de historie gecontroleerd en verifieer daarna de toegangspolicies voor alle formats. Dit onderzoek hoort niet in een featuremigratie die bestaande toegang zou kunnen veranderen.
