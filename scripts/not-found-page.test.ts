import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("not-found page", () => {
  let outputDirectory = "";
  let notFoundHtml = "";

  beforeAll(async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), "ai-stats-404-"));
    const build = Bun.spawn(
      ["bun", "run", "build", "--", "--outDir", outputDirectory],
      {
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
  }, 60_000);

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
