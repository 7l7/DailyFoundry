import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const chunksDir = resolve(webRoot, "poster-v3");
const outputPath = resolve(webRoot, "public/share-poster-template.webp");
const EXPECTED_BYTES = 27498;
const EXPECTED_SHA256 = "7ca08df3d8edd6e43d0fe492e86288d6c795f0c01f1d94152791d40a3deb4762";

const names = (await readdir(chunksDir)).filter((name) => name.endsWith(".b64")).sort();
if (names.length !== 19) throw new Error(`Expected 19 poster chunks, found ${names.length}`);
const base64 = (await Promise.all(names.map((name) => readFile(resolve(chunksDir, name), "utf8")))).join("");
const bytes = Buffer.from(base64, "base64");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const riff = bytes.subarray(0,4).toString("ascii") === "RIFF";
const webp = bytes.subarray(8,12).toString("ascii") === "WEBP";
if (bytes.length !== EXPECTED_BYTES) throw new Error(`Poster byte length mismatch: ${bytes.length}`);
if (sha256 !== EXPECTED_SHA256) throw new Error(`Poster SHA-256 mismatch: ${sha256}`);
if (!riff || !webp) throw new Error("Poster WebP magic bytes are invalid");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, bytes);
console.log(`Verified poster v3: ${bytes.length} bytes, sha256=${sha256}`);
