import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
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
    assert.match(home, /href="\/v1\/index\.htm"[^>]*>\s*Test\s*<\/a>/);
    assert.doesNotMatch(home, /ehecoatl/i);
    assert.doesNotMatch(home, /<link rel="icon"/);
    assert.match(home, /guide\/start\.htm/);
    assert.match(home, /\/assets\/docweaver\/css\/inline-style\.css/);
    const navbarScript = home.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    let onClick;
    let collapsed = false;
    const toggler = {
      getAttribute(name) { return name === "aria-controls" ? "navigation" : null; },
      setAttribute(name, value) { if (name === "aria-expanded" && value === "false") collapsed = true; }
    };
    vm.runInNewContext(navbarScript, {
      window: { addEventListener(name, handler) { if (name === "click") onClick = handler; } },
      document: {
        querySelector(selector) {
          if (selector === "[data-bs-toggle][data-bs-autohide=true][aria-expanded=true]") return toggler;
          if (selector === "#navigation") return { classList: { contains: () => true, remove: () => {} } };
          return null;
        }
      }
    });
    onClick({ target: { closest: () => null } });
    assert.equal(collapsed, true);
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
    const template = path.join(root, "custom.eta.htm");
    await fsp.mkdir(path.join(docsPath, "v1"), { recursive: true });
    await fsp.writeFile(path.join(docsPath, "v1", "README.md"), "# Custom");
    await fsp.writeFile(path.join(docsPath, "v1", "summary.json"), JSON.stringify({ summary: [] }));
    await fsp.writeFile(template, "<html><body><h2><%= it.organization %></h2><a href=\"<%= it.links.home %>\">Home</a><span><%= it.title %></span><script type=\"application/ld+json\"><%~ it.structuredDataJson %></script><%~ it.contentHtml %></body></html>");
    const page = await generate({ docsPath, version: "v1", title: "Test", themePath: template });
    assert.equal(page.render.template, template);
    await buildDocs({
      docsPath,
      outputPath: path.join(root, "public"),
      themePath: template,
      title: "My Docs",
      viewVariables: {
        organization: "Example Co",
        links: { home: "https://example.com" },
        title: "Ignored override",
        structuredDataJson: { "@context": "https://schema.org", "@type": "Organization", name: "Example Co" }
      }
    });
    const html = await fsp.readFile(path.join(root, "public", "v1", "index.htm"), "utf8");
    assert.match(html, /<h1>Custom<\/h1>/);
    assert.match(html, /<h2>Example Co<\/h2>/);
    assert.match(html, /href="https:\/\/example\.com"/);
    assert.match(html, /<span>My Docs<\/span>/);
    assert.equal(JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1]).name, "Example Co");
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("buildDocs prefixes public URLs and renders complex Markdown links and SEO data", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "docweaver-public-"));
  try {
    const docsPath = path.join(root, "docs");
    const outputPath = path.join(root, "public");
    await fsp.mkdir(path.join(docsPath, "v1", "guide"), { recursive: true });
    await fsp.mkdir(path.join(docsPath, "v2"), { recursive: true });
    await fsp.writeFile(path.join(docsPath, "v1", "README.md"),
      "# Welcome\n\n[[Advanced] guide](guide/start.md?mode=full#intro)\n\n[Reference][guide]\n\n[guide]: guide/start.md");
    await fsp.writeFile(path.join(docsPath, "v1", "guide", "start.md"), "# Start");
    await fsp.writeFile(path.join(docsPath, "v2", "README.md"), "# Version 2");
    await fsp.writeFile(path.join(docsPath, "v1", "summary.json"), JSON.stringify({
      summary: [{ label: "Guide", href: "guide/start.md" }]
    }));
    await fsp.writeFile(path.join(docsPath, "v2", "summary.json"), JSON.stringify({ summary: [] }));

    await buildDocs({
      docsPath,
      outputPath,
      title: "Product Docs",
      baseURL: "https://example.com/core/docs",
      publicPath: "/core/docs/",
      faviconPath: "/core/docs/icons"
    });
    const home = await fsp.readFile(path.join(outputPath, "v1", "index.htm"), "utf8");
    assert.match(home, /href="\/core\/docs\/assets\/docweaver\/css\/inline-style\.css"/);
    assert.match(home, /href="\/core\/docs\/v1\/index\.htm"/);
    assert.match(home, /href="\/core\/docs\/v2\/index\.htm"/);
    assert.match(home, /href="\/core\/docs\/v1\/guide\/start\.htm"/);
    assert.match(home, /href="guide\/start\.htm\?mode=full#intro"/);
    assert.match(home, /href="guide\/start\.htm"/);
    assert.doesNotMatch(home, /href="[^"]+\.md(?:[?#"])/);
    assert.match(home, /href="\/core\/docs\/icons\/favicon\.svg"/);
    const jsonLd = home.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)?.[1];
    assert.equal(JSON.parse(jsonLd).url, "https://example.com/core/docs/v1/index.htm");
    assert.equal(JSON.parse(jsonLd).headline, "v1 | Product Docs");
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});
