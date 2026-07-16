import { chromium } from "playwright";

const baseUrl = (process.env.PERF_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const browser = await chromium.launch();

try {
  for (const path of ["/dashboard", "/modules", "/admin"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    const finalUrl = new URL(page.url());
    if (finalUrl.pathname !== "/" || finalUrl.searchParams.get("redirectedFrom") !== path) {
      throw new Error(`Anonymous ${path} access was not rejected safely: ${page.url()}`);
    }
    await context.close();
  }

  const forgedContext = await browser.newContext({
    extraHTTPHeaders: {
      "x-user-id": "00000000-0000-0000-0000-000000000001",
      "x-internal-user-id": "00000000-0000-0000-0000-000000000001",
      "x-supabase-user-id": "00000000-0000-0000-0000-000000000001",
    },
  });
  const forgedPage = await forgedContext.newPage();
  await forgedPage.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  if (new URL(forgedPage.url()).pathname !== "/") {
    throw new Error("Forged internal user headers bypassed the protected-route redirect");
  }
  await forgedContext.close();

  const authContext = await browser.newContext();
  const authPage = await authContext.newPage();
  const scripts = [];
  let authRequestCount = 0;
  authPage.on("response", (response) => {
    if (response.request().resourceType() === "script") scripts.push(response.url());
  });
  await authPage.route("**/auth/v1/**", async (route) => {
    authRequestCount += 1;
    await route.abort("blockedbyclient");
  });
  await authPage.goto(baseUrl, { waitUntil: "load" });
  const initialScriptCount = scripts.length;
  if (authRequestCount !== 0) {
    throw new Error("The auth API was contacted before user interaction");
  }
  await authPage.locator("#email").fill("project-speed@example.invalid");
  await authPage.locator("#password").fill("not-a-real-password");
  await authPage.locator('button[type="submit"]').click();
  await authPage.waitForTimeout(1_000);
  const deferredScriptCount = scripts.length - initialScriptCount;
  if (deferredScriptCount < 1) {
    throw new Error("No deferred authentication chunk loaded after submit");
  }
  if (authRequestCount !== 1) {
    throw new Error(`Expected one intercepted auth request after submit, received ${authRequestCount}`);
  }
  await authContext.close();

  console.log(
    JSON.stringify(
      {
        anonymousProtectedRoutesRejected: true,
        forgedInternalHeadersRejected: true,
        authApiRequestsBeforeInteraction: 0,
        authApiRequestsAfterInteraction: authRequestCount,
        deferredScriptsLoadedAfterInteraction: deferredScriptCount,
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
