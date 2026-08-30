# Web v3.4 — Etapa 3

## Índice

- [Objetivo](#objetivo)
- [Arquivos alterados](#arquivos-alterados)
- [Migração](#migração)
- [Ordem de implantação](#ordem-de-implantação)

## Objetivo

Implementar `GET /api/resumo`.

## Arquivos alterados

```text
web/api/_supabase.js
web/api/resumo.js
web/README.md
web/package.json
```

## Migração

```text
cloud/supabase/migrations/05_resumo_estatistico_v3_4.sql
```

## Ordem de implantação

```text
1. atualizar GitHub
2. executar migração 05 no Supabase
3. aguardar redeploy automático do Vercel
4. testar /api/agora
5. testar /api/historico?periodo=24h
6. testar /api/resumo?periodo=24h
7. testar 7d e 30d
```
