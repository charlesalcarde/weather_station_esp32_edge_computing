# Estação Ambiental ESP32 — v3.6.1

## Índice

- [Objetivo](#objetivo)
- [Alteração desta versão](#alteração-desta-versão)
- [Fluxo de atualização](#fluxo-de-atualização)
- [Estrutura](#estrutura)

## Objetivo

A versão **3.6.1** complementa a v3.6 habilitando de forma segura o
recebimento de uma imagem **LittleFS por OTA**.

## Alteração desta versão

Quando `ArduinoOTA` identifica uma atualização de filesystem:

1. o firmware detecta que o comando OTA não é `U_FLASH`;
2. desmonta o LittleFS com `LittleFS.end()`;
3. permite a gravação da nova imagem do filesystem;
4. após sucesso, o ESP32 reinicia normalmente;
5. se houver erro de OTA, o firmware tenta remontar o LittleFS sem formatá-lo.

A v3.6.1 não altera o conteúdo funcional do dashboard v3.6. Os arquivos da
pasta `data/` são justamente a versão do dashboard a ser enviada no primeiro
teste de LittleFS OTA.

## Fluxo de atualização

```text
Primeiro:
v3.6 -> OTA de firmware -> v3.6.1

Depois:
data/ -> imagem LittleFS -> OTA de filesystem -> partição LittleFS
```

## Estrutura

```text
EstacaoAmbiental_v3_6_1/
├── EstacaoAmbiental_v3_6_1.ino
├── partitions.csv
└── data/
    ├── index.html
    ├── style.css
    ├── app.js
    └── favicon.png
```
