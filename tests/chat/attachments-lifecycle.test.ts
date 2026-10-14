import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { storeChatAttachment } from "../../lib/chat-attachments-server";

const userId = "14123000-0000-4000-8000-000000000001";
const id = "14123000-0000-4000-8000-000000000002";
const intent = "14123000-0000-4000-8000-000000000003";
const path = `${userId}/${id}.webp`;
const dto = { id, fileName: "chart.webp", width: 20, height: 10, mediaType: "image/webp", sizeBytes: 20 };
const image = { bytes: Buffer.alloc(20), width: 20, height: 10, mediaType: "image/webp" as const,
  fileName: "chart.webp", sizeBytes: 20, contentSha256: "a".repeat(64) };

test("attachment lifecycle: a lost completion response never deletes a committed image", async () => {
  let state = "pending"; let destructiveRemovals = 0;
  const db = {
    rpc: async (name: string) => {
      if (name === "register_chat_attachment") return { data: { id, objectPath: path, state, attachment: dto }, error: null };
      state = "ready"; // The commit succeeded, but its acknowledgement was lost.
      return { data: null, error: { code: "NETWORK_TIMEOUT" } };
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => { destructiveRemovals++; return { error: null }; } }) },
    from: () => ({ update: () => ({ eq: () => ({ eq: async (_column: string, expected: string) => { if (state === expected) state = "garbage"; return { error: null }; } }) }) }),
  } as unknown as SupabaseClient;
  await assert.rejects(storeChatAttachment(db, userId, image, { threadId: null, uploadIntent: intent }));
  assert.equal(state, "ready"); assert.equal(destructiveRemovals, 0);
});
test("attachment lifecycle: retry after a lost upload response returns the canonical ready image", async () => {
  let uploads = 0;
  const db = {
    rpc: async () => ({ data: { id, objectPath: path, state: "ready", attachment: dto }, error: null }),
    storage: { from: () => ({ upload: async () => { uploads++; return { error: null }; } }) },
  } as unknown as SupabaseClient;
  assert.deepEqual(await storeChatAttachment(db, userId, image, { threadId: null, uploadIntent: intent }), dto);
  assert.equal(uploads, 0);
});
test("attachment lifecycle: simultaneous identical upload conflict can safely complete its reservation", async () => {
  const db = {
    rpc: async (name: string) => ({ data: name === "register_chat_attachment"
      ? { id, objectPath: path, state: "pending", attachment: dto } : dto, error: null }),
    storage: { from: () => ({ upload: async () => ({ error: { statusCode: "409" } }) }) },
  } as unknown as SupabaseClient;
  assert.deepEqual(await storeChatAttachment(db, userId, image, { threadId: null, uploadIntent: intent }), dto);
});
