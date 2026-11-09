import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const safeGeneratedPath = (path) =>
  path === "index.html" ||
  /^assets\/[a-zA-Z0-9_-]+\.(?:js|css|svg|png|webp|woff2?)$/.test(path);

// Build in Vite's own dist directory first. Never empty Spring's static tree.
export async function publishStatic(dist, target) {
  const files = ["index.html"];
  for (const entry of await readdir(join(dist, "assets"), {
    withFileTypes: true,
  })) {
    const path = `assets/${entry.name}`;
    if (!entry.isFile() || !safeGeneratedPath(path))
      throw new Error(`Unexpected build asset: ${path}`);
    files.push(path);
  }
  files.sort();
  const index = await readFile(join(dist, "index.html"), "utf8");
  if (!index.includes('type="module"') || index.includes("/src/main.jsx"))
    throw new Error("Expected compiled Vite index.html");
  let previous = [];
  try {
    previous = JSON.parse(
      await readFile(join(target, ".frontend-manifest.json"), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (
    !Array.isArray(previous) ||
    previous.some(
      (path) => typeof path !== "string" || !safeGeneratedPath(path),
    )
  )
    throw new Error("Unsafe generated-file manifest; nothing was changed");
  await mkdir(join(target, "assets"), { recursive: true });
  for (const path of files.filter((path) => path !== "index.html"))
    await copyFile(join(dist, path), join(target, path));
  // Publish the entry point only after its assets are present.
  await copyFile(join(dist, "index.html"), join(target, "index.html"));
  await writeFile(
    join(target, ".frontend-manifest.json"),
    `${JSON.stringify(files, null, 2)}\n`,
  );
  for (const path of previous.filter((path) => !files.includes(path)))
    await rm(join(target, path), { force: true });
  return files;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const here = dirname(fileURLToPath(import.meta.url));
  const files = await publishStatic(
    resolve(here, "../dist"),
    resolve(here, "../../src/main/resources/static"),
  );
  console.log(
    `Published ${files.length} compiled frontend files to Spring static; unrelated files preserved.`,
  );
}
