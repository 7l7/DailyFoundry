import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const chunksDir = resolve(webRoot, "poster-clean-final");
const outputPath = resolve(webRoot, "public/share-poster-template.webp");
const EXPECTED_BYTES = 92564;
const EXPECTED_SHA256 = "d8e9604ca776ce965fa507ad3afaf5c433b7c80e74153fd31e219ac04934fd3a";
const names = ["00.b64", "01.b64", "02.b64", "03a1.b64", "03a2a.b64", "03a2b.b64", "03b.b64", "04.b64", "05.b64", "06.b64"];

const base64 = (await Promise.all(names.map((name) => readFile(resolve(chunksDir, name), "utf8")))).join("");
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
