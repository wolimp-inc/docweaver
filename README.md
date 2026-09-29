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

### Publicação em um subcaminho

Use `publicPath` quando a documentação for servida em um subcaminho. Ele prefixa os links de assets, versões e navegação; os arquivos continuam sendo gravados diretamente em `outputPath`. `baseURL` deve incluir o mesmo subcaminho para gerar URLs canônicas e o sitemap.

```js
await buildDocs({
  docsPath: "./docs",
  outputPath: "./public",
  title: "Minha documentação",
  publicPath: "/core/docs",
  baseURL: "https://exemplo.com/core/docs",
  faviconPath: "/core/docs/icons"
});
```

`faviconPath` é opcional e aponta para o diretório público que contém os arquivos de ícone usados pelo tema padrão. Sem ele, o template não inclui links para ícones. O gerador cria JSON-LD básico para cada página; para substituí-lo, passe `structuredDataJson` em `viewVariables` como objeto ou string JSON.

### Tema personalizado

`themePath` aceita o diretório de um tema que contém `docs-layout.eta.htm` ou o caminho de um arquivo de template Eta. Quando `null` ou omitido, usa `themes/default` do próprio pacote.

```js
await buildDocs({
  docsPath: "./docs",
  outputPath: "./public",
  themePath: "./meu-tema",
  viewVariables: {
    organization: "Minha empresa",
    links: { home: "https://exemplo.com" }
  }
});
```

As propriedades de `viewVariables` ficam disponíveis diretamente em `it` em todas as páginas do template. Por exemplo, use `<%= it.organization %>` e `<%= it.links.home %>`. Os valores internos do Docweaver, como `title`, `contentHtml` e `version`, têm precedência em caso de nomes repetidos.

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
