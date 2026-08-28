# Firmware da Estação Ambiental ESP32

Este documento descreve a organização lógica, as responsabilidades e o
fluxo de execução do firmware da **Estação Ambiental ESP32**.

> Documento referente à arquitetura de firmware consolidada na fase
> **v3.4-RC1** do projeto.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Responsabilidades do firmware](#2-responsabilidades-do-firmware)
-   [3. Ciclo de execução](#3-ciclo-de-execução)
-   [4. Inicialização --- setup()](#4-inicialização--setup)
-   [5. Execução contínua --- loop()](#5-execução-contínua--loop)
-   [6. Aquisição dos sensores](#6-aquisição-dos-sensores)
-   [7. Temporização e tarefas
    periódicas](#7-temporização-e-tarefas-periódicas)
-   [8. Processamento ambiental](#8-processamento-ambiental)
    -   [8.1 Médias móveis](#81-médias-móveis)
    -   [8.2 Histórico de 60 minutos](#82-histórico-de-60-minutos)
    -   [8.3 Mínimos e máximos](#83-mínimos-e-máximos)
    -   [8.4 Pressão ao nível do mar](#84-pressão-ao-nível-do-mar)
    -   [8.5 Ponto de orvalho](#85-ponto-de-orvalho)
    -   [8.6 Tendência da pressão](#86-tendência-da-pressão)
-   [9. Estados ambientais](#9-estados-ambientais)
-   [10. Histerese temporal](#10-histerese-temporal)
-   [11. Detecção de anomalias e
    alertas](#11-detecção-de-anomalias-e-alertas)
-   [12. Sistema de eventos](#12-sistema-de-eventos)
-   [13. Wi-Fi e provisionamento](#13-wi-fi-e-provisionamento)
-   [14. NVS e configurações
    persistentes](#14-nvs-e-configurações-persistentes)
-   [15. mDNS](#15-mdns)
-   [16. Servidor Web local](#16-servidor-web-local)
-   [17. LittleFS](#17-littlefs)
-   [18. Integração com Open-Meteo](#18-integração-com-open-meteo)
-   [19. Telemetria Supabase](#19-telemetria-supabase)
-   [20. Heartbeat](#20-heartbeat)
-   [21. Tratamento de falhas](#21-tratamento-de-falhas)
-   [22. Uso da memória Flash](#22-uso-da-memória-flash)
-   [23. Organização atual do código](#23-organização-atual-do-código)
-   [24. Modularização futura](#24-modularização-futura)
-   [25. Fluxo completo do firmware](#25-fluxo-completo-do-firmware)
-   [26. Princípios de evolução](#26-princípios-de-evolução)
-   [27. Resumo](#27-resumo)

------------------------------------------------------------------------

## 1. Visão geral

O firmware é o núcleo operacional da estação.

Ele executa no ESP32 e coordena simultaneamente:

``` text
sensores
   │
   ▼
aquisição
   │
   ▼
processamento
   │
   ├── indicadores
   ├── estados
   ├── eventos
   └── alertas
   │
   ├────────► dashboard local
   ├────────► Open-Meteo
   └────────► Supabase
```

A lógica foi concebida para manter a operação local independente da
disponibilidade dos serviços Cloud.

------------------------------------------------------------------------

## 2. Responsabilidades do firmware

Entre as responsabilidades do firmware estão:

-   inicializar o hardware;
-   ler BMP180 e DHT11;
-   validar medições;
-   manter séries temporais;
-   calcular médias;
-   manter mínimos e máximos;
-   calcular pressão corrigida;
-   calcular ponto de orvalho;
-   analisar tendência barométrica;
-   determinar estados ambientais;
-   aplicar histerese;
-   detectar anomalias;
-   gerar alertas;
-   registrar eventos;
-   gerenciar Wi-Fi;
-   armazenar configurações;
-   executar servidor HTTP;
-   servir arquivos LittleFS;
-   consultar Open-Meteo;
-   enviar telemetria ao Supabase;
-   controlar o LED heartbeat.

------------------------------------------------------------------------

## 3. Ciclo de execução

Como aplicação baseada no Arduino Framework, o firmware possui dois
pontos fundamentais:

``` cpp
void setup() {
    // inicialização
}

void loop() {
    // execução contínua
}
```

O `setup()` é executado uma vez após a inicialização ou reinicialização.

O `loop()` é executado continuamente enquanto o ESP32 estiver
funcionando.

Entretanto, a arquitetura real é mais ampla do que esses dois blocos. O
`setup()` e o `loop()` funcionam como **orquestradores** de diversas
funções especializadas.

------------------------------------------------------------------------

## 4. Inicialização --- setup()

Durante a inicialização, o firmware prepara os subsistemas necessários.

Conceitualmente:

``` text
BOOT
 │
 ▼
Serial
 │
 ▼
GPIO / LED
 │
 ▼
I2C
 │
 ▼
Sensores
 │
 ▼
NVS
 │
 ▼
LittleFS
 │
 ▼
Wi-Fi
 │
 ▼
mDNS
 │
 ▼
Servidor Web
 │
 ▼
Serviços externos
 │
 ▼
Sistema operacional
```

A ordem é importante porque determinados serviços dependem da
inicialização anterior de outros componentes.

Por exemplo, a comunicação com Open-Meteo e Supabase depende de
conectividade de rede válida.

------------------------------------------------------------------------

## 5. Execução contínua --- loop()

O `loop()` coordena tarefas que possuem diferentes frequências.

Uma representação conceitual é:

``` text
loop()
 │
 ├── manter conectividade
 │
 ├── atender servidor Web
 │
 ├── atualizar heartbeat
 │
 ├── verificar temporizadores
 │
 ├── adquirir sensores
 │
 ├── processar dados
 │
 ├── atualizar estados
 │
 ├── consultar API externa
 │
 └── transmitir Cloud
 │
 └── repetir
```

O objetivo é evitar que uma tarefa bloqueie desnecessariamente as
demais.

------------------------------------------------------------------------

## 6. Aquisição dos sensores

As leituras ambientais são realizadas periodicamente.

Os sensores atuais são:

``` text
BMP180
├── temperatura
└── pressão

DHT11
├── umidade
└── temperatura auxiliar
```

O intervalo principal de amostragem consolidado é de aproximadamente:

``` text
60 segundos
```

A aquisição alimenta os buffers utilizados pelos algoritmos ambientais.

Valores inválidos devem ser identificados antes de alimentar cálculos
derivados.

------------------------------------------------------------------------

## 7. Temporização e tarefas periódicas

O firmware executa atividades em frequências diferentes.

Conceitualmente:

  Tarefa                            Periodicidade aproximada
  --------------------------------- --------------------------------
  Heartbeat                         contínua / subsegundo
  Servidor Web                      contínua
  Verificação de Wi-Fi              periódica
  Sensores                          60 s
  Processamento ambiental           após nova amostra
  Telemetria Cloud                  aproximadamente 60 s
  Open-Meteo                        conforme intervalo configurado
  Reset diário de mínimos/máximos   mudança de dia

A temporização deve preferencialmente utilizar comparação de tempo
baseada em `millis()` ou mecanismos equivalentes, evitando longos
`delay()` que bloqueiem o firmware.

------------------------------------------------------------------------

## 8. Processamento ambiental

Após uma leitura válida, o firmware atualiza as estruturas de
processamento.

### 8.1 Médias móveis

O sistema mantém médias móveis de 15 minutos.

Exemplo conceitual:

``` text
amostras
   │
   ├── t-14
   ├── t-13
   ├── ...
   ├── t-1
   └── t
        │
        ▼
   média 15 min
```

As médias reduzem oscilações instantâneas e permitem avaliar melhor o
comportamento ambiental.

### 8.2 Histórico de 60 minutos

O firmware mantém uma janela móvel de aproximadamente uma hora.

``` text
agora - 60 min ─────────────────────► agora
```

Com amostragem de um minuto, essa janela contém aproximadamente 60
observações.

Ela alimenta gráficos e análises temporais.

Considerando amostragem aproximadamente uniforme de um minuto, uma
janela de 60 minutos pode ser representada por:

$$
W_{60}(t)=\{x_{t-59},x_{t-58},\ldots,x_t\}
$$

e sua média por:

$$
\bar{x}_{60}=\frac{1}{N_{60}}\sum_{i=1}^{N_{60}}x_i
$$

onde (N\_{60}) corresponde ao número de amostras válidas existentes na
janela, limitado aproximadamente a 60 observações.

### 8.3 Mínimos e máximos

São mantidos valores extremos diários para grandezas ambientais
relevantes.

Além do valor, a estação pode registrar o horário em que o extremo
ocorreu.

Matematicamente, para o conjunto de amostras válidas (D) obtidas no dia:

$$
x_{\min}=\min_{x_i\in D}(x_i)
$$

$$
x_{\max}=\max_{x_i\in D}(x_i)
$$

Além dos valores, o firmware associa os instantes:

$$
t_{\min}=\operatorname*{arg\,min}_{t_i}(x_i)
$$

$$
t_{\max}=\operatorname*{arg\,max}_{t_i}(x_i)
$$

isto é, os horários em que os respectivos extremos ocorreram.

O ciclo é reiniciado diariamente.

### 8.4 Pressão ao nível do mar

A pressão medida pelo BMP180 corresponde à pressão na altitude da
estação.

O firmware calcula também uma pressão corrigida ao nível do mar,
utilizando a altitude configurada.

Isso permite uma comparação meteorológica mais apropriada entre
localidades com diferentes altitudes.

### 8.5 Ponto de orvalho

O ponto de orvalho é calculado a partir de temperatura e umidade
relativa.

Ele fornece uma indicação adicional sobre a quantidade de vapor de água
presente no ar.

### 8.6 Tendência da pressão

O firmware analisa a evolução temporal da pressão atmosférica.

Em vez de utilizar apenas duas amostras isoladas, o sistema pode estimar
a tendência a partir do histórico recente.

Para estimar a tendência de forma mais robusta, pode-se ajustar uma reta
aos pares ((t_i,P_i)) pelo método dos mínimos quadrados:

$$
P(t)=mt+b
$$

O coeficiente angular é:

$$
m=
\frac{
N\sum_{i=1}^{N}t_iP_i
-
\left(\sum_{i=1}^{N}t_i\right)
\left(\sum_{i=1}^{N}P_i\right)
}{
N\sum_{i=1}^{N}t_i^2
-
\left(\sum_{i=1}^{N}t_i\right)^2
}
$$

e o intercepto:

$$
b=
\frac{
\sum_{i=1}^{N}P_i
-
m\sum_{i=1}^{N}t_i
}{N}
$$

onde:

-   (P_i) é a pressão da amostra (i);
-   (t_i) é o instante associado à amostra;
-   \(N\) é o número de amostras;
-   \(m\) representa a taxa de variação da pressão.

Quando o tempo é expresso em horas, (m) pode ser interpretado
diretamente em:

$$
\mathrm{hPa/h}
$$

De maneira geral:

$$
m>0 \Rightarrow \text{pressão crescente}
$$

$$
m\approx0 \Rightarrow \text{pressão estável}
$$

$$
m<0 \Rightarrow \text{pressão decrescente}
$$

Os limiares usados para transformar o valor numérico de (m) em uma
classe ambiental devem ser os definidos no firmware.

O resultado é expresso de forma interpretável, como:

``` text
pressão subindo
pressão estável
pressão caindo
```

e pode também ser representado numericamente em hPa/h.

Uma variação simples entre dois instantes também pode ser expressa por:

$$
\Delta P=P_{\text{atual}}-P_{\text{anterior}}
$$

ou, para uma janela temporal:

$$
\Delta P_{\Delta t}=P(t)-P(t-\Delta t)
$$

A regressão linear, entretanto, utiliza o conjunto de observações da
janela e tende a ser menos sensível a uma única leitura isolada.

------------------------------------------------------------------------

## 9. Estados ambientais

Os indicadores calculados são transformados em estados interpretáveis.

Exemplos:

``` text
Umidade
├── seca
├── moderada
└── elevada

Conforto
├── confortável
└── desconfortável

Pressão
├── subindo
├── estável
└── caindo

Sistema
├── normal
├── atenção
└── alerta
```

Os estados permitem que o dashboard apresente **informação
interpretada**, e não apenas números.

------------------------------------------------------------------------

## 10. Histerese temporal

Mudanças instantâneas próximas aos limites de classificação podem
provocar alternância excessiva de estados.

Para evitar esse comportamento, o firmware utiliza histerese temporal.

Conceitualmente:

``` text
nova condição detectada
        │
        ▼
permaneceu tempo suficiente?
        │
      ┌─┴─┐
     não  sim
      │    │
      │    ▼
      │  alterar estado
      │
      └── manter estado anterior
```

Isso aumenta a estabilidade das classificações apresentadas ao usuário.

------------------------------------------------------------------------

## 11. Detecção de anomalias e alertas

O firmware analisa os indicadores ambientais para identificar situações
que mereçam atenção.

O princípio é:

``` text
dados
  │
  ▼
indicadores
  │
  ▼
regras
  │
  ├── condição normal
  └── condição anômala
           │
           ▼
         alerta
```

A arquitetura permite que regras determinísticas atuais sejam
futuramente complementadas por modelos TinyML.

------------------------------------------------------------------------

## 12. Sistema de eventos

O sistema mantém um registro de acontecimentos relevantes.

Exemplos:

-   inicialização;
-   conexão Wi-Fi;
-   conexão com API;
-   falha de API;
-   recuperação da API;
-   conexão com Cloud;
-   falha de Cloud;
-   recuperação da Cloud;
-   alterações de estado;
-   alertas.

O dashboard local apresenta uma lista dos eventos recentes.

Uma decisão importante é evitar registrar repetidamente o mesmo estado
em cada ciclo. Eventos de conectividade devem ser gerados principalmente
quando ocorre **transição de estado**.

------------------------------------------------------------------------

## 13. Wi-Fi e provisionamento

O firmware gerencia múltiplas redes Wi-Fi conhecidas.

Fluxo simplificado:

``` text
BOOT
 │
 ▼
carregar redes conhecidas
 │
 ▼
procurar redes disponíveis
 │
 ├── rede conhecida encontrada
 │          │
 │          ▼
 │       conectar
 │
 └── nenhuma encontrada
            │
            ▼
      modo configuração
            │
            ▼
        Access Point
```

O portal de configuração permite cadastrar uma nova rede sem recompilar
o firmware.

------------------------------------------------------------------------

## 14. NVS e configurações persistentes

O NVS é utilizado para armazenar parâmetros que precisam sobreviver a
reinicializações.

Exemplos:

-   redes Wi-Fi;
-   identificação da estação;
-   hostname;
-   cidade;
-   altitude;
-   parâmetros de configuração.

A separação entre firmware e configuração permite utilizar o mesmo
binário em diferentes instalações.

------------------------------------------------------------------------

## 15. mDNS

O mDNS permite acessar a estação por nome na rede local.

Exemplo:

``` text
http://estacao-ambiental.local
```

Isso evita depender diretamente do endereço IP atribuído pelo roteador.

O hostname é configurável e persistido.

------------------------------------------------------------------------

## 16. Servidor Web local

O ESP32 executa um servidor HTTP.

Ele é responsável por:

-   servir a página principal;
-   disponibilizar CSS;
-   disponibilizar JavaScript;
-   disponibilizar favicon;
-   fornecer dados ambientais;
-   receber determinadas ações de configuração.

A interface Web é desacoplada da lógica visual do firmware por meio dos
arquivos armazenados no LittleFS.

------------------------------------------------------------------------

## 17. LittleFS

O LittleFS armazena os arquivos estáticos do dashboard:

``` text
data/
├── index.html
├── style.css
├── app.js
└── favicon.png
```

O firmware e o sistema de arquivos são enviados separadamente.

No projeto, o arquivo `partitions.csv` reserva uma região específica da
Flash para o filesystem.

Embora a tabela de partições utilize o nome/subtipo compatível `spiffs`,
essa partição é montada e utilizada pelo firmware através da biblioteca
LittleFS.

------------------------------------------------------------------------

## 18. Integração com Open-Meteo

O firmware atua como cliente HTTP para obter dados meteorológicos
externos.

O processo pode ser representado por:

``` text
ESP32
 │
 ├── localização configurada
 │
 ▼
Open-Meteo
 │
 ▼
JSON
 │
 ▼
ESP32
 │
 ├── interpretação
 ├── armazenamento temporário
 └── apresentação no dashboard
```

Também são utilizados serviços de geocodificação e altitude.

Falhas da API externa não devem interromper a aquisição dos sensores
locais.

------------------------------------------------------------------------

## 19. Telemetria Supabase

O ESP32 envia snapshots ambientais ao Supabase através de requisições
REST.

O payload contém informações como:

-   identificação da estação;
-   data e hora;
-   temperatura BMP180;
-   médias;
-   umidade;
-   pressão;
-   extremos;
-   tendência;
-   estados ambientais;
-   alertas;
-   RSSI;
-   altitude;
-   dados meteorológicos externos relevantes.

O envio Cloud é complementar à operação local.

A indisponibilidade do Supabase não deve impedir o processamento Edge.

------------------------------------------------------------------------

## 20. Heartbeat

O LED do GPIO 2 funciona como indicador visual de atividade do firmware.

O padrão atual utiliza dois pulsos de aproximadamente 100 ms, separados
por aproximadamente 100 ms, seguidos por cerca de um segundo de repouso.

O heartbeat permite identificar rapidamente se o firmware continua
executando.

------------------------------------------------------------------------

## 21. Tratamento de falhas

A arquitetura busca isolar falhas externas.

Exemplos:

``` text
falha DHT11
   │
   └── não deve derrubar servidor Web

falha Open-Meteo
   │
   └── não deve interromper sensores

falha Supabase
   │
   └── não deve interromper processamento Edge

falha Internet
   │
   └── dashboard local deve permanecer disponível
```

Uma evolução planejada é criar uma fila local para telemetria não
enviada, permitindo reenvio após recuperação da conectividade.

------------------------------------------------------------------------

## 22. Uso da memória Flash

O crescimento do firmware tornou insuficiente a partição APP padrão
anteriormente utilizada.

Foi criada uma tabela personalizada para a Flash física de 4 MB:

``` text
NVS
OTA Data
APP0  ───── 1,625 MiB
APP1  ───── 1,625 MiB
LittleFS ── 704 KiB
```

APP0 e APP1 preservam a possibilidade de atualização OTA.

O tamanho real disponível para o firmware deve ser comparado com o
tamanho das partições APP definidas no `partitions.csv`.

------------------------------------------------------------------------

## 23. Organização atual do código

Na fase atual, grande parte da aplicação ainda pode estar concentrada no
sketch principal:

``` text
EstacaoAmbiental.ino
```

Esse modelo foi adequado durante a fase experimental, pois facilitou
alterações rápidas e validação incremental.

Entretanto, à medida que o projeto amadurece, o crescimento do código
torna desejável uma separação por responsabilidades.

------------------------------------------------------------------------

## 24. Modularização futura

Uma evolução natural será dividir o firmware em módulos `.cpp` e `.h`.

Exemplo:

``` text
firmware/estacao_ambiental/
│
├── EstacaoAmbiental.ino
├── Sensors.h
├── Sensors.cpp
├── Environment.h
├── Environment.cpp
├── Network.h
├── Network.cpp
├── Cloud.h
├── Cloud.cpp
├── WebServerApp.h
├── WebServerApp.cpp
├── Events.h
├── Events.cpp
├── Config.h
├── Config.cpp
├── partitions.csv
│
└── data/
```

Nesse modelo, o `.ino` passa a funcionar principalmente como
coordenador.

Por exemplo:

``` cpp
void setup() {
    iniciarSensores();
    iniciarConfiguracao();
    iniciarRede();
    iniciarServidor();
    iniciarCloud();
}

void loop() {
    atualizarSensores();
    processarAmbiente();
    atualizarRede();
    atualizarServidor();
    atualizarCloud();
}
```

Os arquivos `.cpp/.h` não precisam necessariamente constituir
bibliotecas externas instaladas no Arduino IDE. Eles podem fazer parte
do próprio projeto e ser compilados juntamente com o sketch.

Essa modularização melhora:

-   legibilidade;
-   manutenção;
-   testes;
-   reutilização;
-   divisão de responsabilidades;
-   evolução do projeto.

------------------------------------------------------------------------

## 25. Fluxo completo do firmware

A operação geral pode ser resumida por:

``` text
                       BOOT
                         │
                         ▼
                    inicialização
                         │
                         ▼
                  carregar configuração
                         │
                         ▼
                   conectar Wi-Fi
                         │
                         ▼
                  iniciar serviços
                         │
                         ▼
                 ┌────── LOOP ──────┐
                 │                  │
                 ▼                  │
             nova amostra?          │
                 │                  │
                sim                 │
                 │                  │
                 ▼                  │
             ler sensores           │
                 │                  │
                 ▼                  │
              validar               │
                 │                  │
                 ▼                  │
             processar              │
                 │                  │
          ┌──────┼───────┐          │
          ▼      ▼       ▼          │
       médias  estados  eventos     │
          │      │       │          │
          └──────┼───────┘          │
                 ▼                  │
          atualizar dados           │
                 │                  │
        ┌────────┼─────────┐        │
        ▼        ▼         ▼        │
     Web local  API     Cloud       │
        │        │         │        │
        └────────┴─────────┘        │
                 │                  │
                 └──────────────────┘
```

------------------------------------------------------------------------

## 26. Princípios de evolução

As próximas versões do firmware devem preservar alguns princípios:

1.  processamento ambiental local deve continuar funcionando sem Cloud;
2.  novas funcionalidades não devem bloquear o ciclo principal;
3.  credenciais privadas não devem ser versionadas;
4.  módulos devem possuir responsabilidades claras;
5.  falhas externas devem ser isoladas;
6.  o histórico recente deve permanecer disponível no Edge;
7.  alterações relevantes devem ser documentadas;
8.  a compatibilidade com OTA deve ser preservada;
9.  o uso de Flash e RAM deve ser monitorado;
10. TinyML, quando incorporado, deve complementar a arquitetura
    existente.

------------------------------------------------------------------------

## 27. Resumo

O firmware transforma o ESP32 de um simples leitor de sensores em um
**nó computacional autônomo**.

Sua função pode ser resumida por:

``` text
MEDIR
  │
  ▼
PROCESSAR
  │
  ▼
INTERPRETAR
  │
  ├──► APRESENTAR LOCALMENTE
  │
  ├──► REGISTRAR EVENTOS
  │
  └──► COMPARTILHAR COM A CLOUD
```

Essa organização é o elemento central que caracteriza a Estação
Ambiental como uma plataforma experimental de **Computação de Borda**.
