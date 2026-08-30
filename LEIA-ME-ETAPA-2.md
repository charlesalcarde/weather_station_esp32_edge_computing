# Web v3.4 — Etapa 2: Histórico

## Índice

- [Objetivo](#objetivo)
- [Arquivos alterados](#arquivos-alterados)
- [Arquivo novo no Cloud](#arquivo-novo-no-cloud)
- [Ordem de implantação](#ordem-de-implantação)

## Objetivo

Implementar e homologar `GET /api/historico` mantendo `/api/agora`
inalterado.

## Arquivos alterados

```text
web/api/_supabase.js
web/api/historico.js
web/README.md
web/package.json
```

O ZIP contém novamente a pasta `web/` completa para evitar mistura de
versões.

## Arquivo novo no Cloud

```text
cloud/supabase/migrations/04_historico_agregado_v3_4.sql
```

## Ordem de implantação

```text
1. GitHub: atualizar os arquivos do pacote
2. Supabase SQL Editor: executar migração 04
3. Vercel: aguardar redeploy automático
4. testar /api/agora
5. testar /api/historico?periodo=24h
6. testar 7d e 30d
```
