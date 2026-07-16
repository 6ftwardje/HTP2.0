import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const DEFAULT_BASE_URL = "https://htp2.netlify.app";
const DEFAULT_RUNS = 10;
const SETTLE_MS = 1_500;

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.PERF_BASE_URL || DEFAULT_BASE_URL,
    runs: Number(process.env.PERF_RUNS || DEFAULT_RUNS),
    output: process.env.PERF_OUTPUT || null,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--base-url") options.baseUrl = argv[++index];
    else if (value === "--runs") options.runs = Number(argv[++index]);
    else if (value === "--output") options.output = argv[++index];
    else if (value === "--headed") options.headed = true;
    else throw new Error(`Unknown argument: ${value}`);
  }

  options.baseUrl = options.baseUrl.replace(/\/$/, "");
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error("--runs must be a positive integer");
  }
  return options;
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(1));
}

function summarizeNumbers(samples, key) {
  const values = samples
    .map((sample) => sample[key])
    .filter((value) => Number.isFinite(value));
  return {
    p50: percentile(values, 50),
    p95: percentile(values, 95),
  };
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function installVitalsObservers(page) {
  await page.addInitScript(() => {
    window.__projectSpeed = {
      cls: 0,
      lcp: 0,
      longTaskCount: 0,
      longTaskDuration: 0,
    };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__projectSpeed.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries.at(-1);
        if (last) window.__projectSpeed.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__projectSpeed.longTaskCount += 1;
          window.__projectSpeed.longTaskDuration += entry.duration;
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Older browsers can omit one of these entry types. Missing values stay 0.
    }
  });
}

