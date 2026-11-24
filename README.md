# Clareou — site

Cannabis medicinal, com clareza.

Este repositório gera o site do Clareou a partir dos artigos em Markdown da pasta `posts/`. Não precisa instalar nada: só Node 18 ou mais novo.

```
node build.js            # gera o site em dist/
node build.js --preview  # versão para abrir sem servidor
```

## Como funciona

1. A tarefa agendada do Claude escreve 2 artigos por dia e grava cada um em `posts/AAAA-MM-DD-<tipo>-<slug>.md`.
2. Cada novo arquivo enviado ao GitHub dispara o Cloudflare Pages, que roda `node build.js` e publica a pasta `dist/`.
3. Em cerca de um minuto o artigo está no ar, com página própria, feed RSS, sitemap e busca atualizados.

## Estrutura

| Pasta / arquivo | O que é |
|---|---|
| `config.js` | Nome, domínio, e-mail, AdSense, newsletter e formulário de perguntas. É o único arquivo que você precisa editar. |
| `posts/` | Os artigos. Um arquivo `.md` por texto. |
| `paginas/` | Quem somos, política editorial e privacidade. |
| `assets/` | Estilo, logo (favicon) e interações do site. |
| `build.js` | O gerador. |

## Cabeçalho de cada artigo

```
---
titulo: Título forte, até 70 caracteres
linha_fina: Frase que complementa o título
categoria: Ciência & Pesquisa | Cuidado & Rotina | Acesso & Direitos
nivel_de_evidencia: Forte | Moderada | Limitada | Em estudo
data: AAAA-MM-DD
tempo_de_leitura: 6 min
tags: [tag 1, tag 2, tag 3]
meta_descricao: Até 155 caracteres, para o Google
resumo: [frase 1, frase 2, frase 3]   # opcional: vira o "Resumo em 30 segundos"
destaque: sim                         # opcional: entra em "Leituras essenciais"
comece: sim                           # opcional: entra no especial "Comece por aqui"
tipo: nota                            # opcional: vira uma nota rápida no fluxo
---
```

Marque as fontes no texto com `[1]`, `[2]` e liste-as numa seção `## Referências`. O site transforma os números em links para a referência.

## Anúncios (Google AdSense)

1. Depois da aprovação, coloque o código `ca-pub-…` em `adsenseClient` no `config.js`.
2. Crie no AdSense um bloco para cada espaço e cole os códigos em `adsenseSlots`: `topo`, `feed`, `lateral`, `lateralFixo`, `artigo`, `rodape`.
3. O arquivo `ads.txt` é gerado sozinho.
4. Para ver onde os anúncios vão entrar antes disso, use `mostrarEspacosDeAnuncio: true`. Volte para `false` antes de publicar.
