# Estação Ambiental ESP32

Estação ambiental experimental baseada em ESP32 desenvolvida como
plataforma de estudo e experimentação em **Computação de Borda (Edge
Computing)**.

O sistema realiza aquisição de dados ambientais, processamento local,
classificação das condições ambientais, detecção de eventos,
visualização por dashboard Web local e integração com serviços em nuvem.

> Estado atual do projeto: **v3.4-RC1**

------------------------------------------------------------------------

## Índice

-   [Visão geral](#visão-geral)
-   [Arquitetura](#arquitetura)
-   [Hardware](#hardware)
    -   [Microcontrolador](#microcontrolador)
    -   [Sensores](#sensores)
-   [Processamento de borda](#processamento-de-borda)
-   [Dashboard local](#dashboard-local)
-   [Integração Cloud](#integração-cloud)
-   [Fonte meteorológica externa](#fonte-meteorológica-externa)
-   [Particionamento da Flash](#particionamento-da-flash)
-   [Estrutura do repositório](#estrutura-do-repositório)
-   [Tecnologias utilizadas](#tecnologias-utilizadas)
-   [Instalação](#instalação)
-   [Segurança](#segurança)
-   [Estado atual](#estado-atual)
-   [Roadmap](#roadmap)
-   [Contexto acadêmico](#contexto-acadêmico)
-   [Licença](#licença)

------------------------------------------------------------------------

## Visão geral

A Estação Ambiental ESP32 foi concebida para explorar uma arquitetura em
que o dispositivo de borda não atua apenas como coletor de dados.

O próprio ESP32 realiza parte significativa do processamento:

-   aquisição dos sensores;
-   cálculo de pressão atmosférica corrigida ao nível do mar;
-   cálculo do ponto de orvalho;
-   médias móveis;
-   análise de tendência da pressão;
-   avaliação de umidade e conforto ambiental;
-   detecção de anomalias;
-   classificação do estado ambiental;
-   geração de eventos;
-   manutenção de mínimos e máximos;
-   disponibilização de dashboard Web local;
-   integração com fonte meteorológica externa;
-   envio de telemetria para a nuvem.

Dessa forma, a estação continua possuindo capacidade local de aquisição,
processamento, interpretação e visualização mesmo sem depender
continuamente da infraestrutura Cloud.

------------------------------------------------------------------------

## Arquitetura

A arquitetura atual combina processamento **Edge** e serviços **Cloud**.

``` text
                 ┌─────────────┐
                 │   BMP180    │
                 │ Temp/Pressão│
                 └──────┬──────┘
                        │
                 ┌──────┴──────┐
                 │    DHT11    │
                 │   Umidade   │
                 └──────┬──────┘
                        │
                        ▼
                ┌───────────────┐
                │     ESP32     │
                │ Processamento │
                │     Edge      │
                └───────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
     LittleFS       Open-Meteo     Supabase
          │             │             │
          ▼             │             ▼
 Dashboard Web          │       Histórico Cloud
      local             │
          ▲             │
          └─────────────┘
```

O ESP32 permanece responsável pela lógica principal da estação. A nuvem
complementa a arquitetura com persistência e futura análise histórica de
longo prazo.

Mais detalhes em [`docs/02-arquitetura.md`](docs/02-arquitetura.md).

------------------------------------------------------------------------

## Hardware

### Microcontrolador

-   ESP32 Dev Module
-   ESP32-D0WD-V3
-   Dual Core
-   Wi-Fi
-   Bluetooth
-   Flash de 4 MB

### Sensores

-   **BMP180** --- temperatura e pressão atmosférica.
-   **DHT11** --- umidade relativa e temperatura auxiliar.

Na arquitetura atual, a temperatura principal utilizada pela estação é
proveniente do **BMP180**.

------------------------------------------------------------------------

## Processamento de borda

Entre as funções executadas localmente estão:

-   média móvel de 15 minutos;
-   histórico móvel de 60 minutos;
-   mínimos e máximos diários;
-   tendência da pressão atmosférica;
-   ponto de orvalho;
-   classificação da umidade;
-   conforto ambiental;
-   avaliação de instabilidade;
-   detecção de anomalias;
-   geração de alertas;
-   classificação do estado ambiental;
-   registro de eventos.

Essa abordagem reduz a dependência da Cloud e constitui o principal
elemento de **Edge Computing** do projeto.

------------------------------------------------------------------------

## Dashboard local

O ESP32 disponibiliza uma interface Web acessível pela rede local.

``` text
http://estacao-ambiental.local
```

O dashboard apresenta temperatura, umidade relativa, pressão
atmosférica, médias móveis, mínimos e máximos, ponto de orvalho,
tendência da pressão, conforto ambiental, instabilidade, anomalias,
alertas, eventos recentes, informações meteorológicas externas e estado
de conectividade.

Os arquivos da interface são armazenados no **LittleFS**, separando a
aplicação Web do firmware principal.

------------------------------------------------------------------------

## Integração Cloud

A estação envia telemetria para o **Supabase**.

A integração permite armazenar dados ambientais para consulta remota,
histórico de longo prazo, análise temporal, estudos de sazonalidade e
desenvolvimento futuro de um dashboard Web remoto.

A arquitetura foi projetada para que uma indisponibilidade temporária da
Cloud não interrompa o processamento local da estação.

------------------------------------------------------------------------

## Fonte meteorológica externa

Dados meteorológicos externos são obtidos por meio da API Open-Meteo.

Esses dados complementam as medições locais e permitem comparar a
medição realizada pela estação com informações meteorológicas externas.
A fonte externa não substitui os sensores locais.

------------------------------------------------------------------------

## Particionamento da Flash

O projeto utiliza uma tabela de partições personalizada para a Flash de
4 MB.

``` text
Flash ESP32 — 4 MB

├── NVS
├── OTA Data
├── APP0 ........ 1,625 MiB
├── APP1 ........ 1,625 MiB
└── LittleFS .... 704 KiB
```

A mudança foi realizada devido ao crescimento do firmware, que havia
atingido aproximadamente 95% da partição APP padrão.

A nova configuração preserva suporte a **OTA** e amplia a margem
disponível para evolução do firmware.

O arquivo utilizado está em `firmware/estacao_ambiental/partitions.csv`.

Mais detalhes em
[`docs/08-particionamento-flash.md`](docs/08-particionamento-flash.md).

------------------------------------------------------------------------

## Estrutura do repositório

``` text
estacao-ambiental-esp32/
│
├── README.md
├── LICENSE
├── .gitignore
├── firmware/
│   └── estacao_ambiental/
│       ├── EstacaoAmbiental.ino
│       ├── partitions.csv
│       └── data/
│           ├── index.html
│           ├── style.css
│           ├── app.js
│           └── favicon.png
├── cloud/
│   └── supabase/
├── docs/
├── assets/
├── research/
└── releases/
```

------------------------------------------------------------------------

## Tecnologias utilizadas

-   ESP32
-   Arduino Framework
-   C/C++
-   HTML
-   CSS
-   JavaScript
-   LittleFS
-   Wi-Fi
-   mDNS
-   HTTP/HTTPS
-   REST
-   JSON
-   Supabase
-   PostgreSQL
-   Open-Meteo

------------------------------------------------------------------------

## Instalação

O projeto utiliza o **Arduino IDE** com suporte à plataforma ESP32.

O processo básico envolve:

1.  selecionar `ESP32 Dev Module`;
2.  configurar Flash de `4 MB`;
3.  selecionar `Partition Scheme → Custom`;
4.  compilar e enviar `EstacaoAmbiental.ino`;
5.  realizar o upload do LittleFS;
6.  reiniciar o ESP32;
7.  acessar o dashboard pela rede local.

Instruções detalhadas serão mantidas em
[`docs/09-instalacao.md`](docs/09-instalacao.md).

------------------------------------------------------------------------

## Segurança

Credenciais privadas **não devem ser armazenadas no repositório**.

Isso inclui SSID e senha Wi-Fi, tokens, chaves privadas, credenciais
administrativas e segredos de APIs.

Antes da publicação do firmware, as configurações sensíveis devem ser
separadas do código-fonte versionado.

------------------------------------------------------------------------

## Estado atual

A versão **v3.4-RC1** possui:

-   aquisição BMP180 e DHT11;
-   processamento ambiental local;
-   dashboard Web local;
-   LittleFS;
-   configuração Wi-Fi;
-   mDNS;
-   API meteorológica externa;
-   telemetria Supabase;
-   eventos locais;
-   particionamento personalizado;
-   suporte estrutural a OTA.

------------------------------------------------------------------------

## Roadmap

Entre as evoluções previstas estão:

-   dashboard Web remoto;
-   hospedagem Web independente da estação;
-   histórico ambiental de longo prazo;
-   análise de sazonalidade;
-   tolerância a falhas Edge → Cloud;
-   buffer local e reenvio de telemetria;
-   OTA;
-   integração com Alexa;
-   aprimoramento da configuração da estação;
-   TinyML;
-   estudos de inferência diretamente na borda.

Consulte [`docs/11-roadmap.md`](docs/11-roadmap.md).

------------------------------------------------------------------------

## Contexto acadêmico

O projeto também funciona como plataforma experimental para estudo de
**Computação de Borda**, permitindo investigar conceitos como
processamento próximo à fonte dos dados, redução da dependência da
Cloud, autonomia do nó Edge, latência, disponibilidade, tolerância a
falhas, integração Edge--Cloud, processamento de séries temporais,
TinyML e eficiência computacional em dispositivos embarcados.

------------------------------------------------------------------------

## Licença

A licença do projeto será definida antes da publicação da primeira
versão estável.
