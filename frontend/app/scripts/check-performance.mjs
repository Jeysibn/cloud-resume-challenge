import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const assetsDirectory = new URL("../dist/assets/", import.meta.url);
const assets = readdirSync(assetsDirectory);
const javascriptAsset = assets.find((asset) => /^index-[^/]+\.js$/.test(asset));

if (!javascriptAsset) {
  throw new Error("Performance budget could not find the production JavaScript bundle.");
}

const javascriptBytes = readFileSync(new URL(javascriptAsset, assetsDirectory));
const gzipBytes = gzipSync(javascriptBytes).byteLength;
const budgetBytes = 180 * 1024;

console.log(
  "JavaScript bundle: " +
    (javascriptBytes.byteLength / 1024).toFixed(1) +
    " KiB raw, " +
    (gzipBytes / 1024).toFixed(1) +
    " KiB gzip (budget " +
    (budgetBytes / 1024).toFixed(0) +
    " KiB)",
);

if (gzipBytes > budgetBytes) {
  throw new Error("JavaScript bundle exceeds the 180 KiB gzip performance budget.");
}
