# Dashboard Web — Estação Ambiental v3.4

Camada Web remota da Estação Ambiental ESP32.

> **Local = operacional e resiliente.**  
> **Web = histórico e analítico.**

Esta primeira entrega implementa o caminho mínimo de leitura:

```text
ESP32 → Supabase → API Vercel → navegador
```

## Índice

- [1. Estado desta etapa](#1-estado-desta-etapa)
- [2. Estrutura](#2-estrutura)
- [3. Endpoint implementado](#3-endpoint-implementado)
- [4. Segurança](#4-segurança)
- [5. Variáveis de ambiente](#5-variáveis-de-ambiente)
- [6. Deploy no Vercel](#6-deploy-no-vercel)
- [7. Teste esperado](#7-teste-esperado)
- [8. Endpoints planejados](#8-endpoints-planejados)
- [9. Próximas etapas](#9-próximas-etapas)

## 1. Estado desta etapa

Implementado: `GET /api/agora`. Ele consulta a leitura mais recente da estação configurada no Supabase. A temperatura Cloud é a canônica do BMP180; a temperatura do DHT11 não é apresentada na Web. A página inicial é apenas diagnóstica e ainda não é o dashboard definitivo.

## 2. Estrutura

```text
web/
├── README.md
├── package.json
├── .gitignore
├── .env.example
├── index.html
├── api/
│   ├── _supabase.js
│   ├── agora.js
│   ├── historico.js
│   └── resumo.js
├── public/
│   └── favicon.png
└── src/
    ├── main.js
    └── style.css
```

`historico.js` e `resumo.js` retornam HTTP `501` enquanto não forem implementados.

## 3. Endpoint implementado

### `GET /api/agora`

O navegador não consulta `public.leituras` diretamente. O endpoint devolve a última leitura e um subconjunto controlado dos dados atuais.

O status é inferido de `created_at`:

```text
menos de 2 min  → online
2 a 5 min       → atraso
mais de 5 min   → offline
```

## 4. Segurança

```text
Browser → API Vercel → Supabase
```

A credencial de leitura permanece somente no ambiente servidor do Vercel. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em HTML, JavaScript do navegador, firmware, GitHub ou `.env.example`.

A Service Role possui privilégios elevados. Nesta etapa é utilizada apenas pela função server-side, enquanto a API restringe a estação e os campos retornados.

## 5. Variáveis de ambiente

No Vercel configure:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ESTACAO_ID
```

Para a instalação atual:

```text
ESTACAO_ID=EA-0001
```

Não faça commit de `.env` com valores reais.

## 6. Deploy no Vercel

Ao importar o repositório no Vercel, configure `web` como **Root Directory**.

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Cadastre as variáveis de ambiente e execute o deploy.

## 7. Teste esperado

Acesse `https://SEU-DOMINIO.vercel.app/api/agora`. O retorno esperado é um JSON contendo, entre outros, `estacao`, `status`, `temperatura`, `umidade`, `pressao_mar` e `estado_geral`. A página inicial também consulta o endpoint e mostra a resposta completa para diagnóstico.

## 8. Endpoints planejados

```text
GET /api/agora       implementado
GET /api/historico   próxima etapa
GET /api/resumo      etapa seguinte
```

O histórico deverá atender Hoje, 24 h, 7 dias, 30 dias, mês e intervalo personalizado. O resumo deverá produzir mínimo, média, máximo e amplitude do período.

## 9. Próximas etapas

```text
1. homologar acesso Vercel → Supabase
2. implementar /api/historico
3. implementar agregação temporal
4. implementar /api/resumo
5. construir dashboard histórico
6. adicionar comparação Estação × Open-Meteo
7. incorporar eventos Cloud
```
