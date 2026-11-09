import { test, expect } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const publisher = fileURLToPath(
  new URL("./publish-static.mjs", import.meta.url),
);

test("publishes compiled assets without deleting unrelated Spring static files", async () => {
  expect(existsSync(publisher)).toBe(true);
  const { publishStatic } = await import("./publish-static.mjs");
  const root = await mkdtemp(
    join(process.env.TMPDIR || tmpdir(), "frontend-publish-"),
  );
  try {
    const dist = join(root, "dist");
    const target = join(root, "static");
    await mkdir(join(dist, "assets"), { recursive: true });
    await mkdir(join(target, "assets"), { recursive: true });
    await writeFile(
      join(dist, "index.html"),
      '<script type="module" src="/assets/index-new.js"></script>',
    );
    await writeFile(join(dist, "assets/index-new.js"), "compiled");
    await writeFile(join(target, "robots.txt"), "preserve");
    await writeFile(join(target, "assets/user.svg"), "preserve asset");
    await writeFile(join(target, "assets/index-old.js"), "stale");
    await writeFile(
      join(target, ".frontend-manifest.json"),
      JSON.stringify(["index.html", "assets/index-old.js"]),
    );
    await publishStatic(dist, target);
    expect(await readFile(join(target, "index.html"), "utf8")).toContain(
      "index-new.js",
    );
    expect(await readFile(join(target, "assets/index-new.js"), "utf8")).toBe(
      "compiled",
    );
    expect(await readFile(join(target, "robots.txt"), "utf8")).toBe("preserve");
    expect(await readFile(join(target, "assets/user.svg"), "utf8")).toBe(
      "preserve asset",
    );
    expect(existsSync(join(target, "assets/index-old.js"))).toBe(false);
    expect(
      JSON.parse(
        await readFile(join(target, ".frontend-manifest.json"), "utf8"),
      ),
    ).toEqual(["assets/index-new.js", "index.html"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
