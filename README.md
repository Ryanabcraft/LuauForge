# LuauForge — Developer Toolkit for Lua & Luau

Toolkit profissional, bonito e 100% client-side para desenvolvedores Lua/Luau. Loaders, formatação, minify, encoders, generators (Color3/UDim2/Vector/CFrame/TweenInfo), inspector e snippet library — tudo rodando no navegador, sem backend.

**Live demo:** hospede via GitHub Pages (ver instruções abaixo).

![LuauForge](assets/logo.svg)

---

## Features

- **Loadstring Generator** — `game:HttpGet` com pcall, retry, cache-bypass e fallback multi-URL
- **Multi-URL Loader** — tenta URLs em sequência
- **Lua Formatter** — indentação inteligente, tabs/spaces, preserva strings/comentários
- **Minifier** — remove comentários/espaços/linhas, modo compacto + métricas
- **String Escaper** — aspas simples/duplas, sequências `\n \t`
- **String.char Generator** — `string.char(72,105)` ↔ texto
- **Base64** — encode/decode UTF-8
- **HEX** — text ↔ hex
- **URL Encoder** — `encodeURIComponent` / `decodeURIComponent`
- **JSON ↔ Lua Table** — `{ name = "Ryan" }` ↔ JSON
- **Identifier Generator** — prefixo/tamanho/quantidade
- **UUID v4** — em lote
- **Hash** — SHA-1/256/384/512 via Web Crypto
- **Color3 Generator** — picker + `Color3.fromRGB` / `Color3.new`
- **UDim2 Builder** — presets Center/FullScreen/TopLeft/BottomRight
- **Vector Generator** — Vector2/Vector3
- **CFrame Generator** — `CFrame.new(x,y,z)`
- **TweenInfo Generator** — EasingStyle/Direction/Repeat/Reverses/Delay
- **Services Generator** — checkbox → `game:GetService`
- **Script Inspector** — linhas, funções, URLs, services, requires (sem executar)
- **URL Extractor** — URLs únicas
- **Service Extractor** — `GetService` list
- **Snippet Library** — 13 snippets (basics, UI, networking, debug)

Extras: busca global (`Ctrl+K`), favoritos/recentes em `localStorage`, settings (tema/accent/font/tab), copy com toast, modals, atalhos (`Ctrl+Enter`, `Ctrl+Shift+C`), hash routing (sem 404 no Pages), PWA (`manifest` + `service-worker`), SEO/OG tags, dark mode premium (#080A0F).

---

## Rodar localmente

Sem build. É um site estático.

```bash
# opção 1 — só abrir o arquivo
start index.html

# opção 2 — servidor estático (recomendado para PWA/SW)
npx serve .
# ou
python -m http.server 8000
```

Acesse `http://localhost:8000` ou `http://localhost:3000`.

---

## Publicar no GitHub Pages

1. Crie um repositório e faça push de todos os arquivos (mantenha `index.html` na raiz).
2. No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Selecione branch `main` e pasta `/ (root)` → **Save**.
4. Aguarde o deploy. A URL será `https://SEUUSER.github.io/SEU-REPO/`.

O site usa **hash routing** (`#/loadstring`), então refresh e links diretos não dão 404.

Se o repositório não estiver na raiz do domínio e assets falharem, mantenha todos os caminhos **relativos** (`./css/...`, `./js/...`) — já configurado.

---

## Estrutura do projeto

```
/
├── index.html
├── manifest.json
├── service-worker.js
├── robots.txt
├── sitemap.xml
├── css/
│   ├── variables.css
│   ├── base.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── router.js
│   ├── storage.js
│   ├── ui.js
│   └── tools/
│       ├── registry.js
│       ├── snippets-data.js
│       ├── loadstring.js
│       ├── formatter.js
│       ├── minifier.js
│       ├── encoders.js
│       ├── generators.js
│       ├── inspector.js
│       └── snippets.js
└── assets/
    └── logo.svg
```

---

## Como adicionar nova ferramenta

1. Crie `js/tools/minhaTool.js` exportando `renderMinhaTool(container)`.
2. Registre em `js/tools/registry.js` (`TOOLS`).
3. Adicione a rota em `js/app.js` (`ROUTES`) e o item em `NAV`.
4. Siga o padrão: título + descrição + input + opções + output + Generate/Copy/Clear + `container._getOutput`.

---

## Contributing

PRs bem-vindos. Mantenha: vanilla JS, CSS variables, componentes reutilizáveis (`css/components.css:1`, `js/ui.js:1`), tratamento de erros sem quebrar a página, e processamento sempre local.

---

## License

MIT — use livremente.

---

## Melhorias futuras (opcional)

- Monaco/CodeMirror para syntax highlight e fullscreen
- Formatter com parser completo (luaparse) via CDN leve
- UDim2/CFrame com preview visual interativo
- Exportar loaders como arquivo `.lua`
- Testes unitários para encoders/formatter
- i18n (pt/en)
- Temas claro/escuro com `prefers-color-scheme`