async function authenticate(browser, baseUrl, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await Promise.all([
    page.waitForURL(/\/(dashboard|onboarding)(?:[/?#]|$)/, { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  const storageState = await context.storageState();
  await context.close();
  return storageState;
}

async function measureRoute(browser, options, route, storageState) {
  const samples = [];

  for (let run = 1; run <= options.runs; run += 1) {
    const context = await browser.newContext(storageState ? { storageState } : {});
    const page = await context.newPage();
    await installVitalsObservers(page);

    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message.slice(0, 500)));

    const cdp = await context.newCDPSession(page);
    const requests = new Map();
    let transferBytes = 0;
    let javascriptTransferBytes = 0;
    let requestCount = 0;
    await cdp.send("Network.enable");
    cdp.on("Network.requestWillBeSent", (event) => {
      requests.set(event.requestId, { type: event.type, url: event.request.url });
    });
    cdp.on("Network.loadingFinished", (event) => {
      const request = requests.get(event.requestId);
      if (!request || request.url.startsWith("data:") || request.url.startsWith("blob:")) return;
      requestCount += 1;
      transferBytes += event.encodedDataLength || 0;
      if (request.type === "Script") javascriptTransferBytes += event.encodedDataLength || 0;
    });

    const response = await page.goto(`${options.baseUrl}${route.path}`, {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.waitForTimeout(SETTLE_MS);

    const browserMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      const visibleText = document.body.innerText.replace(/\s+/g, " ").trim();
      const links = [...document.querySelectorAll("a[href]")]
        .map((link) => `${link.textContent?.replace(/\s+/g, " ").trim() || ""}|${link.getAttribute("href")}`)
        .sort();
      return {
        ttfb: navigation?.responseStart ?? null,
        fcp: fcp?.startTime ?? null,
        lcp: window.__projectSpeed?.lcp ?? null,
        domContentLoaded: navigation?.domContentLoadedEventEnd ?? null,
        load: navigation?.loadEventEnd ?? null,
        cls: window.__projectSpeed?.cls ?? null,
        longTaskCount: window.__projectSpeed?.longTaskCount ?? 0,
        longTaskDuration: window.__projectSpeed?.longTaskDuration ?? 0,
        content: `${visibleText}\n${links.join("\n")}`,
      };
    });

    samples.push({
      run,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      ttfbMs: browserMetrics.ttfb,
      fcpMs: browserMetrics.fcp,
      lcpMs: browserMetrics.lcp,
      domContentLoadedMs: browserMetrics.domContentLoaded,
      loadMs: browserMetrics.load,
      transferBytes,
      javascriptTransferBytes,
      requestCount,
      cls: browserMetrics.cls,
      longTaskCount: browserMetrics.longTaskCount,
      longTaskDurationMs: browserMetrics.longTaskDuration,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      contentHash: stableHash(browserMetrics.content),
    });
    await context.close();
    process.stdout.write(`  ${route.label}: ${run}/${options.runs}\r`);
  }
  process.stdout.write("\n");

  const uniqueContentHashes = [...new Set(samples.map((sample) => sample.contentHash))];
  return {
    label: route.label,
    path: route.path,
    mode: route.mode,
    runs: samples.length,
    finalUrls: [...new Set(samples.map((sample) => sample.finalUrl))],
    contentHashes: uniqueContentHashes,
    contentStable: uniqueContentHashes.length === 1,
    metrics: {
      ttfbMs: summarizeNumbers(samples, "ttfbMs"),
      fcpMs: summarizeNumbers(samples, "fcpMs"),
      lcpMs: summarizeNumbers(samples, "lcpMs"),
      domContentLoadedMs: summarizeNumbers(samples, "domContentLoadedMs"),
      loadMs: summarizeNumbers(samples, "loadMs"),
      transferBytes: summarizeNumbers(samples, "transferBytes"),
      javascriptTransferBytes: summarizeNumbers(samples, "javascriptTransferBytes"),
      requestCount: summarizeNumbers(samples, "requestCount"),
      cls: summarizeNumbers(samples, "cls"),
      longTaskCount: summarizeNumbers(samples, "longTaskCount"),
      longTaskDurationMs: summarizeNumbers(samples, "longTaskDurationMs"),
      consoleErrorCount: summarizeNumbers(samples, "consoleErrorCount"),
    },
    samples,
  };
}

async function checkForgedHeaders(browser, baseUrl) {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-user-id": "00000000-0000-0000-0000-000000000001",
      "x-internal-user-id": "00000000-0000-0000-0000-000000000001",
      "x-supabase-user-id": "00000000-0000-0000-0000-000000000001",
    },
  });
  const page = await context.newPage();
  const response = await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  const finalUrl = page.url();
  const rejected = new URL(finalUrl).pathname === "/";
  await context.close();
  return { rejected, status: response?.status() ?? null, finalUrl };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({ headless: !options.headed });
  const email = process.env.PERF_TEST_EMAIL;
  const password = process.env.PERF_TEST_PASSWORD;
  const hasCredentials = Boolean(email && password);
  let storageState = null;

  if (hasCredentials) {
    storageState = await authenticate(browser, options.baseUrl, email, password);
  }

  const routes = [
    { label: "login", path: "/", mode: "public" },
    { label: "dashboard-anonymous", path: "/dashboard", mode: "anonymous" },
    { label: "modules-anonymous", path: "/modules", mode: "anonymous" },
    { label: "admin-anonymous", path: "/admin", mode: "anonymous" },
  ];
  if (storageState) {
    routes.push(
      { label: "dashboard", path: "/dashboard", mode: "authenticated" },
      { label: "modules", path: "/modules", mode: "authenticated" },
      { label: "weekly-updates", path: "/weekly-updates", mode: "authenticated" }
    );
  }

  const results = [];
  for (const route of routes) {
    results.push(await measureRoute(browser, options, route, storageState && route.mode === "authenticated" ? storageState : null));
  }
  const forgedHeaderCheck = await checkForgedHeaders(browser, options.baseUrl);
  await browser.close();

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    runsPerRoute: options.runs,
    freshContextPerRun: true,
    settleMs: SETTLE_MS,
    authenticatedRoutesIncluded: hasCredentials,
    authenticatedRoutesSkippedReason: hasCredentials ? null : "PERF_TEST_EMAIL and PERF_TEST_PASSWORD are not both set",
    security: { forgedInternalHeadersRejected: forgedHeaderCheck },
    routes: results,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = resolve(options.output || `output/playwright/performance-${timestamp}.json`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, authenticatedRoutesIncluded: hasCredentials, security: report.security, summaries: results.map(({ label, metrics, contentStable }) => ({ label, contentStable, metrics })) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
