import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildDocs, generate, resolveTemplate } from "@wolimp/docweaver";

test("buildDocs generates importable static docs and uses the default theme", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "docweaver-"));
  try {
    const docsPath = path.join(root, "docs");
    const outputPath = path.join(root, "public");
    await fsp.mkdir(path.join(docsPath, "v1", "guide"), { recursive: true });
    await fsp.writeFile(path.join(docsPath, "v1", "README.md"), "# Welcome\n\n[Guide](guide/start.md)");
    await fsp.writeFile(path.join(docsPath, "v1", "guide", "start.md"), "# Start\n\n**Ready**");
    await fsp.writeFile(path.join(docsPath, "v1", "guide", "image.png"), "image");
    await fsp.writeFile(path.join(docsPath, "v1", "summary.json"), JSON.stringify({
      summary: [{ label: "Guide", href: "guide/start.md" }]
    }));

    const page = await generate({ docsPath, version: "v1", title: "Test", sourceFilePath: "README.md", themePath: null });
    assert.equal(page.render.template, resolveTemplate(null));
    const result = await buildDocs({ docsPath, outputPath, baseURL: "https://example.com/docs", title: "Test" });
    assert.equal(result.pages.length, 2);
    const home = await fsp.readFile(path.join(outputPath, "v1", "index.htm"), "utf8");
    assert.match(home, /<h1>Welcome<\/h1>/);
    assert.match(home, /guide\/start\.htm/);
    assert.match(home, /\/assets\/docweaver\/css\/inline-style\.css/);
    assert.match(await fsp.readFile(path.join(outputPath, "v1", "guide", "start.htm"), "utf8"), /<strong>Ready<\/strong>/);
    assert.equal(await fsp.readFile(path.join(outputPath, "v1", "guide", "image.png"), "utf8"), "image");
    assert.match(await fsp.readFile(path.join(outputPath, "sitemap.xml"), "utf8"), /start\.htm/);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("generate accepts a custom template file", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "docweaver-theme-"));
  try {
    const docsPath = path.join(root, "docs");
    const template = path.join(root, "custom.e.htm");
    await fsp.mkdir(path.join(docsPath, "v1"), { recursive: true });
    await fsp.writeFile(path.join(docsPath, "v1", "README.md"), "# Custom");
    await fsp.writeFile(path.join(docsPath, "v1", "summary.json"), JSON.stringify({ summary: [] }));
    await fsp.writeFile(template, "<html><body><%~ it.contentHtml %></body></html>");
    const page = await generate({ docsPath, version: "v1", title: "Test", themePath: template });
    assert.equal(page.render.template, template);
    await buildDocs({ docsPath, outputPath: path.join(root, "public"), themePath: template });
    assert.match(await fsp.readFile(path.join(root, "public", "v1", "index.htm"), "utf8"), /<h1>Custom<\/h1>/);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});
