# Arquitetura da integração Alexa

## Índice
- [1. Princípio](#1-princípio)
- [2. Camadas](#2-camadas)
- [3. Responsabilidades](#3-responsabilidades)
- [4. Decisões arquiteturais](#4-decisões-arquiteturais)

## 1. Princípio

A integração segue o princípio **Edge primeiro; Cloud como extensão**. Alexa é uma interface remota e não uma dependência operacional da estação.

## 2. Camadas

```text
[Edge]
ESP32 + BMP180 + DHT11
        │
        ▼
[Cloud/Data]
Supabase
        │
        ▼
[Web/API]
Vercel /api/agora
        │
        ▼
[Voice Backend]
AWS Lambda
        │
        ▼
[Voice UI]
Alexa Custom Skill
```

## 3. Responsabilidades

**Edge:** aquisição, médias, tendências, estados, anomalias e alertas locais.

**Cloud:** persistência e disponibilização remota da telemetria.

**Web/API:** fornece uma interface HTTP controlada para consumo dos dados.

**Lambda:** traduz intents em consultas à API e transforma JSON em respostas naturais.

**Alexa:** reconhecimento da intenção e interface de voz.

## 4. Decisões arquiteturais

A Skill foi implementada como **Custom Skill**, adequada às consultas conversacionais do projeto. Não há comunicação direta Alexa→ESP32. A Lambda não reimplementa regras meteorológicas: campos interpretativos produzidos pelo sistema são reutilizados. A sessão pode permanecer aberta para consultas sucessivas e é encerrada por intents de parada/cancelamento.
