import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const sourcePath = resolve(webRoot, "src/sharePosterTemplate.ts");
const outputPath = resolve(webRoot, "public/share-poster-template.webp");

const source = await readFile(sourcePath, "utf8");
const match = source.match(/data:image\/webp;base64,([^\"]+)/);

if (!match) {
  throw new Error("Could not find embedded share poster template");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(match[1], "base64"));
console.log(`Materialized share poster: ${outputPath}`);
