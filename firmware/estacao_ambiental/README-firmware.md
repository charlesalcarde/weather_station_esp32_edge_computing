# Firmware — Estação Ambiental ESP32

Este diretório contém o **firmware corrente**, a tabela de particionamento e os recursos embarcados da **Estação Ambiental ESP32**.

Seu objetivo é reunir os arquivos necessários para compilar, gravar e manter o nó Edge, sem duplicar a documentação técnica detalhada disponível em [`../docs/`](../docs/).

> **Estado da plataforma documentado a partir do firmware v3.6.7.**

## Índice

- [1. Finalidade](#1-finalidade)
- [2. Estrutura do diretório](#2-estrutura-do-diretório)
- [3. Relação entre os componentes](#3-relação-entre-os-componentes)
- [4. Atualização do firmware](#4-atualização-do-firmware)
- [5. Releases e SHA-256](#5-releases-e-sha-256)
- [6. Controle de versões](#6-controle-de-versões)
- [7. Configuração e credenciais](#7-configuração-e-credenciais)
- [8. Evolução prevista](#8-evolução-prevista)
- [9. Documentação relacionada](#9-documentação-relacionada)

---

## 1. Finalidade

A pasta `firmware/` representa a implementação embarcada corrente da estação e reúne:

- o código-fonte executado pelo ESP32;
- a tabela personalizada de particionamento da Flash;
- os arquivos do dashboard local armazenados no LittleFS;
- os recursos necessários à compilação e gravação.

O histórico das versões é preservado pelo Git, pelas tags e pelas GitHub Releases. Este README descreve a **estrutura corrente**, e não uma versão histórica específica.

## 2. Estrutura do diretório

```text
firmware/
├── EstacaoAmbiental_v3_6_7_OTA_HTTPS_TARGET.ino
├── partitions.csv
├── README.md
└── data/
    ├── index.html
    ├── style.css
    ├── app.js
    └── favicon.png
```

### Firmware principal

`EstacaoAmbiental_v3_6_7_OTA_HTTPS_TARGET.ino` corresponde ao firmware consolidado na fase documentada a partir da **v3.6.7**.

O sketch coordena aquisição dos sensores, processamento Edge, estados e eventos, Wi-Fi, NVS, mDNS, servidor Web local, LittleFS, Open-Meteo, telemetria Supabase, ArduinoOTA e OTA remota HTTPS.

### `partitions.csv`

Define a organização personalizada da Flash de 4 MB, incluindo NVS, OTA Data, APP0, APP1 e LittleFS.

As partições APP0/APP1 são efetivamente utilizadas pela arquitetura OTA.

### `data/`

Contém os recursos estáticos do dashboard Web local gravados no LittleFS.

## 3. Relação entre os componentes

Uma instalação funcional deve ser entendida como:

```text
firmware
   +
partitions.csv
   +
LittleFS
```

Os elementos ocupam regiões distintas da Flash:

```text
EstacaoAmbiental_*.ino
        ↓
     APP0/APP1

data/
  ↓
LittleFS

partitions.csv
  ↓
organização da Flash
```

Por isso, alterações no particionamento ou no frontend embarcado devem ser tratadas com o mesmo cuidado que alterações no código principal.

## 4. Atualização do firmware

A plataforma possui três caminhos principais.

### USB

Usado para instalação inicial, recuperação, alterações estruturais e testes locais.

```text
Arduino IDE → USB → ESP32
```

### ArduinoOTA local

Permite atualizar a aplicação pela rede local sem conexão USB.

```text
Arduino IDE → LAN/Wi-Fi → ESP32
```

### OTA remota HTTPS

O fluxo remoto validado é:

```text
novo firmware
      ↓
compilação
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
verificação SHA-256
      ↓
partição OTA inativa
      ↓
reboot
      ↓
nova versão
```

A atualização completa **v3.6.6 → v3.6.7** validou esse processo de ponta a ponta.

Detalhes: [`../docs/ota-remota.md`](../docs/ota-remota.md).

## 5. Releases e SHA-256

O antigo `SHA256SUMS.txt` da pasta `firmware/` não é necessário como inventário permanente dos hashes dos arquivos-fonte.

O Git fornece histórico e rastreabilidade dos arquivos versionados. Para a OTA, o SHA-256 operacionalmente relevante é o do **binário que será instalado**:

```text
estacao-ambiental.bin
```

Fluxo:

```text
código-fonte
    ↓
compilação
    ↓
estacao-ambiental.bin
    ↓
SHA-256
    ↓
GitHub Release + version.json
```

O manifesto remoto publica o hash esperado do binário, e o ESP32 calcula o SHA-256 do arquivo recebido antes de concluir a instalação.

Assim:

```text
Git
→ histórico do código-fonte

GitHub Release
→ artefato executável homologado

SHA-256
→ integridade do binário OTA

version.json
→ referência da versão disponível
```

## 6. Controle de versões

A pasta `firmware/` deve representar o código corrente do projeto. Marcos homologados devem ser preservados por commits, tags e GitHub Releases, evitando cópias antigas desnecessárias dentro do diretório.

Durante a fase atual, o nome do sketch ainda identifica explicitamente a versão. Em uma futura modularização, poderá ser adotada uma estrutura estável com arquivos como:

```text
main.cpp
sensors.cpp
metrics.cpp
wifi_manager.cpp
cloud.cpp
ota.cpp
webserver.cpp
events.cpp
```

Nesse estágio, a versão poderá ser controlada exclusivamente no código e no processo de Release.

## 7. Configuração e credenciais

Credenciais reais não devem ser publicadas no repositório, incluindo:

- senhas Wi-Fi;
- tokens privados;
- chaves administrativas;
- credenciais de banco;
- `service_role`;
- segredos de APIs.

Quando necessário, devem ser utilizados placeholders ou mecanismos de configuração local.

## 8. Evolução prevista

As próximas evoluções diretamente relacionadas ao firmware incluem:

- observabilidade da OTA;
- validação de saúde após atualização;
- rollback automático;
- downgrade remoto autorizado;
- verificação periódica do manifesto;
- atualização automática temporária durante a fase experimental;
- validação TLS adequada;
- autenticação do ArduinoOTA local;
- OTA independente do LittleFS;
- buffer local e reenvio Edge → Cloud;
- modularização progressiva;
- observabilidade do nó Edge;
- CI/CD com GitHub Actions;
- preparação para TinyML.

Roadmap completo: [`../docs/12-roadmap.md`](../docs/12-roadmap.md).

## 9. Documentação relacionada

| Documento | Assunto |
|---|---|
| [`01-visao-geral.md`](../docs/01-visao-geral.md) | visão conceitual |
| [`02-arquitetura.md`](../docs/02-arquitetura.md) | arquitetura consolidada |
| [`04-firmware.md`](../docs/04-firmware.md) | organização e lógica do firmware |
| [`05-dashboard-local.md`](../docs/05-dashboard-local.md) | frontend LittleFS |
| [`06-conectividade.md`](../docs/06-conectividade.md) | Wi-Fi, NVS, AP e mDNS |
| [`07-cloud.md`](../docs/07-cloud.md) | Supabase e telemetria |
| [`08-particionamento-flash.md`](../docs/08-particionamento-flash.md) | organização da Flash |
| [`09-instalacao.md`](../docs/09-instalacao.md) | compilação e gravação |
| [`10-operacao.md`](../docs/10-operacao.md) | operação e diagnóstico |
| [`11-processamento-edge.md`](../docs/11-processamento-edge.md) | processamento no Edge |
| [`12-roadmap.md`](../docs/12-roadmap.md) | evolução planejada |
| [`14-ota-remota.md`](../docs/14-ota-remota.md) | OTA HTTPS, SHA-256 e segurança |

O [`README.md` principal](../README.md) permanece como porta de entrada do projeto.
