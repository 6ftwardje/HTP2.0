import assert from "node:assert/strict";
import test from "node:test";
import { getAuthOrigin } from "../../lib/auth-origin";

function withSite(site: string | undefined, run: () => void) {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  if (site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = site;
  try { run(); }
  finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
}

test("Netlify main-branch runtime aliases use the configured canonical origin", () => {
  withSite("https://platform.example.test", () => {
    assert.equal(getAuthOrigin("https://main--sample.netlify.app/auth/confirm?type=signup"), "https://platform.example.test");
  });
});

test("preview, local and public request origins remain unchanged", () => {
  withSite("https://platform.example.test", () => {
    for (const origin of ["https://deploy-preview-42--sample.netlify.app", "https://abc123--sample.netlify.app", "http://localhost:3100", "https://platform.example.test"]) {
      assert.equal(getAuthOrigin(`${origin}/auth/confirm`), origin);
    }
  });
});

test("invalid or missing canonical configuration never supplies another redirect origin", () => {
  for (const value of [undefined, "", "not a valid URL", "javascript:alert(1)", "ftp://example.test"]) {
    withSite(value, () => assert.equal(getAuthOrigin("https://main--sample.netlify.app/auth/confirm"), "https://main--sample.netlify.app"));
  }
});
