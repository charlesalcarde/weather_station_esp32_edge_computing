# Hardware da Estação Ambiental ESP32

Este documento descreve o hardware utilizado na **Estação Ambiental
ESP32**, incluindo microcontrolador, sensores, interfaces elétricas,
GPIOs, alimentação e organização física das conexões.

> Documento referente à configuração de hardware consolidada na fase
> **v3.4-RC1** do projeto.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Diagrama geral do hardware](#2-diagrama-geral-do-hardware)
-   [3. ESP32](#3-esp32)
    -   [3.1 Função no projeto](#31-função-no-projeto)
    -   [3.2 Recursos utilizados](#32-recursos-utilizados)
-   [4. BMP180](#4-bmp180)
    -   [4.1 Grandezas medidas](#41-grandezas-medidas)
    -   [4.2 Interface I2C](#42-interface-i2c)
    -   [4.3 Conexões](#43-conexões)
-   [5. DHT11](#5-dht11)
    -   [5.1 Grandezas medidas](#51-grandezas-medidas)
    -   [5.2 Interface digital](#52-interface-digital)
    -   [5.3 Conexões](#53-conexões)
-   [6. LED de atividade](#6-led-de-atividade)
-   [7. Mapa de GPIOs](#7-mapa-de-gpios)
-   [8. Diagrama de conexões](#8-diagrama-de-conexões)
-   [9. Alimentação e níveis lógicos](#9-alimentação-e-níveis-lógicos)
-   [10. Barramento I2C](#10-barramento-i2c)
-   [11. Organização das medições](#11-organização-das-medições)
-   [12. Considerações sobre montagem](#12-considerações-sobre-montagem)
-   [13. Limitações dos sensores
    atuais](#13-limitações-dos-sensores-atuais)
-   [14. Possibilidades de expansão](#14-possibilidades-de-expansão)
-   [15. Resumo do hardware](#15-resumo-do-hardware)

------------------------------------------------------------------------

## 1. Visão geral

A versão atual da estação utiliza uma arquitetura de hardware simples,
composta por um ESP32 e dois módulos sensores ambientais.

``` text
ESP32
│
├── BMP180
│   ├── temperatura
│   └── pressão atmosférica
│
├── DHT11
│   ├── umidade relativa
│   └── temperatura auxiliar
│
└── LED GPIO 2
    └── indicação de atividade
```

A escolha inicial de poucos sensores permite concentrar o projeto nos
aspectos de **processamento Edge, conectividade, software embarcado e
integração Edge--Cloud**, mantendo a plataforma aberta para expansão.

------------------------------------------------------------------------

## 2. Diagrama geral do hardware

``` text
                      ┌─────────────────────┐
                      │        ESP32        │
                      │                     │
                      │ GPIO 21 ─── SDA ────┼────┐
                      │ GPIO 22 ─── SCL ────┼──┐ │
                      │                     │  │ │
                      │ GPIO 4 ─────────────┼──┼─┼──── DHT11
                      │                     │  │ │
                      │ GPIO 2 ── LED       │  │ │
                      └─────────────────────┘  │ │
                                               │ │
                                               ▼ ▼
                                            BMP180
```

O BMP180 utiliza comunicação I2C, enquanto o DHT11 utiliza uma interface
digital dedicada.

------------------------------------------------------------------------

## 3. ESP32

O microcontrolador utilizado é uma placa do tipo **ESP32 Dev Module**,
baseada no ESP32-D0WD-V3.

### 3.1 Função no projeto

O ESP32 é o núcleo computacional da estação.

Suas responsabilidades incluem:

-   leitura dos sensores;
-   processamento dos dados;
-   armazenamento temporário;
-   cálculo de indicadores ambientais;
-   classificação de estados;
-   detecção de eventos;
-   gerenciamento de Wi-Fi;
-   execução do servidor Web local;
-   consulta de serviços externos;
-   transmissão de telemetria para a Cloud;
-   armazenamento de configurações;
-   gerenciamento do sistema de arquivos LittleFS.

Portanto, a placa atua como um verdadeiro **nó Edge**.

### 3.2 Recursos utilizados

Entre os recursos do ESP32 utilizados pelo projeto estão:

-   CPU de múltiplos núcleos;
-   GPIOs digitais;
-   controlador I2C;
-   Wi-Fi;
-   memória Flash de 4 MB;
-   NVS;
-   LittleFS;
-   temporizadores;
-   pilha TCP/IP;
-   servidor HTTP;
-   cliente HTTP/HTTPS;
-   mDNS.

O Bluetooth disponível no ESP32 não é utilizado atualmente.

------------------------------------------------------------------------

## 4. BMP180

O BMP180 é um sensor digital utilizado para medição de pressão
atmosférica e temperatura.

### 4.1 Grandezas medidas

O módulo fornece:

-   pressão atmosférica;
-   temperatura.

A pressão medida localmente também é utilizada para calcular uma
estimativa da pressão corrigida ao nível do mar.

Na arquitetura atual, a temperatura do BMP180 é adotada como a
**temperatura principal da estação para telemetria Cloud**.

### 4.2 Interface I2C

O BMP180 utiliza o barramento I2C.

No projeto:

``` text
SDA → GPIO 21
SCL → GPIO 22
```

Esses são os pinos I2C normalmente utilizados pelo ESP32 Dev Module e
foram adotados explicitamente pelo firmware.

### 4.3 Conexões

  BMP180   ESP32     Função
  -------- --------- ---------------------
  VCC      3,3 V     Alimentação
  GND      GND       Referência elétrica
  SDA      GPIO 21   Dados I2C
  SCL      GPIO 22   Clock I2C

> A identificação e as características elétricas do módulo físico devem
> sempre ser verificadas antes da alimentação, pois placas BMP180 de
> diferentes fabricantes podem possuir reguladores ou circuitos
> auxiliares distintos.

------------------------------------------------------------------------

## 5. DHT11

O DHT11 é utilizado principalmente para medir a umidade relativa do ar.

### 5.1 Grandezas medidas

O sensor fornece:

-   umidade relativa;
-   temperatura.

A temperatura do DHT11 é mantida como medição auxiliar local. Para a
telemetria Cloud consolidada, a temperatura principal é proveniente do
BMP180.

### 5.2 Interface digital

Diferentemente do BMP180, o DHT11 não utiliza I2C.

Ele emprega um protocolo digital próprio por um único pino de dados.

No projeto:

``` text
DATA → GPIO 4
```

### 5.3 Conexões

Para um módulo DHT11 de três pinos:

  DHT11   ESP32    Função
  ------- -------- ---------------------
  VCC     3,3 V    Alimentação
  DATA    GPIO 4   Comunicação digital
  GND     GND      Referência elétrica

Algumas versões do DHT11 são fornecidas como sensor de quatro terminais
sem placa auxiliar. Nesses casos, a pinagem e a necessidade de resistor
de pull-up devem ser verificadas especificamente.

------------------------------------------------------------------------

## 6. LED de atividade

O projeto utiliza o LED associado ao:

``` text
GPIO 2
```

como indicador visual de funcionamento.

O padrão de atividade adotado utiliza dois pulsos curtos seguidos por um
período de repouso.

De forma simplificada:

``` text
LED ON
  │ 100 ms
LED OFF
  │ 100 ms
LED ON
  │ 100 ms
LED OFF
  │
  └──── aproximadamente 1 s ────► novo ciclo
```

O LED funciona como um **heartbeat**, permitindo verificar visualmente
que o firmware continua em execução.

A presença e a ligação física do LED integrado podem variar entre
diferentes placas ESP32.

------------------------------------------------------------------------

## 7. Mapa de GPIOs

O mapa atual é:

    GPIO Dispositivo   Função
  ------ ------------- ------------------------------------
       2 LED           Heartbeat / indicação de atividade
       4 DHT11         Dados do sensor
      21 BMP180        SDA --- I2C
      22 BMP180        SCL --- I2C

Esse mapa deve ser atualizado sempre que novos sensores ou periféricos
forem adicionados ao projeto.

------------------------------------------------------------------------

## 8. Diagrama de conexões

Uma representação simplificada da montagem é:

``` text
                    ESP32 Dev Module
                 ┌────────────────────┐
                 │                    │
        3V3 ─────┼──────────┬─────────┼─────► alimentação
                 │          │
                 │          │
GPIO 21 (SDA) ───┼──────────┼──────────────► SDA BMP180
GPIO 22 (SCL) ───┼──────────┼──────────────► SCL BMP180
                 │          │
GPIO 4 ──────────┼──────────┼──────────────► DATA DHT11
                 │          │
GPIO 2 ──────────┼── LED    │
                 │          │
        GND ─────┼──────────┴──────────────► GND comum
                 │
                 └────────────────────┘
```

Todos os módulos devem compartilhar uma referência comum de GND.

------------------------------------------------------------------------

## 9. Alimentação e níveis lógicos

O ESP32 utiliza lógica de **3,3 V**.

Como regra de projeto, sinais aplicados diretamente aos GPIOs do ESP32
não devem exceder os limites elétricos especificados para o dispositivo.

A utilização de 3,3 V para os sensores atuais simplifica a
compatibilidade lógica.

Antes de incorporar qualquer novo módulo é necessário verificar:

-   tensão de alimentação;
-   tensão dos sinais digitais;
-   consumo;
-   necessidade de conversor de nível lógico;
-   necessidade de resistores de pull-up;
-   compatibilidade com o ESP32.

------------------------------------------------------------------------

## 10. Barramento I2C

O barramento I2C permite conectar vários dispositivos utilizando apenas
duas linhas principais:

``` text
SDA ─────┬──── dispositivo 1
         ├──── dispositivo 2
         ├──── dispositivo 3
         └──── ...

SCL ─────┬──── dispositivo 1
         ├──── dispositivo 2
         ├──── dispositivo 3
         └──── ...
```

Cada dispositivo possui um endereço I2C próprio.

Isso permite que futuros sensores compatíveis sejam adicionados ao mesmo
barramento, desde que não exista conflito de endereços.

O barramento atualmente utiliza:

``` text
SDA = GPIO 21
SCL = GPIO 22
```

------------------------------------------------------------------------

## 11. Organização das medições

As grandezas físicas atualmente disponíveis podem ser representadas por:

``` text
BMP180
│
├── temperatura ─────► temperatura principal
│
└── pressão
      │
      ├── pressão local
      └── pressão corrigida ao nível do mar


DHT11
│
├── umidade ─────────► umidade principal
│
└── temperatura ─────► medição auxiliar
```

Os valores brutos não constituem o resultado final do sistema. Eles
alimentam os algoritmos executados no ESP32 para gerar médias,
tendências, estados, eventos e alertas.

------------------------------------------------------------------------

## 12. Considerações sobre montagem

Para prototipagem, os sensores podem ser conectados por jumpers e
protoboard.

Para uma versão física mais permanente da estação, devem ser
considerados:

-   qualidade das conexões;
-   comprimento dos cabos;
-   interferência elétrica;
-   ventilação dos sensores;
-   proteção contra umidade direta;
-   posição dos sensores em relação ao ESP32;
-   aquecimento produzido pelos componentes eletrônicos;
-   proteção mecânica;
-   acesso para manutenção.

A localização física dos sensores influencia diretamente a qualidade das
medições ambientais.

Um sensor de temperatura instalado muito próximo de componentes que
dissipam calor pode apresentar valores superiores à temperatura real do
ambiente.

------------------------------------------------------------------------

## 13. Limitações dos sensores atuais

Os sensores utilizados são adequados para desenvolvimento, ensino e
validação da arquitetura, mas possuem limitações.

### DHT11

O DHT11 é um sensor simples e de baixo custo.

Para aplicações que exijam maior precisão, estabilidade ou faixa de
operação, pode ser substituído futuramente por sensores mais avançados.

### BMP180

O BMP180 é adequado para experimentação com pressão atmosférica, porém
existem gerações mais recentes de sensores barométricos com recursos e
desempenho superiores.

A arquitetura de software deve permitir futuras substituições sem
alterar os conceitos centrais do sistema.

------------------------------------------------------------------------

## 14. Possibilidades de expansão

A plataforma ESP32 permite incorporar novos sensores e periféricos.

Exemplos de grandezas que poderão ser exploradas futuramente:

-   luminosidade;
-   qualidade do ar;
-   CO₂;
-   compostos orgânicos voláteis;
-   material particulado;
-   ruído;
-   chuva;
-   velocidade do vento;
-   direção do vento;
-   radiação UV;
-   temperatura do solo;
-   umidade do solo.

Uma possível evolução seria:

``` text
                  ESP32
                    │
       ┌────────────┼─────────────┐
       │            │             │
     BMP180       DHT11      novos sensores
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                   CO₂           PM2.5         UV
```

A inclusão de sensores deve ser guiada pelos objetivos experimentais do
projeto, evitando adicionar hardware sem uma finalidade clara.

------------------------------------------------------------------------

## 15. Resumo do hardware

  Componente         Interface   GPIO      Grandezas/Função
  ------------------ ----------- --------- ------------------------------------
  ESP32 Dev Module   ---         ---       Processamento Edge e conectividade
  BMP180             I2C         21 / 22   Temperatura e pressão
  DHT11              Digital     4         Umidade e temperatura auxiliar
  LED                Digital     2         Heartbeat

A configuração atual é propositalmente enxuta. O valor principal do
projeto está na combinação entre **sensoriamento, processamento local,
conectividade e arquitetura Edge--Cloud**, mantendo uma base de hardware
simples e extensível.
