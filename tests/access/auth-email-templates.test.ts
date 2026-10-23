import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("every email action goes through the app confirmation gate on the canonical site", () => {
  const templates = {
    "confirm-sign-up": "signup",
    "invite-user": "invite",
    "reset-password": "recovery",
    "magic-link-or-otp": "magiclink",
    "change-email-address": "email_change",
  };
  for (const [name, type] of Object.entries(templates)) {
    const template = readFileSync(new URL(`../../docs/auth-email-templates/${name}.html`, import.meta.url), "utf8");
    const rendered = template.replaceAll("{{ .SiteURL }}", "https://hettradeplatform.be").replaceAll("{{ .TokenHash }}", "test-token");
    const links = [...rendered.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll("&amp;", "&"));
    assert.equal(links.length, 2, `${name}: button and copyable link`);
    for (const link of links) {
      const url = new URL(link);
      assert.equal(url.origin, "https://hettradeplatform.be");
      assert.equal(url.pathname, "/auth/confirm");
      assert.equal(url.searchParams.get("type"), type);
      assert.equal(url.searchParams.get("token_hash"), "test-token");
    }
    assert.ok(!template.includes("{{ .ConfirmationURL }}"), `${name}: no upstream one-time GET verification`);
    assert.ok(!template.includes("{{ .RedirectTo }}"), `${name}: no callback path appended to another callback`);
  }
});
