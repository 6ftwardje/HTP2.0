/**
 * Complete recipient delivery even when the event was committed in a prior
 * attempt. A duplicate insert means another request won the event race; the
 * unique recipient upsert supplied by the caller handles that second race.
 */
export async function ensureNotificationRecipients({
  findEventId,
  createEvent,
  addRecipients,
}: {
  findEventId: () => Promise<string | null>;
  createEvent: () => Promise<string>;
  addRecipients: (eventId: string) => Promise<void>;
}): Promise<void> {
  let eventId = await findEventId();
  if (!eventId) {
    try {
      eventId = await createEvent();
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "23505")) {
        throw error;
      }
      eventId = await findEventId();
      if (!eventId) throw new Error("Melding kon na gelijktijdige aanmaak niet worden opgehaald.");
    }
  }
  await addRecipients(eventId);
}
