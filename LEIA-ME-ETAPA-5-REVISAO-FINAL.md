# Dashboard Web v3.4 — Etapa 5 — Revisão final

## Índice

- [Objetivo](#objetivo)
- [Alterações](#alterações)
- [Arquivos a substituir](#arquivos-a-substituir)
- [Arquivos que permanecem](#arquivos-que-permanecem)
- [Como validar](#como-validar)
- [Critério de homologação](#critério-de-homologação)

## Objetivo

Concluir a Etapa 5 com atualização automática, identidade visual e limpeza
da interface de homologação.

## Alterações

- logotipo da estação no cabeçalho;
- estado atual atualizado automaticamente a cada 60 s;
- contador regressivo;
- gráficos e resumo atualizados automaticamente a cada 5 min;
- botão manual `Atualizar` mantido;
- modo claro/escuro preservado;
- favicon preservado;
- diagnóstico técnico removido da interface;
- APIs e arquitetura Cloud permanecem inalteradas.

## Arquivos a substituir

```text
web/index.html
web/src/main.js
web/src/style.css
web/README.md
web/package.json
```

Os arquivos de favicon já existentes em `web/public/` podem ser mantidos.

## Arquivos que permanecem

```text
web/api/_supabase.js
web/api/agora.js
web/api/historico.js
web/api/resumo.js
web/public/favicon.png
web/public/favicon-v345.png
web/public/favicon.ico
```

Não há nova migração SQL.

## Como validar

1. Abrir o dashboard e confirmar o logotipo.
2. Confirmar o contador `Próxima atualização em ... s`.
3. Aguardar 60 s e verificar mudança da leitura sem recarregar a página.
4. Clicar em `Atualizar` e confirmar atualização imediata.
5. Verificar que o período selecionado não muda após atualização automática.
6. Confirmar atualização dos gráficos/resumo após 5 min.
7. Testar modo claro e escuro.
8. Confirmar que `Diagnóstico técnico` não aparece mais.
9. Testar `24 h`, `7 dias`, `30 dias`, `Mês atual` e `Personalizado`.

## Critério de homologação

A Etapa 5 pode ser homologada quando todos os testes acima forem concluídos
sem regressão das funções já validadas nas Etapas 1 a 4.
