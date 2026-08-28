# Estação Ambiental ESP32

Estação ambiental experimental baseada em ESP32 desenvolvida como
plataforma de estudo, desenvolvimento e experimentação em **Computação
de Borda (Edge Computing)**.

O sistema realiza aquisição de dados ambientais, processamento local,
análise temporal, classificação das condições ambientais, detecção de
eventos, visualização por dashboard Web local e integração com serviços
externos e Cloud.

> **Estado atual do projeto:** v3.4-RC1

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Objetivos do projeto](#2-objetivos-do-projeto)
-   [3. Arquitetura](#3-arquitetura)
-   [4. Hardware](#4-hardware)
    -   [4.1 Microcontrolador](#41-microcontrolador)
    -   [4.2 Sensores](#42-sensores)
-   [5. Processamento de borda](#5-processamento-de-borda)
-   [6. Dashboard local](#6-dashboard-local)
-   [7. Conectividade](#7-conectividade)
-   [8. Fonte meteorológica externa](#8-fonte-meteorológica-externa)
-   [9. Integração Cloud](#9-integração-cloud)
-   [10. Particionamento da Flash](#10-particionamento-da-flash)
-   [11. Estrutura do repositório](#11-estrutura-do-repositório)
-   [12. Documentação](#12-documentação)
-   [13. Tecnologias utilizadas](#13-tecnologias-utilizadas)
-   [14. Instalação](#14-instalação)
-   [15. Operação](#15-operação)
-   [16. Segurança](#16-segurança)
-   [17. Estado atual](#17-estado-atual)
-   [18. Roadmap](#18-roadmap)
-   [19. Contexto acadêmico](#19-contexto-acadêmico)
-   [20. Licença](#20-licença)

------------------------------------------------------------------------

## 1. Visão geral

A **Estação Ambiental ESP32** foi concebida para explorar uma
arquitetura em que o dispositivo de borda não atua apenas como coletor e
transmissor de dados.

O próprio ESP32 executa parte significativa do processamento:

-   aquisição dos sensores;
-   validação das leituras;
-   cálculo da pressão atmosférica corrigida ao nível do mar;
-   cálculo do ponto de orvalho;
-   médias móveis;
-   manutenção de histórico recente;
-   mínimos e máximos diários;
-   análise de tendência da pressão;
-   avaliação de umidade e conforto ambiental;
-   avaliação experimental de instabilidade;
-   detecção de anomalias;
-   classificação do estado ambiental;
-   geração de alertas e eventos;
-   disponibilização de dashboard Web local;
-   integração com fonte meteorológica externa;
-   envio de telemetria para a Cloud.

Dessa forma, a estação mantém capacidade local de **medir, processar,
interpretar e apresentar informações** mesmo quando serviços externos
estão indisponíveis.

A diretriz arquitetural do projeto é:

> **Edge primeiro; Cloud como extensão.**

------------------------------------------------------------------------

## 2. Objetivos do projeto

O projeto possui objetivos técnicos e acadêmicos.

Do ponto de vista técnico, busca desenvolver uma estação capaz de:

-   adquirir variáveis ambientais;
-   processar séries temporais no próprio microcontrolador;
-   produzir indicadores derivados;
-   operar de forma autônoma na rede local;
-   integrar dados locais e externos;
-   armazenar histórico de longo prazo na Cloud;
-   servir como base para futuras técnicas de TinyML.

Do ponto de vista acadêmico, a estação funciona como uma plataforma
experimental para estudar **Computação de Borda, IoT, sistemas
distribuídos, resiliência Edge--Cloud, séries temporais e inferência
local**.

------------------------------------------------------------------------

## 3. Arquitetura

A arquitetura combina processamento **Edge** e serviços **Cloud**.

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
 Dashboard Web          │       PostgreSQL
      local             │             │
          ▲             │             ▼
          └─────────────┘      Histórico Cloud
```

O ESP32 permanece responsável pela lógica ambiental imediata. A Cloud
complementa a arquitetura com persistência, acesso remoto e análise
histórica.

Documentação detalhada:
[`docs/02-arquitetura.md`](docs/02-arquitetura.md).

------------------------------------------------------------------------

## 4. Hardware

### 4.1 Microcontrolador

-   ESP32 Dev Module;
-   ESP32-D0WD-V3;
-   arquitetura dual core;
-   Wi-Fi;
-   Bluetooth;
-   Flash física de 4 MB.

### 4.2 Sensores

-   **BMP180** --- temperatura e pressão atmosférica;
-   **DHT11** --- umidade relativa e temperatura auxiliar.

Na arquitetura Cloud atual, a temperatura canônica utilizada na
telemetria é proveniente do **BMP180**.

Documentação detalhada: [`docs/03-hardware.md`](docs/03-hardware.md).

------------------------------------------------------------------------

## 5. Processamento de borda

Entre as funções executadas localmente estão:

-   média móvel de 15 minutos;
-   histórico móvel de aproximadamente 60 minutos;
-   mínimos e máximos diários;
-   correção da pressão para o nível do mar;
-   tendência barométrica;
-   ponto de orvalho;
-   classificação da umidade;
-   conforto ambiental;
-   avaliação de instabilidade;
-   detecção de anomalias;
-   geração de alertas;
-   classificação do estado ambiental;
-   registro de eventos.

Para uma média de $N$ amostras:

$$
\bar{x}=\frac{1}{N}\sum_{i=1}^{N}x_i
$$

Uma forma utilizada para estimar a pressão equivalente ao nível do mar
é:

$$
P_0=P\left(1-\frac{0.0065h}{T+0.0065h+273.15}\right)^{-5.257}
$$

O ponto de orvalho pode ser obtido pela aproximação de Magnus:

$$
\gamma=\ln\left(\frac{RH}{100}\right)+\frac{aT}{b+T}
$$

$$
T_d=\frac{b\gamma}{a-\gamma}
$$

A tendência da pressão pode ser estimada pelo coeficiente angular da
regressão linear:

$$
m=\frac{N\sum_{i=1}^{N}t_iP_i-\left(\sum_{i=1}^{N}t_i\right)\left(\sum_{i=1}^{N}P_i\right)}{N\sum_{i=1}^{N}t_i^2-\left(\sum_{i=1}^{N}t_i\right)^2}
$$

Assim, a estação não transmite apenas dados brutos: ela produz
**informação derivada e estados ambientais no próprio Edge**.

Documentação detalhada:
[`docs/11-processamento-edge.md`](docs/11-processamento-edge.md).

------------------------------------------------------------------------

## 6. Dashboard local

O ESP32 disponibiliza uma interface Web acessível pela rede local.

``` text
http://estacao-ambiental.local
```

O dashboard apresenta, entre outros recursos:

-   temperatura;
-   umidade relativa;
-   pressão local e corrigida;
-   médias móveis;
-   mínimos e máximos;
-   ponto de orvalho;
-   tendência da pressão;
-   conforto ambiental;
-   instabilidade;
-   anomalias;
-   alertas;
-   eventos recentes;
-   informações meteorológicas externas;
-   estado de conectividade;
-   configurações da estação.

Os arquivos da interface são armazenados no **LittleFS**, separando a
aplicação Web do firmware principal.

Documentação detalhada:
[`docs/05-dashboard-local.md`](docs/05-dashboard-local.md).

------------------------------------------------------------------------

## 7. Conectividade

A estação possui recursos de conectividade voltados à autonomia
operacional:

-   Wi-Fi;
-   múltiplas redes conhecidas;
-   seleção automática de rede;
-   fallback para Access Point;
-   portal de configuração;
-   persistência em NVS;
-   hostname configurável;
-   mDNS;
-   comunicação HTTP local;
-   comunicação HTTPS com serviços externos.

O hostname padrão permite acesso por:

``` text
http://estacao-ambiental.local
```

Documentação detalhada:
[`docs/06-conectividade.md`](docs/06-conectividade.md).

------------------------------------------------------------------------

## 8. Fonte meteorológica externa

Dados meteorológicos externos são obtidos por meio da **Open-Meteo**.

Esses dados complementam as medições locais e permitem comparar a
estação com uma referência meteorológica externa.

Para uma grandeza $x$ presente nas duas fontes:

$$
\Delta x=x_{\mathrm{local}}-x_{\mathrm{externo}}
$$

Por exemplo, para temperatura:

$$
\Delta T=T_{\mathrm{local}}-T_{\mathrm{externa}}
$$

Diferenças não representam necessariamente erro, pois as fontes podem
possuir localização, altitude, exposição e instante de medição
distintos.

A fonte externa **não substitui os sensores locais**.

------------------------------------------------------------------------

## 9. Integração Cloud

A estação envia telemetria para o **Supabase**, utilizando API REST e
persistência em PostgreSQL.

``` text
ESP32
  │
  ▼
HTTPS / REST / JSON
  │
  ▼
Supabase
  │
  ▼
PostgreSQL
```

A integração permite:

-   armazenamento de histórico;
-   consulta remota;
-   análise temporal;
-   estudos de sazonalidade;
-   futura construção de dashboard remoto;
-   futura integração com outros serviços.

Com aproximadamente um registro por minuto:

$$
N_{\mathrm{dia}}=24\times60=1440
$$

e, em 365 dias:

$$
N_{\mathrm{ano}}=1440\times365=525600
$$

registros por estação, em operação contínua.

A indisponibilidade temporária da Cloud não deve interromper o
processamento local.

Documentação detalhada: [`docs/07-cloud.md`](docs/07-cloud.md).

------------------------------------------------------------------------

## 10. Particionamento da Flash

O projeto utiliza uma tabela de partições personalizada para a Flash
física de 4 MB.

``` text
Flash ESP32 — 4 MiB

├── NVS .......... 20 KiB
├── OTA Data ...... 8 KiB
├── APP0 .......... 1.625 MiB
├── APP1 .......... 1.625 MiB
└── LittleFS ...... 704 KiB
```

Cada partição APP possui:

$$
0x1A0000=1703936\ \mathrm{bytes}
$$

O filesystem possui:

$$
0x0B0000=720896\ \mathrm{bytes}=704\ \mathrm{KiB}
$$

A mudança foi realizada porque o firmware havia atingido aproximadamente
95% da partição APP do layout anterior.

A nova configuração amplia a margem disponível e preserva a estrutura
necessária para futura atualização **OTA**.

O arquivo utilizado está em:

``` text
firmware/estacao_ambiental/partitions.csv
```

Documentação detalhada:
[`docs/08-particionamento-flash.md`](docs/08-particionamento-flash.md).

------------------------------------------------------------------------

## 11. Estrutura do repositório

``` text
estacao-ambiental-esp32/
│
├── README.md
├── LICENSE
├── .gitignore
│
├── firmware/
│   └── estacao_ambiental/
│       ├── EstacaoAmbiental.ino
│       ├── partitions.csv
│       └── data/
│           ├── index.html
│           ├── style.css
│           ├── app.js
│           └── favicon.png
│
├── cloud/
│   └── supabase/
│
├── docs/
│   ├── 01-visao-geral.md
│   ├── 02-arquitetura.md
│   ├── 03-hardware.md
│   ├── 04-firmware.md
│   ├── 05-dashboard-local.md
│   ├── 06-conectividade.md
│   ├── 07-cloud.md
│   ├── 08-particionamento-flash.md
│   ├── 09-instalacao.md
│   ├── 10-operacao.md
│   ├── 11-processamento-edge.md
│   └── 12-roadmap.md
│
├── assets/
├── research/
└── releases/
```

Essa organização separa firmware, frontend embarcado, infraestrutura
Cloud, documentação, material de pesquisa e releases.

------------------------------------------------------------------------

## 12. Documentação

A documentação técnica detalhada está organizada em `docs/`:

  -------------------------------------------------------------------------------------------------------
  Documento                                                           Conteúdo
  ------------------------------------------------------------------- -----------------------------------
  [`01-visao-geral.md`](docs/01-visao-geral.md)                       visão geral e objetivos

  [`02-arquitetura.md`](docs/02-arquitetura.md)                       arquitetura do sistema

  [`03-hardware.md`](docs/03-hardware.md)                             ESP32, sensores e conexões

  [`04-firmware.md`](docs/04-firmware.md)                             organização e lógica do firmware

  [`05-dashboard-local.md`](docs/05-dashboard-local.md)               interface Web embarcada

  [`06-conectividade.md`](docs/06-conectividade.md)                   Wi-Fi, NVS, AP e mDNS

  [`07-cloud.md`](docs/07-cloud.md)                                   Supabase, PostgreSQL e telemetria

  [`08-particionamento-flash.md`](docs/08-particionamento-flash.md)   Flash, OTA e LittleFS

  [`09-instalacao.md`](docs/09-instalacao.md)                         instalação e configuração

  [`10-operacao.md`](docs/10-operacao.md)                             operação e diagnóstico

  [`11-processamento-edge.md`](docs/11-processamento-edge.md)         processamento matemático e Edge
                                                                      Computing

  [`12-roadmap.md`](docs/12-roadmap.md)                               evolução planejada
  -------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 13. Tecnologias utilizadas

-   ESP32;
-   Arduino Framework;
-   C/C++;
-   HTML;
-   CSS;
-   JavaScript;
-   LittleFS;
-   NVS;
-   Wi-Fi;
-   mDNS;
-   HTTP/HTTPS;
-   REST;
-   JSON;
-   Supabase;
-   PostgreSQL;
-   Open-Meteo.

------------------------------------------------------------------------

## 14. Instalação

O projeto utiliza o **Arduino IDE** com suporte à plataforma ESP32.

O processo básico envolve:

1.  selecionar `ESP32 Dev Module`;
2.  manter a Flash física configurada como `4 MB`;
3.  selecionar `Partition Scheme → Custom`;
4.  manter `partitions.csv` junto ao projeto;
5.  compilar e enviar `EstacaoAmbiental.ino`;
6.  realizar separadamente o upload do LittleFS;
7.  reiniciar o ESP32;
8.  provisionar/configurar a rede Wi-Fi;
9.  acessar o dashboard pela rede local;
10. validar sensores e serviços externos.

Instruções detalhadas: [`docs/09-instalacao.md`](docs/09-instalacao.md).

------------------------------------------------------------------------

## 15. Operação

Depois de instalada, a estação foi projetada para operar de forma
autônoma.

Uma sequência básica de diagnóstico é:

``` text
hardware e sensores
        │
        ▼
processamento Edge
        │
        ▼
dashboard local
        │
        ▼
serviços externos
        │
        ▼
Cloud
```

Essa ordem permite distinguir problemas locais de falhas de
conectividade ou serviços externos.

Manual de operação: [`docs/10-operacao.md`](docs/10-operacao.md).

------------------------------------------------------------------------

## 16. Segurança

Credenciais sensíveis **não devem ser armazenadas no repositório
público**.

Isso inclui:

-   senhas Wi-Fi;
-   chaves privadas;
-   credenciais administrativas;
-   `service_role`;
-   senhas de banco;
-   segredos de APIs.

O ESP32 deve utilizar apenas as permissões necessárias à telemetria,
seguindo o princípio do **menor privilégio**.

O acesso Web local utiliza HTTP e pode aparecer no navegador como **Não
seguro**. Isso é diferente da comunicação externa, que deve utilizar
HTTPS quando suportado.

A arquitetura futura do dashboard remoto deverá incluir autenticação e
políticas adequadas de leitura.

------------------------------------------------------------------------

## 17. Estado atual

A versão **v3.4-RC1** consolida:

-   aquisição BMP180 e DHT11;
-   processamento ambiental local;
-   médias e histórico temporal;
-   classificação e estados;
-   dashboard Web local;
-   LittleFS;
-   múltiplas redes Wi-Fi;
-   portal de configuração;
-   NVS;
-   mDNS;
-   Open-Meteo;
-   telemetria Supabase;
-   eventos locais;
-   particionamento personalizado;
-   estrutura APP0/APP1 preparada para OTA.

Algumas funcionalidades descritas no roadmap ainda **não estão
implementadas** e são explicitamente identificadas como futuras.

------------------------------------------------------------------------

## 18. Roadmap

Entre as principais evoluções previstas estão:

-   consolidação definitiva da v3.4;
-   dashboard Web remoto;
-   histórico ambiental de longo prazo;
-   análise de sazonalidade;
-   envio de eventos para a Cloud;
-   tolerância a falhas Edge--Cloud;
-   fila local e reenvio de telemetria;
-   prevenção de duplicidades;
-   OTA;
-   modularização progressiva do firmware;
-   observabilidade do próprio nó Edge;
-   múltiplas estações;
-   integração com assistentes e LLMs;
-   TinyML;
-   detecção inteligente de anomalias;
-   estudos de eficiência energética.

Roadmap completo: [`docs/12-roadmap.md`](docs/12-roadmap.md).

------------------------------------------------------------------------

## 19. Contexto acadêmico

O projeto funciona como plataforma experimental para estudo de
**Computação de Borda**.

Ele permite investigar conceitos como:

-   processamento próximo à fonte dos dados;
-   autonomia do nó Edge;
-   redução de dependência da Cloud;
-   latência;
-   disponibilidade;
-   tolerância a falhas;
-   integração Edge--Cloud;
-   processamento de séries temporais;
-   extração de características;
-   classificação local;
-   TinyML;
-   eficiência computacional;
-   eficiência energética;
-   sistemas distribuídos.

A evolução conceitual do projeto pode ser resumida por:

``` text
Sensor
  │
  ▼
Dado
  │
  ▼
Processamento Edge
  │
  ▼
Informação
  │
  ▼
Decisão local
  │
  ▼
Cloud / histórico / integração
```

Essa característica transforma a estação em mais do que um dispositivo
IoT de telemetria: ela constitui uma **plataforma experimental de
processamento distribuído na borda**.

------------------------------------------------------------------------

## 20. Licença

A licença do projeto será definida antes da publicação da primeira
versão estável.
