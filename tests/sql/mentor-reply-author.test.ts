import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oldMigration = readFileSync(
  new URL("../../supabase/migrations/20260615000000_mentor_chat_notifications.sql", import.meta.url),
  "utf8"
);
const authorMigration = readFileSync(
  new URL("../../supabase/migrations/20260927040000_mentor_reply_author.sql", import.meta.url),
  "utf8"
);

function triggerFunction(sql: string) {
  const functionSql = sql.match(
    /create or replace function public\.handle_conversation_message_insert\(\)[\s\S]*?\$\$;/
  )?.[0];
  assert.ok(functionSql, "mentor-chat-triggerfunctie ontbreekt");
  return functionSql;
}

test("replymeldingen noemen de afzender, met neutrale en AI-fallback", () => {
  const functionSql = triggerFunction(authorMigration);
  assert.match(functionSql, /new\.sender_role = 'ai'[\s\S]*?'AI-assistent'/);
  assert.match(functionSql, /nullif\(btrim\(s\.name\), ''\)/);
  assert.match(functionSql, /coalesce\(v_sender_name, 'Je mentor'\)/);
  assert.match(functionSql, /v_sender_name \|\| ' heeft geantwoord'/);
  assert.doesNotMatch(functionSql, /Rousso heeft geantwoord/);
});

test("recipient- en triggerlogica zijn verder ongewijzigd", () => {
  const original = triggerFunction(oldMigration);
  const reverted = triggerFunction(authorMigration)
    .replace(/    if new\.sender_role = 'ai' then[\s\S]*?    end if;\n\n/, "")
    .replace("v_sender_name || ' heeft geantwoord'", "'Rousso heeft geantwoord'");
  assert.equal(reverted, original);
  assert.doesNotMatch(authorMigration, /drop trigger|create trigger/);
});
