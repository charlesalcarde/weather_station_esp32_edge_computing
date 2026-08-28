# Arquitetura da Estação Ambiental ESP32

Este documento descreve a arquitetura técnica da **Estação Ambiental
ESP32**, apresentando seus componentes, responsabilidades, fluxos de
dados e a divisão entre processamento local em borda e serviços
externos.

> Documento referente à arquitetura consolidada na fase **v3.4-RC1** do
> projeto.

------------------------------------------------------------------------

## Índice

-   [1. Objetivo da arquitetura](#1-objetivo-da-arquitetura)
-   [2. Visão geral](#2-visão-geral)
-   [3. Princípios arquiteturais](#3-princípios-arquiteturais)
-   [4. Arquitetura em camadas](#4-arquitetura-em-camadas)
    -   [4.1 Camada de aquisição](#41-camada-de-aquisição)
    -   [4.2 Camada de processamento
        Edge](#42-camada-de-processamento-edge)
    -   [4.3 Camada de armazenamento e interface
        local](#43-camada-de-armazenamento-e-interface-local)
    -   [4.4 Camada de conectividade](#44-camada-de-conectividade)
    -   [4.5 Camada de serviços
        externos](#45-camada-de-serviços-externos)
    -   [4.6 Camada Cloud](#46-camada-cloud)
-   [5. Fluxo de dados](#5-fluxo-de-dados)
    -   [5.1 Fluxo local](#51-fluxo-local)
    -   [5.2 Fluxo meteorológico
        externo](#52-fluxo-meteorológico-externo)
    -   [5.3 Fluxo Edge--Cloud](#53-fluxo-edgecloud)
-   [6. Responsabilidades do ESP32](#6-responsabilidades-do-esp32)
-   [7. Processamento de borda](#7-processamento-de-borda)
-   [8. Dashboard local e LittleFS](#8-dashboard-local-e-littlefs)
-   [9. Conectividade e configuração](#9-conectividade-e-configuração)
-   [10. Integração com Open-Meteo](#10-integração-com-open-meteo)
-   [11. Integração com Supabase](#11-integração-com-supabase)
-   [12. Independência entre Edge e
    Cloud](#12-independência-entre-edge-e-cloud)
-   [13. Persistência local](#13-persistência-local)
-   [14. Particionamento da Flash](#14-particionamento-da-flash)
-   [15. Disponibilidade e tolerância a
    falhas](#15-disponibilidade-e-tolerância-a-falhas)
-   [16. Segurança](#16-segurança)
-   [17. Escalabilidade](#17-escalabilidade)
-   [18. Evolução arquitetural](#18-evolução-arquitetural)
-   [19. Relação com Edge Computing](#19-relação-com-edge-computing)
-   [20. Resumo das responsabilidades](#20-resumo-das-responsabilidades)

------------------------------------------------------------------------

## 1. Objetivo da arquitetura

A arquitetura da Estação Ambiental ESP32 foi concebida para utilizar o
microcontrolador como um **nó de computação de borda**, e não apenas
como um dispositivo de aquisição de sensores.

O objetivo é manter o máximo possível da inteligência necessária para a
operação da estação próximo à fonte dos dados.

Assim, o ESP32 é responsável por adquirir, processar, interpretar e
disponibilizar informações ambientais localmente. Serviços externos e
Cloud complementam essa capacidade, principalmente para obtenção de
dados meteorológicos de referência, persistência remota e análise
histórica.

------------------------------------------------------------------------

## 2. Visão geral

A arquitetura pode ser representada de forma simplificada por:

``` text
                        ESTAÇÃO AMBIENTAL

                  ┌───────────────────────┐
                  │       Sensores        │
                  │                       │
                  │   BMP180     DHT11    │
                  └───────┬────────┬──────┘
                          │        │
                          └───┬────┘
                              ▼
                     ┌─────────────────┐
                     │      ESP32      │
                     │                 │
                     │ Aquisição       │
                     │ Processamento   │
                     │ Classificação   │
                     │ Eventos         │
                     │ Alertas         │
                     └────────┬────────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
        ┌─────────┐      ┌───────────┐    ┌──────────┐
        │LittleFS │      │Open-Meteo │    │ Supabase │
        └────┬────┘      └─────┬─────┘    └────┬─────┘
             │                 │               │
             ▼                 │               ▼
      Dashboard local ◄────────┘        Histórico Cloud
```

O núcleo da arquitetura permanece no ESP32.

------------------------------------------------------------------------

## 3. Princípios arquiteturais

O projeto segue alguns princípios fundamentais:

**Processamento próximo à fonte**

As medições são processadas diretamente no ESP32 antes de qualquer
transmissão para serviços externos.

**Autonomia local**

A estação deve continuar adquirindo e processando dados mesmo quando a
conexão com a Internet ou a Cloud estiver indisponível.

**Separação de responsabilidades**

Sensores, processamento, interface Web, persistência e serviços Cloud
possuem responsabilidades claramente distintas.

**Cloud como extensão**

A Cloud complementa o sistema, mas não constitui requisito para o
funcionamento básico da estação.

**Evolução incremental**

A arquitetura deve permitir a inclusão futura de novos sensores,
algoritmos, serviços e modelos TinyML sem exigir uma reconstrução
completa do sistema.

------------------------------------------------------------------------

## 4. Arquitetura em camadas

### 4.1 Camada de aquisição

Responsável pela interface física com o ambiente.

Componentes atuais:

-   BMP180;
-   DHT11.

O BMP180 fornece temperatura e pressão atmosférica.

O DHT11 fornece umidade relativa e uma medição auxiliar de temperatura.

Na arquitetura atual, a temperatura do BMP180 é utilizada como
temperatura principal para a telemetria Cloud.

### 4.2 Camada de processamento Edge

Executada integralmente no ESP32.

Entre suas funções estão:

-   validação das leituras;
-   médias móveis;
-   histórico móvel;
-   mínimos e máximos;
-   correção da pressão ao nível do mar;
-   cálculo do ponto de orvalho;
-   regressão para tendência da pressão;
-   classificação da umidade;
-   avaliação de conforto;
-   avaliação de instabilidade;
-   detecção de anomalias;
-   geração de alertas;
-   geração de eventos;
-   histerese temporal de estados.

Essa camada transforma medições físicas em **informação ambiental
interpretada**.

### 4.3 Camada de armazenamento e interface local

O ESP32 utiliza LittleFS para armazenar os arquivos da interface Web:

``` text
data/
├── index.html
├── style.css
├── app.js
└── favicon.png
```

Esses arquivos formam o dashboard local servido pelo próprio ESP32.

### 4.4 Camada de conectividade

Responsável por:

-   conexão Wi-Fi;
-   armazenamento de redes conhecidas;
-   seleção automática de rede;
-   portal de configuração;
-   fallback para Access Point;
-   resolução local por mDNS.

O endereço padrão da estação é:

``` text
http://estacao-ambiental.local
```

### 4.5 Camada de serviços externos

A estação consulta a Open-Meteo para obter informações meteorológicas
externas.

Esses dados são utilizados como referência e complemento às medições
realizadas pelos sensores físicos.

### 4.6 Camada Cloud

A telemetria ambiental é enviada ao Supabase.

A Cloud é responsável principalmente por:

-   persistência de longo prazo;
-   disponibilização dos dados por API;
-   suporte ao futuro dashboard remoto;
-   análises históricas;
-   estudos de sazonalidade;
-   futuras integrações externas.

------------------------------------------------------------------------

## 5. Fluxo de dados

### 5.1 Fluxo local

``` text
Ambiente
   │
   ▼
Sensores
   │
   ▼
Aquisição
   │
   ▼
Validação
   │
   ▼
Processamento Edge
   │
   ├── médias
   ├── tendências
   ├── estados
   ├── eventos
   └── alertas
   │
   ▼
Dashboard local
```

Este fluxo independe da Cloud.

### 5.2 Fluxo meteorológico externo

``` text
Open-Meteo
     │
     ▼
    ESP32
     │
     ├── interpretação
     │
     ▼
Dashboard local
```

Os dados externos complementam as medições locais, mas não as
substituem.

### 5.3 Fluxo Edge--Cloud

``` text
Sensores
   │
   ▼
ESP32
   │
   ├── processamento local
   │
   ▼
Snapshot ambiental
   │
   ▼
Supabase REST API
   │
   ▼
PostgreSQL
   │
   ▼
Histórico Cloud
```

A Cloud recebe dados que já passaram por processamento no nó Edge.

------------------------------------------------------------------------

## 6. Responsabilidades do ESP32

O ESP32 concentra as seguintes responsabilidades:

-   controlar os sensores;
-   executar a lógica ambiental;
-   manter histórico recente;
-   calcular indicadores;
-   determinar estados;
-   detectar eventos;
-   gerenciar Wi-Fi;
-   manter configurações persistentes;
-   servir o dashboard;
-   consultar APIs externas;
-   transmitir telemetria;
-   sinalizar seu próprio estado operacional.

Portanto, o ESP32 constitui efetivamente o **nó Edge** da arquitetura.

------------------------------------------------------------------------

## 7. Processamento de borda

A estação mantém uma janela de observação local e executa operações
sobre as séries temporais.

Entre os indicadores estão:

``` text
Temperatura
   │
   ├── valor atual
   ├── média de 15 min
   ├── mínimo diário
   └── máximo diário

Umidade
   │
   ├── valor atual
   ├── média de 15 min
   ├── mínimo diário
   └── máximo diário

Pressão
   │
   ├── pressão local
   ├── pressão ao nível do mar
   ├── média de 15 min
   ├── média de 60 min
   ├── variação
   └── tendência
```

A partir desses dados são derivados estados ambientais e alertas.

------------------------------------------------------------------------

## 8. Dashboard local e LittleFS

A interface Web não está incorporada diretamente ao código C++.

Ela é armazenada no sistema de arquivos LittleFS.

Essa separação permite:

-   organizar melhor firmware e frontend;
-   modificar a interface sem misturá-la à lógica C++;
-   reduzir a complexidade do arquivo principal;
-   facilitar manutenção;
-   permitir evolução independente da apresentação.

O firmware e o LittleFS ocupam partições distintas da Flash e são
enviados separadamente para o ESP32.

------------------------------------------------------------------------

## 9. Conectividade e configuração

A estação pode armazenar múltiplas redes Wi-Fi conhecidas.

Durante a inicialização, procura uma rede válida e tenta conectar-se
automaticamente.

Quando nenhuma rede conhecida está disponível, pode disponibilizar um
Access Point de configuração.

A arquitetura de configuração utiliza NVS para persistir informações
entre reinicializações.

O mDNS permite que o dispositivo seja localizado por um nome amigável,
evitando a necessidade de conhecer seu endereço IP.

------------------------------------------------------------------------

## 10. Integração com Open-Meteo

A Open-Meteo funciona como fonte meteorológica externa.

Entre as informações disponíveis estão:

-   temperatura;
-   temperatura aparente;
-   umidade;
-   ponto de orvalho;
-   pressão;
-   precipitação;
-   cobertura de nuvens;
-   visibilidade;
-   índice UV;
-   velocidade e direção do vento;
-   rajadas;
-   código meteorológico.

Também são utilizados serviços de geocodificação e altitude.

A estação pode, portanto, comparar o **microambiente medido localmente**
com informações meteorológicas de referência.

------------------------------------------------------------------------

## 11. Integração com Supabase

O Supabase atua como backend Cloud.

O ESP32 utiliza uma API REST para registrar snapshots ambientais em uma
base PostgreSQL.

A telemetria inclui dados de sensores, valores derivados, estados
ambientais, informações operacionais e dados meteorológicos externos
relevantes.

A frequência atual de telemetria é adequada à reconstrução do histórico
recente da estação e ao armazenamento de séries temporais para análises
futuras.

Credenciais administrativas ou chaves secretas nunca devem ser
incorporadas ao firmware publicado.

------------------------------------------------------------------------

## 12. Independência entre Edge e Cloud

Uma das decisões fundamentais da arquitetura é evitar que o ESP32
dependa da Cloud para interpretar o ambiente.

O modelo adotado é:

``` text
            processamento
Sensores ───────────────► Edge
                           │
                           ├── operação local
                           ├── dashboard local
                           └── telemetria ───► Cloud
```

e não:

``` text
Sensores ───► Cloud ───► processamento ───► ESP32
```

Isso reduz dependência externa, latência e impacto de falhas de
conectividade.

------------------------------------------------------------------------

## 13. Persistência local

A arquitetura utiliza dois mecanismos principais de persistência:

**NVS**

Utilizada para configurações da estação, como redes Wi-Fi e parâmetros
de configuração.

**LittleFS**

Utilizado para arquivos da interface Web.

Dados ambientais históricos de longo prazo são destinados à Cloud.

------------------------------------------------------------------------

## 14. Particionamento da Flash

A Flash física possui 4 MB e utiliza tabela de partições personalizada.

``` text
Flash — 4 MB
│
├── NVS ........ configurações persistentes
├── OTA Data ... controle de atualização
├── APP0 ....... firmware
├── APP1 ....... firmware OTA
└── LittleFS ... dashboard Web
```

Dimensões principais:

``` text
APP0      1,625 MiB
APP1      1,625 MiB
LittleFS    704 KiB
```

A presença de APP0, APP1 e OTA Data mantém a arquitetura preparada para
atualização OTA.

Detalhes adicionais estão documentados em `08-particionamento-flash.md`.

------------------------------------------------------------------------

## 15. Disponibilidade e tolerância a falhas

A arquitetura já possui isolamento entre processamento local e Cloud.

Assim, uma falha de transmissão não deve impedir:

-   leitura dos sensores;
-   processamento ambiental;
-   atualização do dashboard local;
-   geração de estados;
-   detecção de eventos.

Uma evolução prevista é implementar uma fila local de telemetria para
armazenar temporariamente snapshots que não puderam ser enviados.

O fluxo futuro será:

``` text
Nova leitura
    │
    ▼
Processamento Edge
    │
    ▼
Tentativa Cloud
    │
    ├── sucesso ───► concluído
    │
    └── falha
          │
          ▼
      Buffer local
          │
          ▼
     reenvio posterior
```

------------------------------------------------------------------------

## 16. Segurança

A arquitetura deve manter separação entre código público e credenciais.

Não devem ser publicados no Git:

-   senhas Wi-Fi;
-   chaves secretas;
-   tokens administrativos;
-   credenciais de banco;
-   chaves `service_role`;
-   outros segredos de serviços externos.

O dashboard local utiliza atualmente HTTP dentro da rede local.

O futuro dashboard remoto deverá utilizar HTTPS e mecanismos apropriados
de autenticação e autorização.

------------------------------------------------------------------------

## 17. Escalabilidade

A arquitetura permite a existência futura de múltiplas estações.

Cada ESP32 pode atuar como um nó Edge independente:

``` text
Estação A ──┐
Estação B ──┤
Estação C ──┼────► Cloud
Estação D ──┤
Estação N ──┘
```

Cada estação processa localmente seus dados enquanto a Cloud permite
consolidar informações de vários nós.

Esse modelo aproxima o projeto de uma arquitetura distribuída de
sensores ambientais.

------------------------------------------------------------------------

## 18. Evolução arquitetural

A arquitetura foi preparada para receber novas capacidades sem abandonar
o modelo Edge.

Entre as evoluções previstas estão:

-   dashboard remoto;
-   histórico de longo prazo;
-   análise sazonal;
-   fila resiliente Edge--Cloud;
-   OTA;
-   integração com Alexa;
-   novos sensores;
-   TinyML;
-   inferência local;
-   análise preditiva;
-   múltiplas estações.

Uma possível evolução é:

``` text
Sensores
   │
   ▼
ESP32
   │
   ├── processamento clássico
   │
   ├── TinyML
   │
   ├── detecção de eventos
   │
   ├── dashboard local
   │
   └── Cloud
          │
          ├── histórico
          ├── dashboard remoto
          └── integrações
```

------------------------------------------------------------------------

## 19. Relação com Edge Computing

A Estação Ambiental exemplifica diversos princípios de Computação de
Borda.

### Proximidade dos dados

O processamento ocorre no mesmo dispositivo conectado aos sensores.

### Redução de latência

Não é necessário aguardar uma resposta da Cloud para determinar o estado
ambiental.

### Autonomia

O nó Edge mantém funções essenciais mesmo sem acesso à Internet.

### Redução de dependência da Cloud

A Cloud é utilizada principalmente para persistência e serviços
complementares.

### Pré-processamento

A estação pode enviar informações já agregadas e interpretadas.

### Distribuição computacional

Parte da computação ocorre no Edge e parte na Cloud, formando uma
arquitetura híbrida.

------------------------------------------------------------------------

## 20. Resumo das responsabilidades

  Componente        Responsabilidade
  ----------------- ---------------------------------------------------------
  BMP180            Temperatura e pressão atmosférica
  DHT11             Umidade e temperatura auxiliar
  ESP32             Aquisição, processamento, interpretação e conectividade
  NVS               Configurações persistentes
  LittleFS          Arquivos do dashboard local
  Dashboard local   Visualização e configuração da estação
  Open-Meteo        Referência meteorológica externa
  Supabase          Persistência e API Cloud
  PostgreSQL        Armazenamento histórico
  OTA               Estrutura para futuras atualizações remotas

A característica central da arquitetura é que **a inteligência
operacional permanece no Edge**, enquanto a Cloud amplia as capacidades
de persistência, acesso remoto e análise histórica.
