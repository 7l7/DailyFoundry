import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const chunksDir = resolve(webRoot, "poster-clean-final");
const outputPath = resolve(webRoot, "public/share-poster-template.webp");
const EXPECTED_BYTES = 92564;
const EXPECTED_SHA256 = "d8e9604ca776ce965fa507ad3afaf5c433b7c80e74153fd31e219ac04934fd3a";

const names = (await readdir(chunksDir)).filter((name) => name.endsWith(".b64")).sort();
if (names.length !== 7) throw new Error(`Expected 7 clean poster chunks, found ${names.length}`);
const base64 = (await Promise.all(names.map((name) => readFile(resolve(chunksDir, name), "utf8")))).join("");
if (base64.length !== 123420) throw new Error(`Poster base64 length mismatch: ${base64.length}`);
const bytes = Buffer.from(base64, "base64");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const riff = bytes.subarray(0, 4).toString("ascii") === "RIFF";
const webp = bytes.subarray(8, 12).toString("ascii") === "WEBP";
if (bytes.length !== EXPECTED_BYTES) throw new Error(`Poster byte length mismatch: ${bytes.length}`);
if (sha256 !== EXPECTED_SHA256) throw new Error(`Poster SHA-256 mismatch: ${sha256}`);
if (!riff || !webp) throw new Error("Poster WebP magic bytes are invalid");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, bytes);
console.log(`Verified clean poster: ${bytes.length} bytes, sha256=${sha256}`);
