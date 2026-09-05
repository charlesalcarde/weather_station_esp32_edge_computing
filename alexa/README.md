# Integração da Estação Ambiental com Alexa

## Índice
- [1. Objetivo](#1-objetivo)
- [2. Arquitetura](#2-arquitetura)
- [3. Componentes](#3-componentes)
- [4. Fluxo de uma consulta](#4-fluxo-de-uma-consulta)
- [5. Intents implementados](#5-intents-implementados)
- [6. Sessão conversacional](#6-sessão-conversacional)
- [7. Estrutura da pasta](#7-estrutura-da-pasta)
- [8. Segurança](#8-segurança)
- [9. Validação](#9-validação)
- [10. Resultado](#10-resultado)

## 1. Objetivo

Esta pasta documenta a integração por voz da **Estação Ambiental ESP32** com a Amazon Alexa. A integração foi construída como uma interface Cloud para uma plataforma cujo princípio arquitetural permanece **Edge primeiro; Cloud como extensão**.

A Alexa não se comunica diretamente com o ESP32. A Skill consulta a API Web da estação e apresenta por voz medições e interpretações produzidas pelo sistema.

## 2. Arquitetura

```text
Usuário
   │ voz
   ▼
Alexa / Custom Skill
   │
   ▼
AWS Lambda (Node.js)
   │ HTTPS GET
   ▼
Vercel /api/agora
   │
   ▼
Supabase
   ▲
   │ telemetria
ESP32 + BMP180 + DHT11
```

Essa separação preserva a autonomia do Edge. A indisponibilidade da Alexa não impede o funcionamento local da estação.

## 3. Componentes

- **ESP32:** nó Edge responsável pela aquisição e processamento local.
- **BMP180:** pressão atmosférica e temperatura canônica utilizada na telemetria Cloud.
- **DHT11:** umidade relativa e temperatura auxiliar local.
- **Supabase:** persistência da telemetria.
- **Vercel:** camada Web/API; a Alexa consulta `/api/agora`.
- **AWS Lambda:** backend da Custom Skill.
- **Alexa Custom Skill:** interface conversacional em Português (Brasil), com invocation name `estação ambiental`.

## 4. Fluxo de uma consulta

Exemplo para temperatura:

```text
"Alexa, abra Estação Ambiental"
             │
             ▼
       LaunchRequest
             │
             ▼
"Qual é a temperatura?"
             │
             ▼
     TemperaturaIntent
             │
             ▼
        AWS Lambda
             │
             ▼
GET /api/agora
             │
             ▼
       JSON da estação
             │
             ▼
     resposta falada
```

A Lambda não replica as regras ambientais do firmware. Para estado ambiental e resumo, ela reutiliza os resultados já calculados pela arquitetura da estação.

## 5. Intents implementados

### TemperaturaIntent
Informa a temperatura da estação a partir do campo `temperatura` da API.

### UmidadeIntent
Informa a umidade relativa do ar a partir de `umidade`.

### PressaoIntent
Informa duas grandezas: `pressao_mar`, primeiro, e `pressao_local`, em seguida.

### EstadoIntent
Apresenta a interpretação ambiental produzida pelo Edge, utilizando campos como:

- `estado_geral`
- `estado_umidade`
- `estado_conforto`
- `estado_pressao`
- `instabilidade`
- `anomalia`
- `numero_alertas`

### ResumoIntent
Produz um boletim curto com as principais medições e a síntese interpretativa da estação.

### SobreIntent
Apresenta o próprio projeto: ESP32, sensores, processamento Edge, interface Web, Cloud e integração por voz.

### Intents nativos
`AMAZON.HelpIntent`, `AMAZON.StopIntent`, `AMAZON.CancelIntent` e tratamento de fallback complementam a interação.

## 6. Sessão conversacional

A primeira versão encerrava a sessão após cada resposta (`shouldEndSession: true`). A versão consolidada passou a manter a sessão aberta para os intents de consulta.

Isso permite a interação:

```text
Usuário: Alexa, abra Estação Ambiental.
Alexa:   O que você gostaria de saber?
Usuário: Qual é a temperatura?
Alexa:   A temperatura medida pela estação é...
Usuário: E a umidade?
Alexa:   A umidade relativa do ar é...
Usuário: Me dê um resumo.
Alexa:   ...
Usuário: Cancelar.
Alexa:   Até mais.
```

As respostas abertas incluem `reprompt`. `StopIntent` e `CancelIntent` encerram explicitamente a sessão.

## 7. Estrutura da pasta

```text
alexa/
├── README.md
├── architecture.md
├── setup.md
├── intents.md
├── lambda/
│   └── index.mjs
└── utterances/
    ├── ResumoIntent_enunciados.csv
    └── SobreIntent_enunciados.csv
```

Os arquivos CSV preservados aqui correspondem aos conjuntos gerados durante a etapa final do desenvolvimento. Os intents anteriores foram configurados durante a implementação; seus conjuntos completos de enunciados não são reconstruídos nesta documentação quando não há registro integral dos arquivos originais.

## 8. Segurança

A Lambda acessa apenas a API pública controlada da aplicação Web. Credenciais privilegiadas do Supabase permanecem exclusivamente no ambiente server-side da Vercel e **não devem ser copiadas para a Lambda, Alexa Skill, firmware, navegador ou repositório Git**.

Nenhum segredo deve ser versionado nesta pasta.

## 9. Validação

Durante o desenvolvimento foram validados progressivamente:

1. criação da Custom Skill em Português (Brasil);
2. criação da Lambda em `us-east-1`;
3. associação do Alexa Skills Kit à Lambda;
4. associação do ARN da Lambda ao endpoint da Skill;
5. resposta inicial hardcoded;
6. consulta real à API `/api/agora`;
7. consulta de temperatura em tempo real;
8. consulta de umidade;
9. consulta das pressões local e ao nível do mar;
10. interpretação do estado ambiental;
11. resumo da estação;
12. sessão conversacional aberta;
13. apresentação do projeto por `SobreIntent`;
14. teste bem-sucedido em dispositivo Alexa físico.

## 10. Resultado

A Alexa tornou-se uma nova camada de interface da Estação Ambiental sem transferir para ela a inteligência ambiental do sistema. O ESP32 permanece como nó Edge; Cloud fornece persistência e acesso remoto; e Alexa oferece interação por linguagem natural.

O resultado reforça a arquitetura do projeto:

> **Dashboard local = operacional e resiliente.**  
> **Dashboard Web = histórico e analítico.**  
> **Alexa = interface conversacional.**
