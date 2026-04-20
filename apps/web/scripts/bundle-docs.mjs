#!/usr/bin/env node
/**
 * Copies repo-level /docs/** into apps/web/src/content/docs/ so Next's standalone build
 * ships them inside the image. Runs before `next build`.
 */
import fs from "node:fs/promises";
import path from "node:path";

const src = path.resolve(process.cwd(), "..", "..", "docs");
const dst = path.resolve(process.cwd(), "src", "content", "docs");

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const e of entries) {
    const fromPath = path.join(from, e.name);
    const toPath = path.join(to, e.name);
    if (e.isDirectory()) {
      await copyDir(fromPath, toPath);
    } else if (e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".png") || e.name.endsWith(".svg"))) {
      await fs.copyFile(fromPath, toPath);
    }
  }
}

try {
  await fs.access(src);
  await fs.rm(dst, { recursive: true, force: true });
  await copyDir(src, dst);
  console.log(`[bundle-docs] copied ${src} → ${dst}`);
} catch (e) {
  console.warn(`[bundle-docs] skipped: ${e.message}`);
}
