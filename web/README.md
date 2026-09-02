# Dashboard Web — Estação Ambiental v3.4

Camada Web remota da Estação Ambiental ESP32.

> **Dashboard local = operacional e resiliente.**  
> **Dashboard Web = histórico e analítico.**

Fluxo validado:

```text
ESP32 → Supabase → API Vercel → navegador
```

---

## Índice

- [1. Estado atual](#1-estado-atual)
- [2. Estrutura](#2-estrutura)
- [3. Endpoint Agora](#3-endpoint-agora)
- [4. Endpoint Histórico](#4-endpoint-histórico)
- [5. Resolução temporal](#5-resolução-temporal)
- [6. Migração necessária no Supabase](#6-migração-necessária-no-supabase)
- [7. Segurança](#7-segurança)
- [8. Variáveis de ambiente](#8-variáveis-de-ambiente)
- [9. Testes](#9-testes)
- [10. Endpoint Resumo](#10-endpoint-resumo)
- [11. Próximas etapas](#11-próximas-etapas)

---

## 1. Estado atual

Homologado:

```text
GET /api/agora
```

Implementado nesta etapa:

```text
GET /api/historico
```

Ainda reservado:

```text
GET /api/resumo
```

A página inicial continua sendo uma interface mínima de diagnóstico.
O dashboard histórico definitivo será construído depois da homologação
da camada de dados.

---

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

A Etapa 2 também adiciona ao repositório:

```text
cloud/
└── supabase/
    └── migrations/
        └── 04_historico_agregado_v3_4.sql
```

---

## 3. Endpoint Agora

### `GET /api/agora`

Permanece inalterado em relação à versão homologada.

Exemplo:

```text
/api/agora
```

Responsabilidade:

```text
estado atual
├── medições locais
├── estados Edge
├── conectividade
└── referência Open-Meteo
```

---

## 4. Endpoint Histórico

### Consultas prontas

```text
/api/historico?periodo=24h
/api/historico?periodo=7d
/api/historico?periodo=30d
```

Consulta personalizada:

```text
/api/historico?inicio=2026-08-01&fim=2026-08-30
```

Opcionalmente:

```text
/api/historico?estacao=EA-0001&periodo=7d
```

Nesta etapa, por segurança, a API somente aceita a estação configurada
em `ESTACAO_ID`.

### Estrutura de resposta

```json
{
  "estacao": "EA-0001",
  "periodo": {
    "tipo": "7d",
    "inicio": "2026-08-23T22:00:00.000Z",
    "fim": "2026-08-30T22:00:00.000Z"
  },
  "resolucao": "15min",
  "intervalo_minutos": 15,
  "fuso_dos_timestamps": "UTC",
  "amostras_brutas": 10080,
  "pontos": 672,
  "dados": [
    {
      "timestamp": "2026-08-23T22:00:00+00:00",
      "temperatura": 22.4,
      "umidade": 58.1,
      "pressao_mar": 1014.3,
      "pressao_local": 935.0,
      "ponto_orvalho": 13.6,
      "externo_temperatura": 23.0,
      "externo_umidade": 56.0,
      "externo_pressao_mar": 1013.8,
      "amostras": 15
    }
  ]
}
```

Os timestamps são entregues em UTC. O frontend será responsável por
formatá-los no fuso de exibição da estação/usuário.

---

## 5. Resolução temporal

A resolução é escolhida automaticamente segundo a duração da consulta.

| Duração | Resolução | Intervalo |
|---|---|---:|
| até 24 h | `1min` | 1 minuto |
| até 7 dias | `15min` | 15 minutos |
| até 31 dias | `1h` | 60 minutos |
| acima de 31 dias | `1d` | 1 dia |

O período máximo aceito por uma única consulta é de 365 dias.

A agregação é executada dentro do PostgreSQL/Supabase. Isso evita
transferir todas as leituras brutas para o Vercel antes de gerar os
pontos do gráfico.

---

## 6. Migração necessária no Supabase

Antes de testar `/api/historico`, execute no SQL Editor do Supabase:

```text
cloud/supabase/migrations/04_historico_agregado_v3_4.sql
```

A migração cria:

```text
public.historico_estacao_v34(...)
```

A função:

- agrega os dados diretamente no banco;
- retorna um único objeto JSON;
- aceita buckets de 1 min, 15 min, 1 h e 1 dia;
- limita o período a 365 dias;
- não concede acesso a `anon`;
- não concede acesso a `authenticated`;
- concede execução apenas a `service_role`.

Isso preserva o modelo:

```text
Browser
   ↓
API Vercel
   ↓
função controlada no Supabase
   ↓
public.leituras
```

---

## 7. Segurança

A tabela `public.leituras` não precisa receber uma política pública de
`SELECT`.

A credencial do Supabase permanece somente nas funções server-side do
Vercel.

Nunca publicar:

```text
SUPABASE_SERVICE_ROLE_KEY
```

em:

- GitHub;
- firmware;
- `index.html`;
- `src/main.js`;
- qualquer JavaScript entregue ao navegador.

---

## 8. Variáveis de ambiente

No Vercel:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ESTACAO_ID
```

Instalação atual:

```text
ESTACAO_ID=EA-0001
```

Nenhuma variável nova foi adicionada nesta etapa.

---

## 9. Testes

Depois do commit no GitHub e do redeploy automático do Vercel, testar
nesta ordem:

```text
/api/agora
```

O endpoint já homologado deve continuar funcionando.

Depois:

```text
/api/historico?periodo=24h
```

Em seguida:

```text
/api/historico?periodo=7d
```

E:

```text
/api/historico?periodo=30d
```

Resultado esperado:

```text
HTTP 200
dados = array
pontos > 0
amostras_brutas > 0
```

---

## 10. Endpoint Resumo

`/api/resumo` continua retornando HTTP `501`.

Será a próxima camada analítica:

```text
mínimo
média
máximo
amplitude
```

---

## 11. Próximas etapas

Após homologar `/api/historico`:

```text
1. implementar /api/resumo
2. criar gráficos históricos
3. criar filtros Hoje / 24 h / 7 dias / 30 dias
4. criar período personalizado
5. comparar Estação × Open-Meteo
6. incorporar eventos Cloud
7. evoluir análises ambientais
```


---

## Etapa 3 — Endpoint de resumo analítico

Implementado:

```text
GET /api/resumo
```

Consultas:

```text
/api/resumo?periodo=24h
/api/resumo?periodo=7d
/api/resumo?periodo=30d
/api/resumo?inicio=2026-08-01&fim=2026-08-30
```

A migração necessária é:

```text
cloud/supabase/migrations/05_resumo_estatistico_v3_4.sql
```

O endpoint retorna mínimo, média e máximo das variáveis principais.
Para temperatura e pressão também retorna amplitude:

$$
A = x_{max} - x_{min}
$$

A agregação estatística é executada no PostgreSQL/Supabase, preservando
o modelo de segurança em que o navegador consulta apenas a API Vercel.


---

## Etapa 4 — Dashboard Web

A Etapa 4 transforma a página de diagnóstico em um dashboard remoto
histórico e analítico.

### Funcionalidades

```text
Agora
├── status
├── temperatura
├── umidade
├── pressão
├── ponto de orvalho
├── tendência
├── estado geral
└── RSSI

Histórico
├── 24 h
├── 7 dias
└── 30 dias

Gráficos
├── temperatura
├── umidade
├── pressão ao nível do mar
└── ponto de orvalho

Resumo
├── mínimo
├── média
├── máximo
└── amplitude

Comparação
└── Estação × Open-Meteo
```

Os gráficos são produzidos no frontend com Chart.js e consomem somente
os endpoints já homologados:

```text
/api/agora
/api/historico
/api/resumo
```

Nenhuma nova migração de banco é necessária nesta etapa.


---

## Etapa 5 — Histórico avançado, identidade e tema

### Índice da etapa

- [Períodos](#períodos)
- [Séries e diferenças](#séries-e-diferenças)
- [Identidade da estação](#identidade-da-estação)
- [Tema claro e escuro](#tema-claro-e-escuro)
- [Banco de dados](#banco-de-dados)

### Períodos

O dashboard passa a oferecer 24 h, 7 dias, 30 dias, mês atual e intervalo personalizado.
O intervalo personalizado reutiliza o suporte já existente a `inicio` e `fim` em `/api/historico` e `/api/resumo`.

### Séries e diferenças

É possível mostrar ou ocultar Estação e Open-Meteo nos gráficos comparativos. A etapa também acrescenta séries temporais de diferença.

A diferença é definida por:

$$
\Delta = x_{estacao} - x_{OpenMeteo}
$$

Foram incluídos gráficos de $\Delta$ para temperatura, umidade e pressão ao nível do mar.

### Identidade da estação

O cabeçalho apresenta código, nome, localização e altitude obtidos da API atual. A localização exibida usa o campo de localidade da referência externa configurada para a estação.

### Tema claro e escuro

O tema respeita a preferência do sistema na primeira visita e armazena a escolha explícita em `localStorage`.

### Banco de dados

Nenhuma nova migração SQL é necessária para a Etapa 5.


---

## Revisão final da Etapa 5

A revisão final acrescenta:

- logotipo no cabeçalho;
- atualização automática do estado atual a cada 60 segundos;
- contador regressivo para a próxima leitura Web;
- atualização automática dos gráficos e do resumo a cada 5 minutos;
- atualização imediata pelo botão `Atualizar`;
- atualização ao retornar para uma aba que ficou em segundo plano;
- remoção do bloco de diagnóstico técnico da interface pública.

A página não é recarregada. Apenas os dados necessários são consultados
novamente pelas APIs já homologadas.

Nenhuma alteração em firmware, Supabase ou migrações SQL é necessária.

## Revisão de UX/UI — identidade e explicabilidade

A interface Web passou a priorizar a identidade **Estação Ambiental Experimental** em lugar do rótulo técnico "Dashboard Web v3.4".

Principais objetivos da revisão:

- comunicar explicitamente que o projeto é baseado em **Computação de Borda (Edge Computing)**;
- destacar que aquisição, médias, tendências, conversões, estados ambientais e detecção de eventos são realizados localmente no ESP32;
- explicar que a Cloud amplia o sistema, mas não executa o processamento ambiental principal;
- informar que as medições atuais representam o microambiente interno/isolado em que a estação está instalada;
- diferenciar dados **medidos pelos sensores**, informações **calculadas no Edge** e indicadores de **conectividade**;
- explicar grandezas e conceitos por meio de botões `i` e modais contextuais;
- contextualizar a **Open-Meteo** como fonte meteorológica externa de referência;
- manter a versão `v3.4` apenas como metadado técnico discreto no rodapé.

A revisão é estritamente de frontend/UX e não altera as APIs, o banco Supabase ou o firmware homologado.
