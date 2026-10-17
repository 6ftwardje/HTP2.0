import assert from "node:assert/strict";
import test from "node:test";
import type { WeeklyUpdate } from "../../lib/types";
import { projectMarketFeedUpdates, availableFeedMarkets, filterMarketFeed, followingMarketUpdates, latestWeeklyOutlook, outlookPeriod, brusselsWeekStart, updateSummary } from "../../lib/market-feed";
import { parseVideoTimestamp, activeMarketChapter } from "../../lib/market-video-navigation";
const item = (id: number, fields: Partial<WeeklyUpdate> = {}) => ({ id, title: `Update ${id}`, summary: "Een volledige toelichting op de goudmarkt.", created_at: `2026-10-${String(id).padStart(2,"0")}T10:00:00Z`, published_at: null, type: "market_update", content_format: "text", is_published: true, markets: ["gold"], week_start_date: "2026-10-12", ...fields } as WeeklyUpdate);
const filters = { view: "current", content: "all", market: "all", search: "", status: "all" } as const;
test("feed chips use published candidates, deduplicate markets and honor the threshold", () => {
  for (const count of [1,5,30]) {
    const items = Array.from({length: count}, (_, i) => item(i+1));
    assert.deepEqual(availableFeedMarkets(items), ["gold"]);
    assert.deepEqual(availableFeedMarkets([...items, item(40, { markets: ["forex", "trading"] }), item(41, { is_published: false, markets:["crypto"] })]), ["forex","gold","trading"]);
    assert.deepEqual(availableFeedMarkets(items, count), []);
  }
});
test("combined filters search title and summary across markets, with charts in text and archives separate", () => {
  const items = [item(1), item(2,{markets:["forex"],summary:"Goud bepaalt het sentiment.",content_format:"video"}), item(3,{content_format:"chart"}), item(4,{actuality_status:"archive"}), item(5,{is_published:false})];
  assert.equal(filterMarketFeed(items, filters).length,3);
  assert.deepEqual(filterMarketFeed(items,{...filters,market:"forex",content:"video",search:"GOUD"}).map(x=>x.id),[2]);
  assert.deepEqual(filterMarketFeed(items,{...filters,content:"text"}).map(x=>x.id),[3,1]);
  assert.deepEqual(filterMarketFeed(items,{...filters,view:"archive"}).map(x=>x.id),[4]);
  assert.equal(filterMarketFeed(items,{...filters,search:"nietbestaand"}).length,0);
  assert.ok(updateSummary(item(1,{summary:"Update 1",body:"Financiële context."})).includes("Financiële"));
  assert.ok(updateSummary(item(1,{summary:null,body:null})).length);
});
test("related updates select the immediate newer publication, previous for newest, and real outlook without duplicates", () => {
  const items=[item(1),item(2),item(3),item(10,{type:"weekly_outlook"}),item(11,{is_published:false})];
  assert.deepEqual(followingMarketUpdates(items[1],items).map(x=>x.id),[3,10]);
  assert.deepEqual(followingMarketUpdates(items[2],items).map(x=>x.id),[2,10]);
  assert.deepEqual(followingMarketUpdates(items[3],items).map(x=>x.id),[3,2]);
  assert.deepEqual(followingMarketUpdates(items[0],[]),[]);
  assert.deepEqual(followingMarketUpdates(items[0],[items[0],items[1]]).map(x=>x.id),[2]);
  assert.deepEqual(followingMarketUpdates(item(1),[item(2,{created_at:item(1).created_at}),item(3,{created_at:item(1).created_at})]).map(x=>x.id),[2]);
});
test("weekly labels follow Brussels Monday across DST and year boundaries and do not fabricate outlooks", () => {
  assert.equal(latestWeeklyOutlook([item(1)]),undefined);
  assert.equal(brusselsWeekStart(new Date("2026-10-18T22:30:00Z")),"2026-10-19");
  assert.equal(brusselsWeekStart(new Date("2026-03-29T22:30:00Z")),"2026-03-30");
  assert.equal(brusselsWeekStart(new Date("2027-01-01T12:00:00Z")),"2026-12-28");
  assert.equal(outlookPeriod(item(1),new Date("2026-10-20T12:00Z")).label,"Eerdere weekvooruitblik");
  assert.equal(outlookPeriod(item(1),new Date("2026-10-17T12:00Z")).label,"Deze week");
  assert.equal(latestWeeklyOutlook([item(1,{type:"weekly_outlook",week_start_date:"2026-10-05"}),item(2,{type:"weekly_outlook"})])?.id,2);
});
test("timestamp URLs reject ambiguous, negative and invalid values; active chapters follow actual time", () => {
  for (const value of ["-1","abc","1:99","1:60:00","Infinity","1.5",""]) assert.equal(parseVideoTimestamp(value),null);
  for (const [value,seconds] of [["0",0],["70",70],["01:10",70],["1:02:03",3723]] as const) assert.equal(parseVideoTimestamp(value),seconds);
  const chapters=[{title:"Intro",seconds:0},{title:"Goud",seconds:10},{title:"Forex",seconds:20}];
  assert.equal(activeMarketChapter(chapters,19),1); assert.equal(activeMarketChapter(chapters,20),2); assert.equal(activeMarketChapter([],20),-1);
});

test("client feed projection excludes mentor email without mutating the source",()=>{
 const update={...item(1),mentor:{id:"author",name:"Publieke naam",email:"private@example.invalid"}};
 const projected=projectMarketFeedUpdates([update]);assert.deepEqual(projected[0].mentor,{id:"author",name:"Publieke naam"});assert.equal(update.mentor.email,"private@example.invalid");assert.ok(!JSON.stringify(projected).includes("private@example.invalid"));
});
