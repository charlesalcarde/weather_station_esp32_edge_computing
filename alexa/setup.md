# Configuração da Alexa e AWS Lambda

## Índice
- [1. Alexa Developer Console](#1-alexa-developer-console)
- [2. AWS Lambda](#2-aws-lambda)
- [3. Ligação Skill–Lambda](#3-ligação-skilllambda)
- [4. Deploy](#4-deploy)
- [5. Teste](#5-teste)

## 1. Alexa Developer Console

Configuração utilizada no projeto:

- Skill: **Estação Ambiental**
- Locale: **Portuguese (BR)**
- Experience: Other
- Model: Custom
- Hosting: Provide your own
- Template inicial: Start from scratch
- Invocation name: **estação ambiental**

Crie os intents descritos em `intents.md`, adicione seus sample utterances e execute **Build Skill** após as alterações do interaction model.

## 2. AWS Lambda

Configuração utilizada:

- Região: **US East (N. Virginia) — us-east-1**
- Runtime: **Node.js 24.x**
- Função: `estacao-ambiental-alexa`
- Arquitetura: padrão x86_64
- Execution role: role básica da Lambda

O código está em `lambda/index.mjs`.

## 3. Ligação Skill–Lambda

Na Lambda, adicione o trigger **Alexa Skills Kit** e habilite a verificação pelo Skill ID da própria Skill.

No Alexa Developer Console, em **Endpoint**, selecione **AWS Lambda ARN** e informe o ARN da função na região correspondente.

Não versione ARN, IDs de conta ou credenciais desnecessárias na documentação pública.

## 4. Deploy

Após alterar `index.mjs`, faça o deploy da função Lambda. Alterações apenas no código da Lambda não exigem recriar o endpoint ou o trigger.

Quando houver alteração nos intents/enunciados, salve o interaction model e execute novamente **Build Skill**.

## 5. Teste

Fluxo recomendado:

```text
Alexa, abra Estação Ambiental.
Qual é a temperatura?
E a umidade?
Qual é a pressão?
Como está o ambiente?
Me dê um resumo.
O que é a Estação Ambiental?
Cancelar.
```

A integração foi validada em dispositivo Alexa físico.
