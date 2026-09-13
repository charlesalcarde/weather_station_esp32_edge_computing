# Estação Ambiental ESP32

Estação ambiental experimental baseada em ESP32 desenvolvida como plataforma de estudo, desenvolvimento e experimentação em **Computação de Borda (Edge Computing)**.

O sistema realiza aquisição de dados ambientais, processamento local, análise temporal, classificação das condições ambientais, detecção de eventos, visualização por dashboard Web local, telemetria Cloud, dashboard remoto e atualização de firmware OTA pela rede local e pela Internet.

> **Estado da plataforma documentado a partir do firmware v3.6.7.**

---

## Índice

- [1. Visão geral](#1-visão-geral)
- [2. Objetivos do projeto](#2-objetivos-do-projeto)
- [3. Arquitetura](#3-arquitetura)
- [4. Hardware](#4-hardware)
  - [4.1 Microcontrolador](#41-microcontrolador)
  - [4.2 Sensores](#42-sensores)
- [5. Processamento de borda](#5-processamento-de-borda)
- [6. Dashboard local](#6-dashboard-local)
- [7. Conectividade](#7-conectividade)
- [8. Fonte meteorológica externa](#8-fonte-meteorológica-externa)
- [9. Integração Cloud](#9-integração-cloud)
  - [9.1 Supabase](#91-supabase)
  - [9.2 Dashboard remoto](#92-dashboard-remoto)
- [10. Atualização OTA](#10-atualização-ota)
  - [10.1 OTA local](#101-ota-local)
  - [10.2 OTA remota HTTPS](#102-ota-remota-https)
- [11. Particionamento da Flash](#11-particionamento-da-flash)
- [12. Estrutura do repositório](#12-estrutura-do-repositório)
- [13. Documentação](#13-documentação)
- [14. Tecnologias utilizadas](#14-tecnologias-utilizadas)
- [15. Instalação e publicação](#15-instalação-e-publicação)
- [16. Operação](#16-operação)
- [17. Segurança](#17-segurança)
- [18. Estado atual](#18-estado-atual)
- [19. Roadmap](#19-roadmap)
- [20. Contexto acadêmico](#20-contexto-acadêmico)
- [21. Licença](#21-licença)

---

## 1. Visão geral

A **Estação Ambiental ESP32** foi concebida para explorar uma arquitetura em que o dispositivo de borda não atua apenas como coletor e transmissor de dados.

O próprio ESP32 executa parte significativa do processamento:

- aquisição dos sensores;
- validação das leituras;
- cálculo da pressão atmosférica corrigida ao nível do mar;
- cálculo do ponto de orvalho;
- médias móveis;
- manutenção de histórico recente;
- mínimos e máximos diários;
- análise de tendência da pressão;
- avaliação de umidade e conforto ambiental;
- avaliação experimental de instabilidade;
- detecção de anomalias;
- classificação do estado ambiental;
- geração de alertas e eventos;
- disponibilização de dashboard Web local;
- integração com fonte meteorológica externa;
- envio de telemetria para a Cloud;
- manutenção remota do firmware por OTA.

Dessa forma, a estação mantém capacidade local de **medir, processar, interpretar e apresentar informações**, enquanto utiliza serviços externos para persistência, acesso remoto, comparação meteorológica e manutenção.

A diretriz arquitetural do projeto é:

> **Edge primeiro; Cloud como extensão.**

---

## 2. Objetivos do projeto

O projeto possui objetivos técnicos e acadêmicos.

Do ponto de vista técnico, busca desenvolver uma estação capaz de:

- adquirir variáveis ambientais;
- processar séries temporais no próprio microcontrolador;
- produzir indicadores derivados;
- operar de forma autônoma na rede local;
- integrar dados locais e externos;
- armazenar histórico na Cloud;
- permitir acompanhamento remoto;
- permitir evolução do firmware sem acesso físico ao equipamento;
- servir como base para futuras técnicas de TinyML.

Do ponto de vista acadêmico, a estação funciona como uma plataforma experimental para estudar **Computação de Borda, IoT, sistemas distribuídos, resiliência Edge--Cloud, séries temporais, manutenção remota e inferência local**.

---

## 3. Arquitetura

A arquitetura atual combina processamento **Edge**, persistência **Cloud**, visualização remota e distribuição de firmware.

```text
                         INTERNET
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
          ▼                 ▼                  ▼
     Open-Meteo          Supabase            GitHub
  referência externa     PostgreSQL     código / releases
          │                 ▲                  │
          │                 │ HTTPS            │ OTA HTTPS
          │                 │                  ▼
          │          ┌──────┴──────────────────────┐
          └─────────▶│            ESP32            │
                     │      Processamento Edge     │
 BMP180 / DHT11 ────▶│ métricas / estados/eventos │
                     └───────────┬─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
              LittleFS / LAN              Supabase
                    │                         │
                    ▼                         ▼
            Dashboard local                Vercel
                                              │
                                              ▼
                                      Dashboard remoto
```

O ESP32 permanece responsável pela lógica ambiental imediata. A Cloud complementa a arquitetura com persistência e acesso remoto. O GitHub também participa da arquitetura operacional como origem dos artefatos utilizados pela OTA HTTPS.

Documentação detalhada: [`docs/02-arquitetura.md`](docs/02-arquitetura.md).

---

## 4. Hardware

### 4.1 Microcontrolador

- ESP32 Dev Module;
- ESP32-D0WD-V3;
- arquitetura dual core;
- Wi-Fi;
- Bluetooth;
- Flash física de 4 MB.

### 4.2 Sensores

- **BMP180** — temperatura e pressão atmosférica;
- **DHT11** — umidade relativa e temperatura auxiliar.

Na arquitetura Cloud atual, a temperatura canônica utilizada na telemetria é proveniente do **BMP180**.

A arquitetura admite expansão futura para sensores de chuva, vento, rajadas, descargas atmosféricas, qualidade do ar e outros fenômenos de interesse.

Documentação detalhada: [`docs/03-hardware.md`](docs/03-hardware.md).

---

## 5. Processamento de borda

Entre as funções executadas localmente estão:

- média móvel de 15 minutos;
- histórico móvel de aproximadamente 60 minutos;
- mínimos e máximos diários;
- correção da pressão para o nível do mar;
- tendência barométrica;
- ponto de orvalho;
- classificação da umidade;
- conforto ambiental;
- avaliação de instabilidade;
- detecção de anomalias;
- geração de alertas;
- classificação do estado ambiental;
- registro de eventos.

Para uma média de \(N\) amostras:

$$
\bar{x}=\frac{1}{N}\sum_{i=1}^{N}x_i
$$

Uma forma utilizada para estimar a pressão equivalente ao nível do mar é:

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

A tendência da pressão pode ser estimada pelo coeficiente angular da regressão linear:

$$
m=\frac{N\sum_{i=1}^{N}t_iP_i-\left(\sum_{i=1}^{N}t_i\right)\left(\sum_{i=1}^{N}P_i\right)}
{N\sum_{i=1}^{N}t_i^2-\left(\sum_{i=1}^{N}t_i\right)^2}
$$

Assim, a estação não transmite apenas dados brutos: ela produz **informação derivada e estados ambientais no próprio Edge**.

Documentação detalhada: [`docs/11-processamento-edge.md`](docs/11-processamento-edge.md).

---

## 6. Dashboard local

O ESP32 disponibiliza uma interface Web acessível pela rede local.

```text
http://estacao-ambiental.local
```

O dashboard apresenta, entre outros recursos:

- temperatura;
- umidade relativa;
- pressão local e corrigida;
- média móvel;
- mínimos e máximos;
- ponto de orvalho;
- tendência da pressão;
- conforto ambiental;
- instabilidade;
- anomalias;
- alertas;
- eventos recentes;
- informações meteorológicas externas;
- estado de conectividade;
- configurações da estação.

Os arquivos da interface são armazenados no **LittleFS**, mantendo o frontend embarcado separado da imagem principal da aplicação.

A atualização remota independente do LittleFS é uma evolução prevista.

Documentação detalhada: [`docs/05-dashboard-local.md`](docs/05-dashboard-local.md).

---

## 7. Conectividade

A estação possui recursos de conectividade voltados à autonomia operacional:

- Wi-Fi;
- múltiplas redes conhecidas;
- seleção automática de rede;
- fallback para Access Point;
- portal de configuração;
- persistência em NVS;
- hostname configurável;
- mDNS;
- comunicação HTTP local;
- comunicação HTTPS com serviços externos;
- ArduinoOTA na rede local;
- OTA HTTPS pela Internet.

O hostname permite acesso local sem necessidade de conhecer o endereço IP.

Exemplo:

```text
http://estacao-ambiental.local
```

Documentação detalhada: [`docs/06-conectividade.md`](docs/06-conectividade.md).

---

## 8. Fonte meteorológica externa

Dados meteorológicos externos são obtidos por meio da **Open-Meteo**.

Esses dados complementam as medições locais e permitem comparar a estação com uma referência meteorológica externa.

Para uma grandeza \(x\) presente nas duas fontes:

$$
\Delta x=x_{\mathrm{local}}-x_{\mathrm{externo}}
$$

Por exemplo:

$$
\Delta T=T_{\mathrm{local}}-T_{\mathrm{externa}}
$$

Diferenças não representam necessariamente erro, pois as fontes podem possuir localização, altitude, exposição e instante de medição distintos.

A arquitetura distingue explicitamente:

```text
localização física da estação
≠
referência meteorológica externa
≠
campanha de medição
```

A alteração da cidade utilizada como referência no Open-Meteo não deve alterar automaticamente a localização física nem a altitude da estação.

---

## 9. Integração Cloud

### 9.1 Supabase

A estação envia telemetria para o **Supabase**, utilizando API REST e persistência em PostgreSQL.

```text
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

- armazenamento de histórico;
- consulta remota;
- análise temporal;
- estudos de sazonalidade;
- alimentação do dashboard remoto;
- futura integração com outros serviços.

Com aproximadamente um registro por minuto:

$$
N_{\mathrm{dia}}=24\times60=1440
$$

e, em 365 dias:

$$
N_{\mathrm{ano}}=1440\times365=525600
$$

registros por estação, em operação contínua.

A indisponibilidade temporária da Cloud não deve interromper o processamento local.

Uma evolução prevista é implementar **buffer local e reenvio posterior**, evitando perda de telemetria durante falhas temporárias de conectividade.

Documentação detalhada: [`docs/07-cloud.md`](docs/07-cloud.md).

### 9.2 Dashboard remoto

A plataforma possui também um dashboard Web remoto hospedado no **Vercel**.

```text
ESP32
   ↓
Supabase
   ↓
Vercel
   ↓
Navegador pela Internet
```

O dashboard remoto permite acompanhar as informações da estação sem estar conectado à mesma rede local do ESP32.

A existência dos dois dashboards é intencional:

```text
Dashboard local
→ operação e visualização diretamente no Edge

Dashboard remoto
→ visualização pela Internet
```

As duas interfaces podem evoluir de forma independente.

---

## 10. Atualização OTA

A manutenção do firmware passou a fazer parte da arquitetura operacional da estação.

Existem dois mecanismos complementares.

### 10.1 OTA local

O **ArduinoOTA** permite atualizar o firmware pela rede local sem conexão USB direta.

```text
Arduino IDE
    ↓
rede local
    ↓
ESP32
```

Esse mecanismo continua disponível para desenvolvimento e manutenção quando o equipamento está acessível na LAN.

### 10.2 OTA remota HTTPS

A plataforma também possui OTA pela Internet.

```text
Arduino IDE
     ↓
novo firmware
     ↓
estacao-ambiental.bin
     ↓
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
partição OTA inativa
     ↓
reboot
     ↓
nova versão
```

O ESP32 consulta um manifesto remoto `version.json`, que informa a versão disponível, a URL do binário e seu SHA-256.

A primeira atualização OTA HTTPS completa foi validada no ciclo que levou a estação da **v3.6.6 para a v3.6.7**, incluindo download do binário, validação SHA-256, gravação da partição OTA, reinicialização e confirmação de boot persistente da nova versão.

Durante a fase experimental, está prevista consulta ao manifesto aproximadamente a cada **5 minutos**, com instalação automática de versões superiores válidas. Essa política é temporária e visa permitir evolução remota das métricas quando não houver acesso físico à estação.

Também estão previstos:

- downgrade remoto explicitamente autorizado;
- rollback automático;
- registro Cloud dos eventos OTA;
- validação TLS completa;
- atualização OTA do LittleFS;
- automação de build e Release por CI/CD.

Documentação detalhada: [`docs/ota-remota.md`](docs/ota-remota.md).

---

## 11. Particionamento da Flash

O projeto utiliza uma tabela de partições personalizada para a Flash física de 4 MB.

```text
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

A mudança foi realizada porque o firmware havia atingido aproximadamente 95% da partição APP do layout anterior.

A estrutura APP0/APP1, inicialmente preparada para OTA, passou a ser efetivamente utilizada pela atualização remota.

Conceitualmente:

```text
APP ativa
   │
   │ nova versão
   ▼
APP inativa
   │
   │ validação
   ▼
novo boot
```

O arquivo de particionamento utilizado está em:

```text
firmware/estacao_ambiental/partitions.csv
```

Documentação detalhada: [`docs/08-particionamento-flash.md`](docs/08-particionamento-flash.md).

---

## 12. Estrutura do repositório

Estrutura conceitual do projeto:

```text
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
│   ├── 12-roadmap.md
│   └── ota-remota.md
│
├── assets/
├── research/
└── releases/
    └── version.json
```

Essa organização separa firmware, frontend embarcado, infraestrutura Cloud, documentação, material de pesquisa e distribuição de versões.

---

## 13. Documentação

A documentação técnica detalhada está organizada em `docs/`.

| Documento | Conteúdo |
|---|---|
| [`01-visao-geral.md`](docs/01-visao-geral.md) | visão geral e objetivos |
| [`02-arquitetura.md`](docs/02-arquitetura.md) | arquitetura consolidada da plataforma |
| [`03-hardware.md`](docs/03-hardware.md) | ESP32, sensores e conexões |
| [`04-firmware.md`](docs/04-firmware.md) | organização e lógica do firmware |
| [`05-dashboard-local.md`](docs/05-dashboard-local.md) | interface Web embarcada |
| [`06-conectividade.md`](docs/06-conectividade.md) | Wi-Fi, NVS, AP e mDNS |
| [`07-cloud.md`](docs/07-cloud.md) | Supabase, PostgreSQL e telemetria |
| [`08-particionamento-flash.md`](docs/08-particionamento-flash.md) | Flash, APP0/APP1, OTA e LittleFS |
| [`09-instalacao.md`](docs/09-instalacao.md) | instalação e configuração |
| [`10-operacao.md`](docs/10-operacao.md) | operação e diagnóstico |
| [`11-processamento-edge.md`](docs/11-processamento-edge.md) | processamento matemático e Edge Computing |
| [`12-roadmap.md`](docs/12-roadmap.md) | evolução planejada |
| [`ota-remota.md`](docs/ota-remota.md) | arquitetura, segurança e ciclo de atualização OTA remota |

---

## 14. Tecnologias utilizadas

- ESP32;
- Arduino Framework;
- C/C++;
- HTML;
- CSS;
- JavaScript;
- LittleFS;
- NVS;
- Wi-Fi;
- mDNS;
- HTTP/HTTPS;
- REST;
- JSON;
- Supabase;
- PostgreSQL;
- Vercel;
- Open-Meteo;
- GitHub;
- GitHub Releases;
- ArduinoOTA;
- OTA HTTPS;
- SHA-256.

Como evolução prevista, o projeto considera **GitHub Actions / CI/CD** para automatizar compilação e publicação de novas versões.

---

## 15. Instalação e publicação

O projeto utiliza o **Arduino IDE** com suporte à plataforma ESP32.

### Instalação inicial

O processo básico envolve:

1. selecionar `ESP32 Dev Module`;
2. manter a Flash física configurada como `4 MB`;
3. selecionar o esquema de partição personalizado;
4. manter `partitions.csv` junto ao projeto;
5. compilar e enviar `EstacaoAmbiental.ino`;
6. realizar separadamente o upload do LittleFS;
7. reiniciar o ESP32;
8. provisionar/configurar a rede Wi-Fi;
9. acessar o dashboard pela rede local;
10. validar sensores e serviços externos.

Instruções detalhadas: [`docs/09-instalacao.md`](docs/09-instalacao.md).

### Publicação manual de nova versão OTA

Enquanto a automação CI/CD não estiver implantada, o fluxo de uma nova versão é:

```text
Arduino IDE
    ↓
alterar e testar firmware
    ↓
atualizar versão
    ↓
compilar / exportar .bin
    ↓
GitHub Release
    ↓
SHA-256
    ↓
version.json
    ↓
ESP32
```

O artefato utilizado pela OTA é a imagem normal da aplicação, publicada na Release como:

```text
estacao-ambiental.bin
```

---

## 16. Operação

Depois de instalada, a estação foi projetada para operar de forma autônoma.

Uma sequência básica de diagnóstico é:

```text
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
        │
        ▼
dashboard remoto
```

Além da observação local, a integração Cloud permite verificar remotamente os resultados produzidos pela estação.

A OTA HTTPS acrescenta também a possibilidade de **manutenção e evolução remota do firmware**, reduzindo a dependência de acesso físico ao equipamento.

Manual de operação: [`docs/10-operacao.md`](docs/10-operacao.md).

---

## 17. Segurança

Credenciais sensíveis **não devem ser armazenadas no repositório público**.

Isso inclui:

- senhas Wi-Fi;
- chaves privadas;
- credenciais administrativas;
- `service_role`;
- senhas de banco;
- segredos de APIs.

O ESP32 deve utilizar apenas as permissões necessárias à telemetria, seguindo o princípio do **menor privilégio**.

O acesso Web local utiliza HTTP e pode aparecer no navegador como **Não seguro**. Isso é diferente das conexões externas HTTPS.

### Segurança da OTA

A OTA remota atualmente utiliza:

- HTTPS;
- verificação de tamanho;
- SHA-256 do binário;
- partições APP0/APP1.

Durante a fase experimental, algumas conexões HTTPS utilizam:

```cpp
client.setInsecure();
```

Isso significa que existe criptografia do transporte, porém sem validação adequada da identidade do servidor por certificado.

Portanto:

```text
SHA-256
→ verifica integridade do artefato

TLS validado
→ autentica o servidor e protege o canal
```

A arquitetura-alvo deverá substituir `setInsecure()` por validação TLS adequada e considerar mecanismos adicionais como rollback e assinatura criptográfica do firmware.

---

## 18. Estado atual

A plataforma documentada a partir do firmware **v3.6.7** consolida:

- aquisição BMP180 e DHT11;
- processamento ambiental local;
- média móvel de 15 minutos;
- histórico temporal;
- mínimos e máximos;
- classificação e estados ambientais;
- dashboard Web local;
- LittleFS;
- múltiplas redes Wi-Fi;
- portal de configuração;
- NVS;
- mDNS;
- Open-Meteo;
- telemetria Supabase;
- PostgreSQL;
- dashboard remoto no Vercel;
- eventos locais;
- particionamento personalizado;
- APP0/APP1;
- ArduinoOTA local;
- consulta de manifesto OTA remoto;
- GitHub Releases como distribuição do firmware;
- download HTTPS de firmware;
- validação SHA-256;
- instalação em partição OTA;
- reinicialização na nova versão;
- atualização OTA HTTPS real validada até a v3.6.7.

A plataforma já ultrapassou a fase em que Cloud, dashboard remoto e OTA eram apenas elementos de roadmap. Esses componentes fazem parte da arquitetura operacional atual.

---

## 19. Roadmap

### Próximas evoluções

- consulta OTA aproximadamente a cada 5 minutos;
- instalação automática temporária de versões superiores;
- downgrade remoto explicitamente autorizado;
- rollback automático;
- confirmação de saúde após primeiro boot;
- eventos OTA enviados para a Cloud;
- validação TLS adequada;
- autenticação/proteção do ArduinoOTA local;
- OTA independente do LittleFS;
- tolerância a falhas Edge--Cloud;
- fila local e reenvio de telemetria;
- prevenção de duplicidades;
- histórico ambiental de longo prazo;
- análise de sazonalidade;
- modularização progressiva do firmware;
- observabilidade do nó Edge;
- múltiplas estações;
- GitHub Actions / CI/CD;
- controle de implantação pelo dashboard;
- integração com assistentes e LLMs;
- TinyML;
- detecção inteligente de anomalias;
- estudos de eficiência energética;
- expansão para monitoramento de energia, água e outros domínios.

Roadmap completo: [`docs/12-roadmap.md`](docs/12-roadmap.md).

---

## 20. Contexto acadêmico

O projeto funciona como plataforma experimental para estudo de **Computação de Borda**.

Ele permite investigar conceitos como:

- processamento próximo à fonte dos dados;
- autonomia do nó Edge;
- redução de dependência da Cloud;
- latência;
- disponibilidade;
- tolerância a falhas;
- integração Edge--Cloud;
- processamento de séries temporais;
- extração de características;
- classificação local;
- atualização e gerenciamento remoto de nós Edge;
- TinyML;
- eficiência computacional;
- eficiência energética;
- sistemas distribuídos.

A evolução conceitual do projeto pode ser resumida por:

```text
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
  ├──────────────► Cloud / histórico
  │
  └──────────────► Dashboard local
```

Em sentido complementar, o dispositivo também passou a receber manutenção remotamente:

```text
Desenvolvimento
     │
     ▼
GitHub Release
     │
     ▼
OTA HTTPS
     │
     ▼
Nó Edge atualizado
```

Essa característica transforma a estação em mais do que um dispositivo IoT de telemetria: ela constitui uma **plataforma experimental de processamento distribuído e gerenciamento do ciclo de vida de um nó Edge**.

---

## 21. Licença

A licença do projeto será definida antes da publicação da primeira versão estável.
