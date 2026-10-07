import assert from "node:assert/strict";
import test from "node:test";
import { isMarketArticle, marketArticleHtml } from "../../lib/market-article";

const base = { id: 42, title: 'Markt <update> "vandaag"', content_kind: "video" as const, content_format: "text" as const, article_html: null, body: "Eerste alinea.\nEen volgende regel.\n\nTweede alinea met <script>alert(1)</script>.", image_paths: [] as string[] };

test("existing text/chart posts remain articles even with the migration's video default", () => {
  assert.equal(isMarketArticle(base), true);
  assert.equal(isMarketArticle({ ...base, content_format: "chart" }), true);
  assert.equal(isMarketArticle({ ...base, content_format: "video" }), false);
  assert.equal(isMarketArticle({ ...base, content_format: "video", content_kind: "article" }), true);
});

test("legacy text retains paragraphs and line breaks without interpreting stored markup", () => {
  const html = marketArticleHtml(base);
  assert.match(html, /Eerste alinea\.<br\s*\/>Een volgende regel\./);
  assert.match(html, /<p>Tweede alinea/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!html.includes("<script>"));
});

test("legacy charts keep their authorized endpoints and original order before the text", () => {
  const html = marketArticleHtml({ ...base, content_format: "chart", image_paths: ["private/a.png", "private/b.png"] });
  assert.ok(html.indexOf("/api/market-updates/42/images/0") < html.indexOf("/api/market-updates/42/images/1"));
  assert.ok(html.indexOf("/api/market-updates/42/images/1") < html.indexOf("Eerste alinea"));
  assert.match(html, /alt="Chart 1 bij Markt &lt;update&gt; &quot;vandaag&quot;"/);
  assert.ok(!html.includes("private/a.png"));
});

test("formatted articles retain their own media order and are sanitized", () => {
  const html = marketArticleHtml({ ...base, content_kind: "article", article_html: '<p>Voor</p><img src="https://example.com/chart.png" alt="Chart"><p>Na</p><script>alert(1)</script>' });
  assert.ok(html.indexOf("Voor") < html.indexOf("chart.png"));
  assert.ok(html.indexOf("chart.png") < html.indexOf("Na"));
  assert.ok(!html.includes("Eerste alinea"));
  assert.ok(!html.includes("<script>"));
});
