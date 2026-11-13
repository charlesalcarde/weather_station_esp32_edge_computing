# Processamento Edge — referência histórica

> **Documento consolidado em novembro de 2026.** A referência técnica canônica é [Processamento Edge da Estação Ambiental ESP32](09-processamento-edge.md). Este arquivo permanece no mesmo endereço para preservar links e referências anteriores.

## Índice

- [1. Documento canônico](#1-documento-canônico)
- [2. Conteúdo preservado](#2-conteúdo-preservado)
- [3. Critérios de interpretação](#3-critérios-de-interpretação)

## 1. Documento canônico

Consultar [`docs/09-processamento-edge.md`](09-processamento-edge.md) para a descrição atual de aquisição, validação, organização temporal, estados, alertas, eventos, fórmulas e operação independente da Cloud.

## 2. Conteúdo preservado

Antes da consolidação, este arquivo apresentava praticamente a mesma estrutura de 30 seções do documento canônico, com uma variante editorial das fórmulas. A comparação de conteúdo confirmou que os temas e as relações matemáticas continuam documentados no arquivo 09:

| Tema | Referência canônica |
| --- | --- |
| Classificação ambiental por limiares | [Seção 14](09-processamento-edge.md#14-classificação-ambiental) |
| Histerese temporal e tempo de confirmação | [Seção 15](09-processamento-edge.md#15-histerese-temporal) |
| Estado de umidade por faixas | [Seção 16](09-processamento-edge.md#16-estado-de-umidade) |
| Conforto por temperatura e umidade | [Seção 17](09-processamento-edge.md#17-estado-de-conforto) |
| Detecção de anomalias por limites | [Seção 19](09-processamento-edge.md#19-detecção-de-anomalias) |
| TinyML como evolução futura | [Seção 28](09-processamento-edge.md#28-preparação-para-tinyml) |

O arquivo 09 usa equações LaTeX compatíveis com o Markdown do GitHub, em lugar da variante de equações apresentadas em blocos de texto neste documento histórico.

O histórico completo das redações anteriores permanece recuperável no Git e na PR de consolidação. Nenhum arquivo de firmware foi modificado nessa operação.

## 3. Critérios de interpretação

As fórmulas genéricas descrevem **modelos conceituais**; seus limiares e estados concretos precisam ser verificados no firmware efetivamente utilizado. O processamento ambiental Edge, a persistência/replay experimental EXP04c/EXP04d e o laboratório de simulação M5 são funcionalidades diferentes.

Consultar também [Firmware](04-firmware.md), [M4 — Resiliência](metricas/04-resiliencia.md) e [Dashboard Web e Cloud](15-dashboard-web-cloud.md).
