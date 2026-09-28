import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Eta } from "eta";
import { marked } from "marked";
import { generateDocs, resolveTemplate, sitemap } from "./index.mjs";

const defaultTheme = path.resolve(fileURLToPath(new URL("../themes/default/", import.meta.url)));

function htmlHref(href) {
  if (typeof href !== "string") return href;
  return href.replace(/(^|\/)README\.md(?=([?#]|$))/i, "$1index.htm")
    .replace(/\.md(?=([?#]|$))/i, ".htm");
}

function rewriteTree(items) {
  return items.map((item) => ({
    ...item,
    href: htmlHref(item.href),
    children: rewriteTree(item.children ?? [])
  }));
}

function rewriteMarkdownLinks(markdown) {
  return markdown.replace(/(!?\[[^\]]*\]\()([^\s)]+)(\))/g, (match, open, href, close) => {
    if (open.startsWith("!") || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return match;
    const target = htmlHref(href);
    return `${open}${target}${close}`;
  });
}

async function copyAssets(source, destination) {
  await fsp.mkdir(destination, { recursive: true });
  for (const entry of await fsp.readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await fsp.mkdir(to, { recursive: true });
      await copyAssets(from, to);
    } else if (entry.isFile()) {
      await fsp.copyFile(from, to);
    }
  }
}

async function copyDocumentationAssets(source, destination) {
  for (const entry of await fsp.readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await fsp.mkdir(to, { recursive: true });
      await copyDocumentationAssets(from, to);
    } else if (entry.isFile() && !/\.(?:md)$/i.test(entry.name) && entry.name !== "summary.json") {
      await fsp.copyFile(from, to);
    }
  }
}

/** Build static HTML for docsPath/<version>/*.md into outputPath. */
export async function buildDocs({ docsPath, outputPath = "dist", baseURL, title = "Documentation", themePath = null } = {}) {
  if (typeof docsPath !== "string" || !docsPath.trim()) throw new TypeError("docsPath is required");
  if (typeof outputPath !== "string" || !outputPath.trim()) throw new TypeError("outputPath must be a directory path");
  const sourceRoot = path.resolve(docsPath);
  const outputRoot = path.resolve(outputPath);
  const sourceStat = await fsp.stat(sourceRoot);
  if (!sourceStat.isDirectory()) throw new TypeError("docsPath must be a directory");
  if (outputRoot === sourceRoot || sourceRoot.startsWith(`${outputRoot}${path.sep}`) || outputRoot.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error("docsPath and outputPath must be separate directories");
  }

  const templatePath = resolveTemplate(themePath);
  const themeRoot = path.dirname(templatePath);
  const eta = new Eta({ views: themeRoot });
  const versions = (await fsp.readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name }));
  const pages = await generateDocs({ docsPath: sourceRoot, baseURL, title, themePath });
  await fsp.mkdir(outputRoot, { recursive: true });
  await copyAssets(path.join(defaultTheme, "css"), path.join(outputRoot, "assets", "docweaver", "css"));
  await copyAssets(path.join(defaultTheme, "js"), path.join(outputRoot, "assets", "docweaver", "js"));
  if (themeRoot !== defaultTheme) {
    for (const assetType of ["css", "js"]) {
      const assetDirectory = path.join(themeRoot, assetType);
      if ((await fsp.stat(assetDirectory).catch(() => null))?.isDirectory()) {
        await copyAssets(assetDirectory, path.join(outputRoot, "assets", "docweaver", assetType));
      }
    }
  }
  for (const version of versions) {
    await copyDocumentationAssets(path.join(sourceRoot, version.name), path.join(outputRoot, version.name));
  }

  const written = [];
  for (const page of pages) {
    if (page.status !== 200) throw new Error(`${page.targetPath}: ${page.body}`);
    const targetPath = page.targetPath.replace(/^\/+/, "");
    const destination = path.join(outputRoot, ...targetPath.split("/"));
    const view = page.render.view;
    const markdown = await fsp.readFile(view.markdownPath, "utf8");
    const contentHtml = marked.parse(rewriteMarkdownLinks(markdown));
    const pageURL = baseURL ? new URL(page.targetPath.replace(/^\/+/, ""), `${baseURL.replace(/\/+$/, "")}/`).href : "";
    const data = {
      ...view,
      menuTree: rewriteTree(view.menuTree),
      breadcrumb: view.breadcrumb.map((item) => ({ ...item, href: htmlHref(item.href) })),
      prevLink: view.prevLink && { ...view.prevLink, href: htmlHref(view.prevLink.href) },
      nextLink: view.nextLink && { ...view.nextLink, href: htmlHref(view.nextLink.href) },
      contentHtml,
      pageURL,
      outputPath: "/assets/docweaver",
      title,
      description: title,
      version: targetPath.split("/")[0],
      versions
    };
    const html = eta.render(path.basename(page.render.template), data);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.writeFile(destination, html, "utf8");
    written.push(destination);
  }
  if (baseURL) {
    const result = await sitemap(sourceRoot, baseURL);
    if (result.status !== 200) throw new Error(result.body);
    await fsp.writeFile(path.join(outputRoot, "sitemap.xml"), result.body, "utf8");
  }
  return { outputPath: outputRoot, pages: written };
}
