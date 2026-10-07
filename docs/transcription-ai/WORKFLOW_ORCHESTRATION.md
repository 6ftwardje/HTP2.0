# MVP-workflow transcriptie en enrichment

Status: geïmplementeerd voor S4.1 op `codex/ai-transcription-suite`.

## State machine

De admin start iedere video expliciet. De workflow doorloopt
`fetch_transcript -> enrich -> review -> complete`; de vertaalstap is bewust
afwezig. `waiting_review` publiceert nooit automatisch. Publiceren of afwijzen
door een platformadmin sluit de workflow af.

| Status | Betekenis | Volgende actie |
|---|---|---|
| `pending` | Klaar om te claimen | Adminworker claimt een lease |
| `running` | Eén worker heeft de lease | Geen tweede worker toegestaan |
| `failed` | Retrybare fout met backoff | Opnieuw claimen na `next_attempt_at` |
| `dead_letter` | Permanente fout of pogingen opgebruikt | Expliciete adminherstart na controle |
| `waiting_review` | AI-concept gereed | Admin corrigeert, publiceert of wijst af |
| `completed` | Reviewbesluit genomen | Geen verdere verwerking |

## Idempotentie en crashherstel

- Eén workflowrij per transcript is afgedwongen met een unieke sleutel.
- Een atomische databasefunctie verleent een lease van maximaal tien minuten.
  Een actieve lease blokkeert concurrency; een verlopen lease kan worden
  overgenomen en telt als nieuwe poging.
- Transcriptopslag is status-geguard. Enrichment gebruikt daarnaast de unieke
  sleutel `(transcript_id, prompt_version, model)`.
- Een crash met een enrichment in `processing` wordt niet automatisch opnieuw
  naar de AI-provider gestuurd. De workflow gaat naar `dead_letter`, zodat een
  mens de onbekende uitkomst beoordeelt en geen dubbele betaalde call ontstaat.

## Retries en kosten

Retrybare fouten gebruiken 60 seconden, 5 minuten en daarna 30 minuten
backoff, met maximaal vier pogingen. Permanente fouten gaan direct naar
`dead_letter`. Voor iedere enrichment controleert de bestaande fail-closed
kostenpoort actuele prijsconfiguratie, maximaal EUR 2 per video en EUR 50 per
kalendermaand vóór de provider wordt aangeroepen. Resultaten en veilige
foutcodes worden geaudit; transcripttekst en providerfoutdetails komen niet in
applicatielogs.

De huidige serverless aanpak heeft bewust geen externe queue. Voor de pilot van
maximaal tien video's en circa 90 minuten nieuwe content per week is de
handmatige adminstart de scheduler.
