# Intents da Estação Ambiental

## Índice
- [1. Intents de consulta](#1-intents-de-consulta)
- [2. Intents de síntese e apresentação](#2-intents-de-síntese-e-apresentação)
- [3. Intents nativos](#3-intents-nativos)
- [4. Dados consumidos](#4-dados-consumidos)

## 1. Intents de consulta

| Intent | Função |
|---|---|
| `TemperaturaIntent` | Temperatura canônica da estação |
| `UmidadeIntent` | Umidade relativa do ar |
| `PressaoIntent` | Pressão ao nível do mar e pressão local |
| `EstadoIntent` | Interpretação ambiental calculada pelo sistema |

## 2. Intents de síntese e apresentação

| Intent | Função |
|---|---|
| `ResumoIntent` | Boletim compacto com medições e interpretação |
| `SobreIntent` | Apresentação falada da arquitetura e do objetivo da estação |

Os enunciados preservados para `ResumoIntent` e `SobreIntent` estão em `utterances/`.

## 3. Intents nativos

- `AMAZON.HelpIntent`: explica o que pode ser perguntado.
- `AMAZON.StopIntent`: encerra a sessão.
- `AMAZON.CancelIntent`: encerra a sessão.
- `AMAZON.FallbackIntent`: orienta quando uma pergunta não é reconhecida, se habilitado no interaction model.

## 4. Dados consumidos

A Lambda consulta `https://estacao-ambiental-chacaval.vercel.app/api/agora`.

Principais campos usados:

```text
temperatura
umidade
pressao_mar
pressao_local
estado_geral
estado_umidade
estado_conforto
estado_pressao
instabilidade
anomalia
numero_alertas
```

A Lambda deve apresentar os resultados do sistema e evitar duplicar no backend de voz as regras de classificação já pertencentes à arquitetura Edge.
