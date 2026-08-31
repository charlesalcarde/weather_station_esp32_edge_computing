# Correção do favicon — Etapa 5

## Índice

- [Problema](#problema)
- [Correção](#correção)
- [Teste](#teste)

## Problema

O arquivo `/favicon.png` estava publicado, mas o Chrome pode manter um cache
de favicon separado do cache normal da página. Por isso `Ctrl+F5` nem sempre
força a atualização do ícone da aba.

## Correção

Foram acrescentados:

- `/public/favicon-v345.png`
- `/public/favicon.ico`
- referências com versão (`?v=3451`) no `index.html`

Isso muda a URL efetiva do favicon e força o navegador a buscá-lo novamente.

## Teste

Após o deploy, abra normalmente a raiz do dashboard. Se a aba já estiver
aberta, feche-a e abra uma nova aba para o domínio.
