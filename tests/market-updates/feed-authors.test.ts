import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { marketUpdateAuthorName } from "../../lib/market-update-author";

test("feed author projection uses the access-checked RPC, preserves publication names and excludes private fields/drafts", async () => {
  const calls: number[] = [];
  const exports: any = {};
  const code = ts.transpileModule(readFileSync("lib/market-feed-authors.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(code, { exports, require: (name: string) => name.endsWith("supabase/server") ? { createClient: async () => ({ rpc: async (rpc: string, args: {p_post_id: number}) => {
    assert.equal(rpc,"market_post_author"); calls.push(args.p_post_id);
    return { data: [{ name:"Huidige naam",object_path:"public-avatar.webp",student_id:"author",email:"private@example.invalid",auth_user_id:"private" }] };
  } }) } : { marketUpdateAuthorName } });
  const base = {is_published:true,content_format:"text",mentor:null,published_by_student_id:"author",published_by_display_name:"Naam bij publicatie"};
  const authors=await exports.getMarketFeedAuthors([{...base,id:1},{...base,id:2},{...base,id:3,published_by_display_name:"Andere publicatienaam"},{...base,id:4,is_published:false}]);
  assert.deepEqual(calls,[1,3]);
  assert.equal(authors[1].name,"Naam bij publicatie"); assert.equal(authors[3].name,"Andere publicatienaam");
  assert.equal(authors[4],undefined); assert.equal(authors[1].object_path,"public-avatar.webp");
  assert.deepEqual(Object.keys(authors[1]).sort(),["name","object_path","student_id"]);
});
