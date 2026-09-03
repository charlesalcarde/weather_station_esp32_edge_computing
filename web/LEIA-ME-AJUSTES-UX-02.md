# Ajustes UX — cidade dinâmica, alinhamento e hardware

Pacote incremental da plataforma Web da Estação Ambiental Experimental.

## Índice

- [1. Cidade dinâmica no contexto da medição](#1-cidade-dinâmica-no-contexto-da-medição)
- [2. Alinhamento Local × Externo](#2-alinhamento-local--externo)
- [3. Modal de hardware](#3-modal-de-hardware)
- [4. Arquivos alterados](#4-arquivos-alterados)
- [5. Validações realizadas](#5-validações-realizadas)
- [6. Implantação](#6-implantação)

## 1. Cidade dinâmica no contexto da medição

A expressão antes fixa em Campinas passa a utilizar a localidade recebida de `/api/agora` em `externo.local`.

A interface extrai o nome da cidade e atualiza tanto o aviso visível de contexto quanto o modal explicativo das medições locais.

## 2. Alinhamento Local × Externo

Os dois quadros de origem da seção **Estação × Open-Meteo** passam a usar uma grade estável, mantendo:

- `Local — ESP32 + sensores`;
- o símbolo `×`;
- `Externo — Open-Meteo`.

Os cartões ficam alinhados horizontalmente em telas largas e continuam responsivos em telas menores.

## 3. Modal de hardware

Foi incluído um botão de informação junto a **ESP32 + sensores**.

O modal apresenta:

- ESP32 — núcleo de processamento Edge;
- BMP180 — pressão atmosférica e temperatura principal;
- DHT11 — umidade relativa e temperatura auxiliar.

As três imagens possuem fundo transparente para integração com os modos claro e escuro.

## 4. Arquivos alterados

```text
index.html
src/main.js
src/style.css
public/hardware/esp32.png
public/hardware/bmp180.png
public/hardware/dht11.png
LEIA-ME-AJUSTES-UX-02.md
```

As APIs não foram modificadas.

## 5. Validações realizadas

Foram executadas verificações de sintaxe JavaScript com `node --check` nos arquivos do frontend e das APIs.

Também foram comparados os hashes das quatro APIs com o pacote anterior; permanecem idênticas.

O build Vite não foi concluído neste ambiente porque a instalação das dependências excedeu o tempo disponível. A compilação final deve ser validada pelo pipeline da Vercel.

## 6. Implantação

Substitua o conteúdo da pasta `web/` do repositório pelo conteúdo deste pacote, preserve as variáveis de ambiente existentes e deixe a Vercel executar o build/deploy normalmente.

Após o deploy, valide:

1. cidade dinâmica no aviso de contexto;
2. alinhamento dos cartões Local e Externo;
3. abertura do modal pelo ícone `i` ao lado de `ESP32 + sensores`;
4. imagens sem fundo branco nos modos claro e escuro;
5. funcionamento dos gráficos e das APIs sem regressões.
