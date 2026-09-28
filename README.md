# @wolimp/docweaver

Gera documentação HTML estática a partir de arquivos Markdown organizados por versão.

## Instalação

```sh
npm install @wolimp/docweaver
```

## Estrutura de origem

```text
docs/
  v1/
    README.md
    summary.json
    guide/
      start.md
      image.png
```

Exemplo de `summary.json`:

```json
{
  "summary": [
    { "label": "Início", "href": "README.md" },
    { "label": "Guia", "href": "guide/start.md" }
  ]
}
```

## Script de build

```js
// scripts/build-docs.mjs
import { buildDocs } from "@wolimp/docweaver";

const result = await buildDocs({
  docsPath: "./docs",
  outputPath: "./public",
  title: "Minha documentação",
  baseURL: "https://docs.exemplo.com"
});

console.log(`Geradas ${result.pages.length} páginas em ${result.outputPath}`);
```

```json
{
  "scripts": {
    "build:docs": "node scripts/build-docs.mjs"
  }
}
```

O build gera `public/v1/index.htm`, páginas internas em `.htm`, copia arquivos de apoio da documentação e arquivos CSS/JS do tema para `public/assets/docweaver`. `baseURL` é opcional; quando informado, também gera `sitemap.xml`. Use a origem do site como `baseURL`, pois os links do tema são absolutos a partir da raiz do site.

### Tema personalizado

`themePath` aceita o diretório de um tema que contém `docs-layout.e.htm` ou o caminho de um arquivo de template Eta. Quando `null` ou omitido, usa `themes/default` do próprio pacote.

```js
await buildDocs({
  docsPath: "./docs",
  outputPath: "./public",
  themePath: "./meu-tema"
});
```

Para obter o descritor de uma página sem executar o build completo, `generate` aceita o mesmo `themePath`:

```js
import { generate } from "@wolimp/docweaver";

const page = await generate({
  docsPath: "./docs",
  version: "v1",
  title: "Minha documentação",
  sourceFilePath: "README.md",
  themePath: null
});

console.log(page.render.template);
```

O template recebe dados como `contentHtml`, `pageTitle`, `menuTree`, `breadcrumb`, `version`, `versions`, `prevLink` e `nextLink` por meio de `it`. O tema padrão pode servir como referência para os parciais Eta.
