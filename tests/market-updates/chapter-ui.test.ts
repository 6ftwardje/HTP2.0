import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as navigation from "../../lib/market-video-navigation";
import * as seek from "../../lib/video-seek";
function components() {
 const exports:any={};const code=ts.transpileModule(readFileSync("components/market-insight/VideoChapterLayout.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const deps:Record<string,unknown>={react:React,"react/jsx-runtime":jsx,"@/lib/market-video-navigation":navigation,"@/lib/video-seek":seek,"./VideoChapterLayout.module.css":{default:{}}};
 runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in deps,name);return deps[name];}});return exports;
}
test("inactive legacy provider has readable chapter times and explanation instead of dead seek buttons",()=>{
 const {VideoChapterLayout,MobileVideoChapters}=components();const html=renderToStaticMarkup(React.createElement(VideoChapterLayout,{provider:"youtube",chapters:[{title:"Introductie",seconds:0},{title:"Goud",seconds:10}]},React.createElement(MobileVideoChapters)));
 assert.ok(html.includes("oudere videoprovider"));assert.ok(html.includes("0:10"));assert.ok(html.includes("<details"));assert.ok(!html.includes("<button"));
});
test("missing chapters do not render an empty rail or disclosure",()=>{
 const {VideoChapterLayout,MobileVideoChapters}=components();const html=renderToStaticMarkup(React.createElement(VideoChapterLayout,{provider:"mux",chapters:[]},React.createElement(MobileVideoChapters)));
 assert.ok(!html.includes("<aside"));assert.ok(!html.includes("<details"));assert.ok(!html.includes("In deze video"));
});
