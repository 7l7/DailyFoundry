import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const chunksDir = resolve(webRoot, "poster-jpg");
const outputPath = resolve(webRoot, "public/share-poster-template.jpg");
const EXPECTED_BYTES = 25996;
const EXPECTED_SHA256 = "ff451506e51168cb5fa3b0a7a482d679bc189fd6dfe6877d3085e4f0b4dddd79";

const names = (await readdir(chunksDir)).filter((name) => name.endsWith(".b64")).sort();
if (names.length !== 11) throw new Error(`Expected 11 poster chunks, found ${names.length}`);

const base64 = (await Promise.all(names.map((name) => readFile(resolve(chunksDir, name), "utf8")))).join("");
const bytes = Buffer.from(base64, "base64");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;

if (bytes.length !== EXPECTED_BYTES) throw new Error(`Poster byte length mismatch: ${bytes.length}`);
if (sha256 !== EXPECTED_SHA256) throw new Error(`Poster SHA-256 mismatch: ${sha256}`);
if (!isJpeg) throw new Error("Poster JPEG magic bytes are invalid");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, bytes);
console.log(`Verified poster: ${bytes.length} bytes, sha256=${sha256}`);
