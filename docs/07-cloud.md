# Cloud e Telemetria da Estação Ambiental ESP32

Este documento descreve a camada Cloud da **Estação Ambiental ESP32**,
incluindo Supabase, PostgreSQL, API REST, estrutura da telemetria,
timestamps, segurança, Row Level Security (RLS), eventos e evolução para
o dashboard remoto.

> Documento referente à integração Cloud consolidada na fase
> **v3.4-RC1** do projeto.

------------------------------------------------------------------------

## Índice

-   [1. Visão geral](#1-visão-geral)
-   [2. Papel da Cloud](#2-papel-da-cloud)
-   [3. Arquitetura Edge--Cloud](#3-arquitetura-edgecloud)
-   [4. Supabase](#4-supabase)
-   [5. PostgreSQL](#5-postgresql)
-   [6. API REST](#6-api-rest)
-   [7. Fluxo da telemetria](#7-fluxo-da-telemetria)
-   [8. Periodicidade de envio](#8-periodicidade-de-envio)
    -   [8.1 Volume de amostras](#81-volume-de-amostras)
    -   [8.2 Estimativa de
        armazenamento](#82-estimativa-de-armazenamento)
-   [9. Snapshot ambiental](#9-snapshot-ambiental)
-   [10. Temperatura canônica](#10-temperatura-canônica)
-   [11. Dados calculados no Edge](#11-dados-calculados-no-edge)
-   [12. Tabela de leituras](#12-tabela-de-leituras)
-   [13. Tabela de eventos](#13-tabela-de-eventos)
-   [14. Data e hora](#14-data-e-hora)
    -   [14.1 UTC](#141-utc)
    -   [14.2 Horário local](#142-horário-local)
    -   [14.3 Epoch](#143-epoch)
-   [15. Migração do schema](#15-migração-do-schema)
-   [16. Campos legados](#16-campos-legados)
-   [17. RLS](#17-rls)
-   [18. Chaves e credenciais](#18-chaves-e-credenciais)
-   [19. Política de menor privilégio](#19-política-de-menor-privilégio)
-   [20. Operação durante
    indisponibilidade](#20-operação-durante-indisponibilidade)
-   [21. Fila resiliente futura](#21-fila-resiliente-futura)
-   [22. Prevenção de duplicidades](#22-prevenção-de-duplicidades)
-   [23. Histórico de curto e longo
    prazo](#23-histórico-de-curto-e-longo-prazo)
-   [24. Agregação histórica futura](#24-agregação-histórica-futura)
-   [25. Dashboard remoto](#25-dashboard-remoto)
-   [26. Separação entre backend e
    frontend](#26-separação-entre-backend-e-frontend)
-   [27. Múltiplas estações](#27-múltiplas-estações)
-   [28. Segurança da arquitetura](#28-segurança-da-arquitetura)
-   [29. Evoluções futuras](#29-evoluções-futuras)
-   [30. Resumo](#30-resumo)

------------------------------------------------------------------------

## 1. Visão geral

A camada Cloud amplia a capacidade da estação sem substituir o
processamento realizado no ESP32.

``` text
Sensores
   │
   ▼
ESP32
   │
   ├── aquisição
   ├── processamento
   ├── estados
   ├── eventos
   └── snapshot
          │
          │ HTTPS / REST
          ▼
      Supabase
          │
          ▼
      PostgreSQL
          │
          ▼
   histórico Cloud
```

O ESP32 continua sendo o nó responsável pela interpretação ambiental
imediata.

------------------------------------------------------------------------

## 2. Papel da Cloud

A Cloud é utilizada principalmente para:

-   persistência de longo prazo;
-   acesso remoto;
-   armazenamento de séries temporais;
-   análise histórica;
-   comparação entre períodos;
-   futura análise sazonal;
-   suporte ao dashboard remoto;
-   futuras integrações.

A Cloud não deve ser necessária para:

-   ler sensores;
-   calcular indicadores;
-   determinar estados;
-   detectar eventos;
-   operar o dashboard local.

------------------------------------------------------------------------

## 3. Arquitetura Edge--Cloud

O modelo adotado é:

``` text
                 EDGE                         CLOUD

Sensores ──► ESP32 ──────────────────────► Supabase
              │                               │
              ├── processamento               ▼
              ├── classificação           PostgreSQL
              ├── eventos                     │
              └── dashboard local             ▼
                                         histórico
```

A telemetria enviada à Cloud contém tanto grandezas medidas quanto
informações já derivadas no Edge.

------------------------------------------------------------------------

## 4. Supabase

O Supabase atua como backend da aplicação Cloud.

No projeto, ele fornece principalmente:

-   API REST;
-   banco PostgreSQL;
-   políticas de acesso;
-   infraestrutura para persistência;
-   base para futuras consultas do dashboard remoto.

O firmware utiliza a API do serviço, não uma conexão SQL direta com o
banco.

------------------------------------------------------------------------

## 5. PostgreSQL

As leituras ambientais são armazenadas em PostgreSQL.

A estrutura principal utiliza uma tabela de leituras e prevê uma tabela
separada para eventos.

Essa separação é importante porque as duas informações possuem naturezas
diferentes:

``` text
leituras
→ série temporal periódica

eventos
→ acontecimentos discretos
```

------------------------------------------------------------------------

## 6. API REST

A comunicação ESP32 → Supabase utiliza requisições HTTP/HTTPS REST.

Conceitualmente:

``` text
ESP32
 │
 │ POST
 ▼
REST API
 │
 ▼
Tabela leituras
```

O payload é enviado em formato JSON.

Exemplo conceitual:

``` json
{
  "estacao": "estacao-ambiental",
  "temperatura": 23.5,
  "umidade": 51.0,
  "pressao_mar": 1014.2
}
```

Esse exemplo é ilustrativo e não representa necessariamente todos os
campos do schema.

------------------------------------------------------------------------

## 7. Fluxo da telemetria

O fluxo completo é:

``` text
nova amostra
    │
    ▼
validar sensores
    │
    ▼
processar no Edge
    │
    ▼
atualizar indicadores
    │
    ▼
montar snapshot
    │
    ▼
serializar JSON
    │
    ▼
POST HTTPS
    │
    ▼
Supabase
    │
    ▼
PostgreSQL
```

O envio ocorre depois do processamento local.

------------------------------------------------------------------------

## 8. Periodicidade de envio

A telemetria atual utiliza aproximadamente uma amostra por minuto.

Se o intervalo entre envios for (`\Delta `{=tex}t) minutos, o número
teórico de registros por dia é:

$$
N_{\mathrm{dia}}=\frac{24\times60}{\Delta t}
$$

Para:

$$
\Delta t=1
$$

temos:

$$
N_{\mathrm{dia}}=1440
$$

### 8.1 Volume de amostras

Em um ano de 365 dias:

$$
N_{\mathrm{ano}}=1440\times365
$$

portanto:

$$
N_{\mathrm{ano}}=525600
$$

Assim, uma única estação operando continuamente a um registro por minuto
pode produzir aproximadamente **525.600 registros por ano**.

Para (E) estações:

$$
N_{\mathrm{total}}=E\times525600
$$

### 8.2 Estimativa de armazenamento

Se o tamanho médio efetivo de um registro, incluindo dados e overhead de
armazenamento, for aproximadamente (B) bytes, uma estimativa
simplificada é:

$$
S=N\times B
$$

Para um ano:

$$
S_{\mathrm{ano}}=525600\times B
$$

Esse cálculo é apenas uma aproximação, pois índices, alinhamento,
metadados, TOAST e outras estruturas do PostgreSQL também consomem
espaço.

------------------------------------------------------------------------

## 9. Snapshot ambiental

Cada envio representa o estado da estação em determinado instante.

O snapshot pode incluir:

-   identificação;
-   data e hora;
-   temperatura;
-   média de temperatura;
-   umidade;
-   média de umidade;
-   pressão;
-   médias de pressão;
-   mínimos e máximos;
-   horários dos extremos;
-   ponto de orvalho;
-   tendência;
-   estados ambientais;
-   alertas;
-   quantidade de amostras;
-   RSSI;
-   altitude;
-   dados externos.

Assim, a Cloud recebe uma representação rica do estado calculado no
Edge.

------------------------------------------------------------------------

## 10. Temperatura canônica

A arquitetura Cloud utiliza uma única temperatura principal.

A temperatura canônica é proveniente do:

``` text
BMP180
```

O DHT11 continua fornecendo umidade e pode manter sua temperatura como
informação auxiliar local, mas ela não é necessária como segunda
temperatura principal na série Cloud.

Essa decisão reduz ambiguidade na análise histórica.

------------------------------------------------------------------------

## 11. Dados calculados no Edge

A Cloud armazena também indicadores calculados pelo ESP32.

Por exemplo, para uma média de (N) amostras:

$$
\bar{x}=\frac{1}{N}\sum_{i=1}^{N}x_i
$$

A pressão ao nível do mar pode ser estimada por:

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

A tendência barométrica pode utilizar o coeficiente angular de uma
regressão linear:

$$
m=\frac{N\sum_{i=1}^{N}t_iP_i-\left(\sum_{i=1}^{N}t_i\right)\left(\sum_{i=1}^{N}P_i\right)}{N\sum_{i=1}^{N}t_i^2-\left(\sum_{i=1}^{N}t_i\right)^2}
$$

Esses exemplos mostram que a Cloud recebe **resultados de processamento
Edge**, e não somente valores crus.

------------------------------------------------------------------------

## 12. Tabela de leituras

A tabela principal é:

``` text
public.leituras
```

Ela armazena a série temporal da estação.

Os campos podem ser agrupados conceitualmente em:

``` text
identificação
├── estação
└── hostname

tempo
├── created_at
├── data_local
├── hora_local
└── epoch

sensores
├── temperatura
├── umidade
└── pressão

derivados
├── médias
├── extremos
├── ponto de orvalho
└── tendência

estados
├── umidade
├── conforto
├── instabilidade
├── anomalia
└── estado geral

operação
├── RSSI
├── amostras
└── altitude

externos
└── Open-Meteo
```

O dicionário de dados deve ser mantido junto à documentação do schema.

------------------------------------------------------------------------

## 13. Tabela de eventos

A arquitetura prevê:

``` text
public.eventos
```

para acontecimentos discretos.

Campos conceituais:

-   identificador;
-   timestamp;
-   estação;
-   data local;
-   hora local;
-   tipo;
-   mensagem.

Exemplos de eventos:

``` text
SISTEMA
WIFI
API
CLOUD
ALERTA
ESTADO
```

Separar eventos das leituras evita transformar a série temporal
periódica em um log textual.

------------------------------------------------------------------------

## 14. Data e hora

O projeto trabalha com mais de uma representação temporal.

### 14.1 UTC

O campo `created_at` do banco pode ser armazenado em UTC.

Por exemplo, para um fuso UTC−3:

$$
t_{\mathrm{local}}=t_{\mathrm{UTC}}-3\ \mathrm{h}
$$

Equivalentemente:

$$
t_{\mathrm{UTC}}=t_{\mathrm{local}}+3\ \mathrm{h}
$$

O uso de UTC no backend evita ambiguidades entre regiões.

### 14.2 Horário local

Campos como:

``` text
data_local
hora_local
```

preservam a representação operacional da estação.

Isso facilita leitura humana e reconstrução do contexto local.

### 14.3 Epoch

O timestamp Unix representa o número de segundos transcorridos desde:

``` text
1970-01-01 00:00:00 UTC
```

Se (t) é o instante atual:

$$
epoch=t-t_{\mathrm{UnixEpoch}}
$$

expresso em segundos.

Essa representação é útil para ordenação, cálculo de intervalos e
interoperabilidade.

------------------------------------------------------------------------

## 15. Migração do schema

Durante a evolução da PoC para a estrutura completa, o banco foi
alterado de maneira compatível com o firmware existente.

O princípio utilizado foi:

``` text
schema antigo
     │
     ▼
adicionar novos campos
     │
     ▼
firmware antigo continua funcionando
     │
     ▼
firmware novo passa a preencher novos campos
     │
     ▼
validar
     │
     ▼
remover legados futuramente
```

Essa estratégia reduz risco durante a migração.

------------------------------------------------------------------------

## 16. Campos legados

Durante a transição, campos antigos podem coexistir com os definitivos.

Exemplos conceituais:

``` text
pressao       → legado
pressao_mar   → definitivo

estado        → legado
estado_geral  → definitivo
```

Os campos legados só devem ser removidos depois que nenhuma versão ativa
do firmware depender deles.

------------------------------------------------------------------------

## 17. RLS

O Supabase utiliza **Row Level Security (RLS)** para controlar acesso
aos dados.

As políticas devem definir explicitamente quais operações cada tipo de
cliente pode executar.

Na fase de telemetria, o ESP32 necessita essencialmente da capacidade de
inserir registros.

Não é necessário conceder ao dispositivo privilégios administrativos.

------------------------------------------------------------------------

## 18. Chaves e credenciais

O firmware não deve conter:

-   `service_role`;
-   senha do banco;
-   chave administrativa;
-   segredos de backend.

Uma chave destinada a cliente com permissões limitadas pode ser
utilizada quando protegida por políticas adequadas de RLS.

Mesmo uma chave publicável deve possuir apenas as permissões necessárias
ao caso de uso.

------------------------------------------------------------------------

## 19. Política de menor privilégio

O princípio é:

``` text
ESP32
 │
 └── pode fazer apenas o necessário
```

Se o dispositivo precisa apenas inserir telemetria, não deve receber
permissões desnecessárias para:

-   apagar tabelas;
-   alterar schema;
-   administrar usuários;
-   executar operações privilegiadas.

Isso reduz o impacto potencial de comprometimento de um dispositivo.

------------------------------------------------------------------------

## 20. Operação durante indisponibilidade

Uma falha Cloud não deve interromper o Edge.

``` text
Supabase indisponível
        │
        ▼
falha de envio
        │
        ├── registrar transição
        │
        └── continuar:
             ├── sensores
             ├── cálculos
             ├── estados
             └── dashboard local
```

Essa separação já constitui uma propriedade importante da arquitetura.

------------------------------------------------------------------------

## 21. Fila resiliente futura

Uma evolução planejada é armazenar temporariamente snapshots que não
puderam ser enviados.

Para uma fila com capacidade (Q\_{`\max`{=tex}}):

$$
0\le Q\le Q_{\max}
$$

Se (A) novos snapshots forem adicionados e (R) forem reenviados com
sucesso durante determinado intervalo, uma relação simplificada para a
ocupação é:

$$
Q_{\mathrm{novo}}=\min(Q_{\max},Q_{\mathrm{anterior}}+A-R)
$$

respeitando a condição de que a ocupação não pode ser negativa.

Uma implementação deve definir explicitamente o comportamento quando a
fila atingir sua capacidade máxima.

------------------------------------------------------------------------

## 22. Prevenção de duplicidades

Ao reenviar dados, é importante evitar que o mesmo snapshot seja
armazenado duas vezes.

Uma estratégia futura é associar a cada registro um identificador único.

Conceitualmente:

``` text
snapshot
├── UUID
├── estação
├── timestamp
└── dados
```

O backend pode então utilizar uma restrição de unicidade.

Uma chave lógica possível seria formada por:

``` text
(estacao, identificador_snapshot)
```

ou outra estratégia equivalente.

------------------------------------------------------------------------

## 23. Histórico de curto e longo prazo

O ESP32 mantém aproximadamente uma hora de histórico operacional.

A Cloud possui finalidade diferente:

``` text
EDGE
└── minutos / hora recente

CLOUD
└── dias / meses / anos
```

Isso evita usar a memória limitada do microcontrolador para armazenar
séries temporais de longo prazo.

------------------------------------------------------------------------

## 24. Agregação histórica futura

Para períodos longos, pode ser desnecessário manter todas as
visualizações na resolução de um minuto.

Uma média horária, por exemplo, pode ser calculada por:

$$
\bar{x}_{\mathrm{hora}}=\frac{1}{N}\sum_{i=1}^{N}x_i
$$

Para dados completos a cada minuto, tipicamente:

$$
N\approx60
$$

Uma média diária pode utilizar:

$$
\bar{x}_{\mathrm{dia}}=\frac{1}{N_{\mathrm{dia}}}\sum_{i=1}^{N_{\mathrm{dia}}}x_i
$$

com:

$$
N_{\mathrm{dia}}\le1440
$$

dependendo da disponibilidade das amostras.

Também podem ser calculados mínimo e máximo por período:

$$
x_{\min}=\min(x_1,\ldots,x_N)
$$

$$
x_{\max}=\max(x_1,\ldots,x_N)
$$

Isso permitirá construir análises sazonais mantendo os dados brutos
quando necessário.

------------------------------------------------------------------------

## 25. Dashboard remoto

O dashboard remoto será consumidor dos dados Cloud.

Arquitetura prevista:

``` text
ESP32
  │
  ▼
Supabase
  │
  ▼
API / consultas
  │
  ▼
Dashboard Web remoto
```

Ele deverá reproduzir os principais indicadores do dashboard local e
acrescentar recursos históricos.

------------------------------------------------------------------------

## 26. Separação entre backend e frontend

Supabase e dashboard remoto possuem responsabilidades distintas.

``` text
Supabase
├── banco
├── API
├── autenticação
└── políticas

Frontend remoto
├── interface
├── gráficos
├── navegação
└── experiência do usuário
```

A hospedagem prevista para o frontend pode utilizar uma plataforma Web
específica, enquanto o Supabase permanece como backend.

------------------------------------------------------------------------

## 27. Múltiplas estações

A arquitetura Cloud permite receber telemetria de vários nós.

Se cada estação produzir (N) registros em determinado período e
existirem (E) estações:

$$
N_{\mathrm{total}}=E\times N
$$

Para um ano com uma leitura por minuto:

$$
N_{\mathrm{total}}=E\times525600
$$

Isso permite avaliar antecipadamente o crescimento do banco.

------------------------------------------------------------------------

## 28. Segurança da arquitetura

A segurança Cloud deve considerar:

-   HTTPS;
-   RLS;
-   menor privilégio;
-   separação de chaves;
-   ausência de segredos no Git;
-   autenticação futura do dashboard;
-   validação de dados;
-   políticas de leitura;
-   prevenção de operações administrativas pelo ESP32.

O dispositivo Edge deve ser tratado como cliente de telemetria, não como
administrador do backend.

------------------------------------------------------------------------

## 29. Evoluções futuras

A camada Cloud poderá incorporar:

-   envio de eventos;
-   fila resiliente;
-   reenvio ordenado;
-   UUID de snapshots;
-   dashboard remoto;
-   autenticação;
-   agregações históricas;
-   análise sazonal;
-   múltiplas estações;
-   alertas remotos;
-   integração com Alexa;
-   armazenamento de resultados TinyML;
-   análise comparativa Edge × Cloud.

------------------------------------------------------------------------

## 30. Resumo

A arquitetura Cloud complementa o nó Edge:

``` text
                    ESP32
                      │
              processa localmente
                      │
                      ▼
                   snapshot
                      │
                      ▼
                  Supabase
                      │
                      ▼
                 PostgreSQL
                      │
               ┌──────┴──────┐
               ▼             ▼
           histórico     dashboard
                           remoto
```

A decisão arquitetural central permanece:

> **a Cloud armazena, integra e amplia; o Edge mede, processa e
> interpreta.**

Essa divisão permite que a Estação Ambiental evolua para um sistema
distribuído sem perder a autonomia local do ESP32.
