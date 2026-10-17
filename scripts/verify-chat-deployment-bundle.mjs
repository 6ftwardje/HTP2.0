/** Run after a local Netlify build, before uploading with --no-build.
 * node scripts/verify-chat-deployment-bundle.mjs --publish-dir .netlify/static
 * The deploy command must use the same --dir .netlify/static and retain the
 * adapter-generated images, headers and redirects in its active netlify.toml.
 * Verifies compiled public configuration, adapted assets and Linux image runtime.
 * Never prints environment values or changes files.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const publishArgument = process.argv.indexOf("--publish-dir");
assert.ok(publishArgument >= 0 && process.argv[publishArgument + 1], "Pass --publish-dir .netlify/static; raw .next is not a deployable static directory.");
const publishDirectory = path.resolve(process.argv[publishArgument + 1]);
assert.equal(publishDirectory, path.resolve(".netlify/static"), "A no-build deployment must publish the adapted .netlify/static directory.");

const values = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (!match) return [];
  let value = match[2].trim();
  if (value.startsWith('"')) value = JSON.parse(value);
  else value = value.replace(/^'|'$/g, "");
  return [[match[1], value]];
}));
const endpoint = "https://swohtycdqbydqrtjzwwf.supabase.co";
assert.equal(values.NEXT_PUBLIC_SUPABASE_URL, endpoint, "Unexpected production build target.");
assert.ok(values.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length > 20 && !values.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("*"), "A real public Supabase key is required.");
const files = [];
function visit(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) visit(file);
    else if (item.name.endsWith(".js")) files.push(file);
  }
}
visit(".next/server");
visit(".next/static");
let endpointFiles = 0;
let keyFiles = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  assert.ok(!/\*{4,}e\.co/.test(source), "A masked Supabase endpoint was compiled. Rebuild with verified environment values.");
  if (source.includes(endpoint)) endpointFiles++;
  if (source.includes(values.NEXT_PUBLIC_SUPABASE_ANON_KEY)) keyFiles++;
}
assert.ok(endpointFiles > 0 && keyFiles > 0, "Compiled production configuration is missing.");

function verifyCopies(sourceDirectory, destinationDirectory) {
  let count = 0;
  for (const item of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    const source = path.join(sourceDirectory, item.name);
    const destination = path.join(destinationDirectory, item.name);
    if (item.isDirectory()) count += verifyCopies(source, destination);
    else {
      assert.ok(fs.existsSync(destination), `Adapted static asset is missing: ${destination}`);
      assert.ok(fs.readFileSync(source).equals(fs.readFileSync(destination)), `Adapted static asset differs from its build: ${destination}`);
      count++;
    }
  }
  return count;
}
const nextStaticAssets = verifyCopies(".next/static", path.join(publishDirectory, "_next/static"));
const publicAssets = verifyCopies("public", publishDirectory);
assert.ok(nextStaticAssets > 0, "Adapted Next.js static assets are missing.");

// Compare the generated blocks verbatim. This checks the saved adapter output
// without adding a TOML parser or trying to reconstruct framework rules.
function configurationSections(source, group) {
  const headings = [...source.matchAll(/^\[\[?([^\]\r\n]+)\]\]?[\t ]*\r?$/gm)];
  return headings.flatMap((heading, index) => {
    if (heading[1] !== group) return [];
    const next = headings.slice(index + 1).find((candidate) => !candidate[1].startsWith(`${group}.`));
    return [source.slice(heading.index, next?.index ?? source.length).trim()];
  });
}
const generatedConfiguration = fs.readFileSync(".netlify/netlify.toml", "utf8");
const activeConfiguration = fs.readFileSync("netlify.toml", "utf8");
for (const group of ["images", "headers", "redirects"]) {
  const expected = configurationSections(generatedConfiguration, group);
  const actual = configurationSections(activeConfiguration, group);
  assert.ok(expected.length > 0, `Saved adapter configuration has no ${group} sections.`);
  assert.ok(expected.every((section) => actual.includes(section)), `Active netlify.toml is missing generated ${group} configuration; preserve it before a no-build deploy.`);
}
const functionManifest = JSON.parse(fs.readFileSync(".netlify/functions/manifest.json", "utf8"));
const handler = functionManifest.functions?.find((entry) => entry.name === "___netlify-server-handler");
assert.ok(handler?.path && fs.existsSync(handler.path), "The adapted Next.js server handler bundle is missing.");
assert.ok(handler.routes?.some((route) => route.pattern === "/*" && route.prefer_static === true), "The adapted handler must retain its route after static asset lookup.");

const modules = ".netlify/functions-internal/___netlify-server-handler/node_modules";
const sharp = JSON.parse(fs.readFileSync(path.join(modules, "sharp/package.json"), "utf8"));
for (const name of ["@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64"]) {
  const installed = JSON.parse(fs.readFileSync(path.join(modules, name, "package.json"), "utf8"));
  assert.equal(installed.version, sharp.optionalDependencies[name], "Linux image binaries must match the bundled sharp version.");
}
console.log(JSON.stringify({ verified: true, compiledEndpointFiles: endpointFiles, compiledPublicKeyFiles: keyFiles, adaptedNextStaticAssets: nextStaticAssets, adaptedPublicAssets: publicAssets, savedAdapterConfigurationIncluded: true, serverHandlerIncluded: true, linuxImageRuntimeIncluded: true }));
