import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

// Check the actual build artifact, including Vite's substitutions and JSON encoding.
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const document = new JSDOM(html).window.document;
const base = "https://d31yy7ezo2w9ph.cloudfront.net/";
assert.equal(document.querySelector('link[rel="canonical"]').getAttribute("href"), base);
assert.equal(document.querySelector('meta[property="og:url"]').content, base);
for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
  assert.equal(document.querySelector(selector).content, `${base}social-preview.png`);
}
for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
  const description = document.querySelector(selector).content;
  assert.match(description, /AWS Cloud Resume Challenge Version 1/);
  assert.doesNotMatch(description, /Terraform|Azure|GitHub Actions/);
}
const structured = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
assert.equal(structured.url, base);
assert.equal(structured.mainEntity.url, base);
assert.equal(structured.mainEntity.name, "Jerome Christian V. Ibon");
assert.doesNotMatch(html, /__PORTFOLIO_|jeysibn\.github\.io|Terraform-managed/);
assert.ok(readFileSync(new URL("../dist/social-preview.png", import.meta.url)).length > 0);
console.log("Production canonical, Open Graph, social image and structured-data metadata passed.");
