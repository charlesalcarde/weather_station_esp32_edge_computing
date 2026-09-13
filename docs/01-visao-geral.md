# Visão Geral — Estação Ambiental ESP32

## Índice

- [1. Apresentação](#1-apresentação)
- [2. Motivação](#2-motivação)
- [3. Objetivos](#3-objetivos)
  - [3.1 Objetivo técnico](#31-objetivo-técnico)
  - [3.2 Objetivo acadêmico](#32-objetivo-acadêmico)
- [4. Escopo atual](#4-escopo-atual)
- [5. Visão funcional](#5-visão-funcional)
- [6. Princípios da plataforma](#6-princípios-da-plataforma)
  - [6.1 Edge primeiro](#61-edge-primeiro)
  - [6.2 Cloud como extensão](#62-cloud-como-extensão)
  - [6.3 Autonomia local](#63-autonomia-local)
  - [6.4 Evolução incremental](#64-evolução-incremental)
- [7. Computação de Borda no projeto](#7-computação-de-borda-no-projeto)
- [8. Componentes principais](#8-componentes-principais)
- [9. Evolução da plataforma](#9-evolução-da-plataforma)
- [10. Operação local e remota](#10-operação-local-e-remota)
- [11. Separação entre localização, referência externa e campanha](#11-separação-entre-localização-referência-externa-e-campanha)
- [12. Limites e estágio experimental](#12-limites-e-estágio-experimental)
- [13. Direções de evolução](#13-direções-de-evolução)
- [14. Organização da documentação](#14-organização-da-documentação)
- [15. Síntese](#15-síntese)

---

## 1. Apresentação

A **Estação Ambiental ESP32** é uma plataforma experimental desenvolvida para estudo e aplicação prática de conceitos de **Computação de Borda (Edge Computing)**.

O projeto utiliza um ESP32 conectado a sensores ambientais para adquirir informações do meio físico e processá-las localmente. Ao longo de sua evolução, a estação deixou de ser apenas um sistema de aquisição e passou a integrar processamento temporal, classificação de estados, detecção de eventos, interface Web local, telemetria Cloud, dashboard remoto e mecanismos de atualização OTA.

> **Estado da plataforma documentado a partir do firmware v3.6.7.**

A proposta central é utilizar a estação como um laboratório evolutivo no qual conceitos de sistemas embarcados, IoT, Edge Computing, Cloud Computing, séries temporais, resiliência e, futuramente, TinyML possam ser estudados sobre uma implementação real.

---

## 2. Motivação

Uma arquitetura IoT simples poderia ser construída fazendo o dispositivo apenas coletar valores dos sensores e enviá-los para um servidor.

Neste projeto foi adotada uma abordagem diferente.

O ESP32 deve ser capaz de transformar dados físicos em informação útil antes mesmo da comunicação com a Cloud.

A evolução conceitual pode ser representada por:

```text
Sensor
   ↓
Dado bruto
   ↓
Processamento local
   ↓
Métrica derivada
   ↓
Interpretação
   ↓
Estado / evento
   ↓
Ação local e/ou Cloud
```

Essa abordagem permite estudar diretamente a pergunta central da Computação de Borda:

> **Quanto do processamento pode e deve ocorrer próximo da fonte dos dados?**

A estação torna essa questão observável em um sistema físico real.

---

## 3. Objetivos

### 3.1 Objetivo técnico

Desenvolver uma plataforma ambiental capaz de:

- adquirir dados de sensores;
- validar leituras;
- processar séries temporais;
- calcular métricas derivadas;
- identificar tendências;
- classificar condições ambientais;
- gerar eventos e alertas;
- apresentar dados localmente;
- comparar medições com uma referência meteorológica externa;
- armazenar telemetria na Cloud;
- disponibilizar visualização pela Internet;
- continuar executando funções locais quando serviços externos estiverem indisponíveis;
- receber atualizações de firmware remotamente.

### 3.2 Objetivo acadêmico

Utilizar a plataforma para estudar, experimentar e documentar conceitos relacionados a:

- Computação de Borda;
- Internet das Coisas;
- sistemas embarcados;
- sistemas distribuídos;
- integração Edge--Cloud;
- processamento de séries temporais;
- disponibilidade;
- tolerância a falhas;
- observabilidade;
- atualização e gerenciamento remoto;
- TinyML;
- eficiência computacional.

---

## 4. Escopo atual

A plataforma documentada a partir da versão **v3.6.7** possui como elementos principais:

```text
Sensores ambientais
        ↓
      ESP32
        ↓
processamento Edge
   ┌────┼───────────────┐
   │    │               │
   ▼    ▼               ▼
Local  Cloud        Serviços externos
   │    │               │
   │    ▼               ▼
   │ Supabase       Open-Meteo
   │    │
   │    ▼
   │  Vercel
   │    │
   │    ▼
   │ Dashboard remoto
   │
   ▼
Dashboard local
```

Em paralelo, o GitHub passou a participar do ciclo operacional da estação:

```text
Desenvolvimento
      ↓
GitHub Release
      ↓
version.json
      ↓
OTA HTTPS
      ↓
ESP32
```

Assim, a plataforma possui atualmente fluxos tanto de **dados** quanto de **manutenção remota**.

---

## 5. Visão funcional

Do ponto de vista funcional, a estação pode ser dividida em seis blocos:

```text
1. AQUISIÇÃO
   sensores

2. PROCESSAMENTO
   métricas / médias / tendências

3. INTERPRETAÇÃO
   estados / alertas / eventos

4. APRESENTAÇÃO LOCAL
   dashboard no ESP32

5. INTEGRAÇÃO REMOTA
   Supabase / Vercel / Open-Meteo

6. MANUTENÇÃO
   ArduinoOTA / OTA HTTPS
```

Essa divisão ajuda a distinguir funções que frequentemente aparecem misturadas em sistemas IoT.

---

## 6. Princípios da plataforma

### 6.1 Edge primeiro

A principal diretriz arquitetural é:

> **Edge primeiro; Cloud como extensão.**

Métricas e decisões que podem ser produzidas localmente devem, sempre que adequado, ser calculadas no ESP32.

Isso reduz:

- latência;
- dependência da Internet;
- tráfego desnecessário;
- necessidade de processamento remoto para funções básicas.

### 6.2 Cloud como extensão

A Cloud complementa o Edge principalmente com:

- persistência;
- histórico;
- acesso remoto;
- consolidação;
- visualização externa;
- suporte a análises posteriores.

O objetivo não é transformar o ESP32 em um simples terminal da Cloud.

### 6.3 Autonomia local

A perda temporária de acesso à Internet não deve impedir a estação de:

- ler sensores;
- calcular métricas;
- atualizar estados;
- detectar eventos;
- disponibilizar sua interface local.

### 6.4 Evolução incremental

A plataforma é desenvolvida de maneira progressiva.

Cada nova funcionalidade deve aproveitar a arquitetura existente e preservar, sempre que possível, os recursos já validados.

---

## 7. Computação de Borda no projeto

A estação caracteriza-se como um nó Edge porque executa processamento próximo à origem física dos dados.

Exemplos incluem:

- média móvel de 15 minutos;
- histórico recente;
- mínimos e máximos;
- pressão corrigida para o nível do mar;
- ponto de orvalho;
- tendência barométrica;
- classificação da umidade;
- conforto ambiental;
- avaliação de instabilidade;
- detecção de anomalias;
- estados ambientais;
- eventos.

O fluxo não é simplesmente:

```text
Sensor
   ↓
ESP32
   ↓
Cloud
```

Ele é:

```text
Sensor
   ↓
ESP32
   │
   ├── valida
   ├── processa
   ├── agrega
   ├── interpreta
   ├── classifica
   └── detecta eventos
           ↓
         Cloud
```

A Cloud recebe, portanto, informação produzida pelo Edge e não apenas leituras brutas.

---

## 8. Componentes principais

### ESP32

É o núcleo computacional da plataforma e executa:

- aquisição;
- processamento;
- servidor Web local;
- conectividade;
- integração externa;
- telemetria;
- OTA.

### BMP180

Fornece:

- pressão atmosférica;
- temperatura utilizada como referência principal da plataforma.

### DHT11

Fornece:

- umidade relativa;
- temperatura auxiliar.

### LittleFS

Armazena os recursos utilizados pela interface Web local.

### Open-Meteo

Fornece referência meteorológica externa para comparação contextual.

### Supabase

Recebe e persiste a telemetria produzida pela estação.

### Vercel

Hospeda o dashboard Web remoto.

### GitHub

É utilizado para:

- código-fonte;
- documentação;
- histórico do projeto;
- Releases;
- distribuição dos binários utilizados pela OTA remota.

---

## 9. Evolução da plataforma

O projeto evoluiu em etapas.

### Etapa inicial

```text
Sensor
   ↓
ESP32
   ↓
Serial
```

O foco estava na aquisição e compreensão do hardware.

### Processamento Edge

```text
Sensores
   ↓
ESP32
   ↓
métricas
   ↓
estados
```

A estação passou a interpretar os dados localmente.

### Interface local

```text
ESP32
   ↓
servidor Web
   ↓
dashboard local
```

O dispositivo passou a disponibilizar sua própria interface.

### Integração externa

```text
ESP32
   ↕
Open-Meteo
```

Foi introduzida uma referência meteorológica externa.

### Edge → Cloud

```text
ESP32
   ↓
Supabase
```

A telemetria passou a ser persistida remotamente.

### Dashboard remoto

```text
ESP32
   ↓
Supabase
   ↓
Vercel
```

Os resultados passaram a ser acessíveis pela Internet.

### OTA local

O ArduinoOTA eliminou a necessidade de conexão USB para diversas atualizações realizadas dentro da rede local.

### OTA pela Internet

Na evolução até a **v3.6.7**, foi validado o ciclo:

```text
GitHub Release
      ↓
version.json
      ↓
ESP32
      ↓
download HTTPS
      ↓
SHA-256
      ↓
partição OTA
      ↓
reboot
      ↓
nova versão
```

Essa etapa tornou possível evoluir o firmware mesmo quando o equipamento não está fisicamente acessível.

---

## 10. Operação local e remota

A plataforma possui atualmente dois contextos de operação.

### Operação local

```text
ESP32
   ↓
LAN
   ↓
dashboard local
```

Permite acesso direto ao nó Edge.

### Operação remota

```text
ESP32
   ↓
Supabase
   ↓
Vercel
   ↓
Internet
```

Permite acompanhar os resultados à distância.

A OTA acrescenta um terceiro aspecto:

```text
GitHub
   ↓
Internet
   ↓
ESP32
```

permitindo também **manutenção remota**.

Essa combinação é particularmente importante durante a fase experimental, pois novas métricas podem ser desenvolvidas, instaladas e observadas mesmo sem presença física junto à estação.

---

## 11. Separação entre localização, referência externa e campanha

A plataforma deve distinguir três conceitos.

### Localização física

É o local real onde o equipamento está instalado.

Influencia:

- altitude física;
- correções dependentes de altitude;
- contexto da série histórica.

### Referência meteorológica externa

É a localidade consultada no Open-Meteo.

Ela pode ser alterada para fins de comparação sem modificar a localização física da estação.

### Campanha de medição

Representa um período coerente de aquisição em determinado local e contexto.

A arquitetura futura deverá tratar uma mudança física da estação como uma mudança de campanha:

```text
encerrar campanha
      ↓
confirmar nova localização
      ↓
atualizar altitude
      ↓
iniciar nova campanha
```

Essa separação protege a coerência dos dados históricos.

---

## 12. Limites e estágio experimental

A estação é uma plataforma experimental e não deve ser confundida, no estágio atual, com equipamento meteorológico certificado ou sistema de proteção de missão crítica.

Entre as limitações e pontos ainda em evolução estão:

- DHT11 de classe experimental;
- ausência de redundância de sensores;
- dependência de Wi-Fi para funções remotas;
- ausência atual de buffer persistente completo para falhas Edge--Cloud;
- segurança TLS ainda em processo de endurecimento;
- rollback OTA automático ainda não consolidado;
- autenticação e gestão de dispositivos ainda em evolução;
- ausência de calibração metrológica formal.

Essas limitações fazem parte do próprio objeto de estudo e orientam as próximas etapas.

---

## 13. Direções de evolução

As principais frentes previstas incluem:

- verificação OTA aproximadamente a cada 5 minutos;
- atualização automática temporária durante a fase experimental;
- downgrade remoto autorizado;
- rollback automático;
- validação de saúde após atualização;
- eventos OTA na Cloud;
- TLS com validação adequada;
- OTA do LittleFS;
- CI/CD com GitHub Actions;
- buffer local e reenvio de telemetria;
- histórico de longo prazo;
- análise sazonal;
- observabilidade do nó Edge;
- múltiplas estações;
- modularização do firmware;
- TinyML;
- detecção inteligente de anomalias;
- novos sensores;
- expansão para energia, água e outros domínios de monitoramento.

---

## 14. Organização da documentação

O `README.md` é a porta de entrada do repositório.

Este documento, `01-visao-geral.md`, apresenta a motivação, o escopo e a evolução conceitual da plataforma.

Os detalhes técnicos são mantidos em documentos especializados.

Estrutura conceitual:

```text
README.md
   │
   ├── docs/01-visao-geral.md
   │
   ├── docs/02-arquitetura.md
   │
   ├── docs/03-hardware.md
   │
   ├── docs/04-firmware.md
   │
   ├── docs/05-dashboard-local.md
   │
   ├── docs/06-conectividade.md
   │
   ├── docs/07-cloud.md
   │
   ├── docs/08-particionamento-flash.md
   │
   ├── docs/09-instalacao.md
   │
   ├── docs/10-operacao.md
   │
   ├── docs/11-processamento-edge.md
   │
   ├── docs/12-roadmap.md
   │
   └── docs/14-ota-remota.md
```

Em particular:

- `README.md` — apresentação e navegação do repositório;
- `01-visao-geral.md` — visão conceitual e evolução;
- `02-arquitetura.md` — arquitetura técnica consolidada;
- `ota-remota.md` — ciclo de atualização remota, integridade, segurança e evolução OTA.

---

## 15. Síntese

A Estação Ambiental ESP32 evoluiu de um experimento de aquisição para uma plataforma distribuída de Computação de Borda.

Sua lógica fundamental pode ser resumida por:

```text
MUNDO FÍSICO
     ↓
SENSORES
     ↓
EDGE
     ↓
PROCESSAMENTO
     ↓
INTERPRETAÇÃO
     ↓
DECISÃO LOCAL
     ↓
CLOUD
     ↓
HISTÓRICO E ACESSO REMOTO
```

Ao mesmo tempo, o ciclo de manutenção evoluiu para:

```text
DESENVOLVIMENTO
     ↓
GITHUB
     ↓
OTA
     ↓
EDGE ATUALIZADO
```

Assim, o projeto passa a estudar não apenas **onde os dados são processados**, mas também como um nó Edge pode ser observado, mantido e evoluído remotamente.

Essa combinação transforma a estação em uma base experimental para investigação de arquiteturas Edge--Cloud cada vez mais autônomas, resilientes e inteligentes.
