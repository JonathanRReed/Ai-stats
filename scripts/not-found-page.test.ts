import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

describe("not-found page", () => {
  let outputDirectory = "";
  let notFoundHtml = "";

  beforeAll(async () => {
    // Astro moves assets from .astro with rename(), so the output must share
    // the project's filesystem even when the system temp directory does not.
    const temporaryRoot = fileURLToPath(new URL("../.tmp/", import.meta.url));
    await mkdir(temporaryRoot, { recursive: true });
    outputDirectory = await mkdtemp(join(temporaryRoot, "ai-stats-404-"));
    const build = Bun.spawn(
      // This fixture checks the recovery page without data credentials. Keep it
      // isolated from the production artifact and its populated-data gate.
      ["bun", "--bun", "run", "astro", "build", "--outDir", outputDirectory],
      {
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      build.exited,
      new Response(build.stdout).text(),
      new Response(build.stderr).text(),
    ]);

    expect(
      exitCode,
      `Astro build failed.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    ).toBe(0);

    notFoundHtml = await readFile(join(outputDirectory, "404.html"), "utf8");
    // A full Astro build. Slower machines and cold caches need more than a minute.
  }, 180_000);

  afterAll(async () => {
    if (outputDirectory) {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("builds a dedicated noindex recovery page for unknown URLs", () => {
    expect(notFoundHtml).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(notFoundHtml.match(/<h1\b/gi)).toHaveLength(1);
    expect(notFoundHtml).toContain('href="/"');
    expect(notFoundHtml).toContain('href="/compare"');
  });

  test("does not preload an image the recovery page never renders", () => {
    expect(notFoundHtml).not.toContain(
      '<link rel="preload" href="/jonathan.avif" as="image"',
    );
  });
});
