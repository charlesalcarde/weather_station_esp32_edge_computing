# OTA Remota — Estação Ambiental ESP32

## Índice

1. [Objetivo](#1-objetivo)
2. [Contexto do projeto](#2-contexto-do-projeto)
3. [Arquitetura de atualização](#3-arquitetura-de-atualização)
4. [OTA local e OTA remota](#4-ota-local-e-ota-remota)
5. [Componentes da OTA HTTPS](#5-componentes-da-ota-https)
6. [Fluxo atual de publicação](#6-fluxo-atual-de-publicação)
7. [Manifesto `version.json`](#7-manifesto-versionjson)
8. [Detecção de nova versão](#8-detecção-de-nova-versão)
9. [Política temporária de atualização automática](#9-política-temporária-de-atualização-automática)
10. [Download e validação SHA-256](#10-download-e-validação-sha-256)
11. [Partições OTA e instalação](#11-partições-ota-e-instalação)
12. [Downgrade remoto autorizado](#12-downgrade-remoto-autorizado)
13. [Rollback automático](#13-rollback-automático)
14. [Operação remota e observabilidade](#14-operação-remota-e-observabilidade)
15. [Segurança](#15-segurança)
16. [Atualização da interface web local](#16-atualização-da-interface-web-local)
17. [Dashboard web na Internet](#17-dashboard-web-na-internet)
18. [Automação futura com CI/CD](#18-automação-futura-com-cicd)
19. [Versionamento dos componentes](#19-versionamento-dos-componentes)
20. [Estado atual e roadmap](#20-estado-atual-e-roadmap)
21. [Decisões arquiteturais](#21-decisões-arquiteturais)
22. [Conclusão](#22-conclusão)

---

## 1. Objetivo

Este documento registra a arquitetura, as decisões de projeto, o funcionamento atual e a evolução prevista do mecanismo de atualização remota **OTA (Over-the-Air)** da Estação Ambiental baseada em ESP32.

O objetivo principal da OTA remota é permitir a evolução do firmware mesmo quando não houver acesso físico à estação. Isso é particularmente importante durante a fase experimental do projeto, em que novas métricas, algoritmos, estados ambientais e mecanismos de processamento Edge serão introduzidos e avaliados continuamente.

A OTA transforma o dispositivo de um equipamento que depende de conexão USB para manutenção em um nó Edge que pode receber novas versões pela Internet.

## 2. Contexto do projeto

A Estação Ambiental possui uma arquitetura distribuída formada por três grandes camadas:

```text
┌──────────────────────────────┐
│            EDGE              │
│            ESP32             │
│ Sensores / processamento     │
│ métricas / eventos / UI      │
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌──────────────────────────────┐
│            CLOUD             │
│          Supabase            │
│ Telemetria / histórico       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│       DASHBOARD WEB          │
│           Vercel             │
│ Visualização remota          │
└──────────────────────────────┘
```

O mecanismo OTA adiciona uma quarta função à conectividade do ESP32: **manutenção remota do software embarcado**.

## 3. Arquitetura de atualização

```text
Desenvolvedor
     │
     ▼
Arduino IDE
     │ novo firmware
     ▼
Arquivo .ino
     │ compilação
     ▼
estacao-ambiental.bin
     │
     ▼
GitHub Release ─────► SHA-256
     │
     ▼
version.json
     │
     ▼
ESP32 consulta manifesto
     │
     ▼
Nova versão?
   ┌─┴─┐
  NÃO SIM
   │    │
   │    ▼
   │ Download HTTPS
   │    │
   │    ▼
   │ Verificação SHA-256
   │    │
   │    ▼
   │ Partição OTA inativa
   │    │
   │    ▼
   │ Reinicialização
   │    │
   └────► Nova versão
```

O ESP32 não precisa consultar a lista de Releases do GitHub. O ponto de controle é o arquivo `version.json`, que informa qual versão deve ser considerada e onde está o respectivo binário.

## 4. OTA local e OTA remota

### 4.1 ArduinoOTA — rede local

Permite enviar uma nova aplicação quando computador e estação estão acessíveis pela mesma rede. É especialmente útil durante desenvolvimento e testes próximos ao dispositivo.

### 4.2 OTA HTTPS — Internet

Permite atualizar o equipamento sem estar fisicamente próximo dele. O firmware é obtido pela Internet a partir do GitHub Release. Os dois mecanismos são complementares.

## 5. Componentes da OTA HTTPS

A solução utiliza ESP32 com tabela de partições compatível com OTA, Wi-Fi, cliente HTTPS, GitHub Releases, `version.json`, SHA-256, biblioteca `Update` e partições de aplicação A/B.

O artefato utilizado é o binário normal da aplicação:

```text
estacao-ambiental.bin
```

Arquivos como `bootloader.bin`, `partitions.bin`, `merged.bin` e `.elf` não são o artefato utilizado nesse fluxo de atualização da aplicação.

## 6. Fluxo atual de publicação

Enquanto a automação CI/CD não estiver implantada:

```text
1. Abrir a versão mais recente no Arduino IDE
2. Implementar a nova funcionalidade
3. Atualizar FIRMWARE_VERSION
4. Compilar e testar
5. Exportar o binário compilado
6. Criar uma nova GitHub Release
7. Publicar estacao-ambiental.bin
8. Calcular/obter SHA-256
9. Atualizar releases/version.json
10. ESP32 detecta, baixa e instala remotamente
```

A versão é centralizada no código, por exemplo:

```cpp
#define FIRMWARE_VERSION "3.6.8"
```

## 7. Manifesto `version.json`

O manifesto funciona como o ponto de descoberta e controle da versão remota.

```json
{
  "version": "3.6.7",
  "firmware": "estacao-ambiental.bin",
  "url": "https://github.com/USUARIO/REPOSITORIO/releases/download/v3.6.7/estacao-ambiental.bin",
  "sha256": "sha256:HASH_SHA256",
  "install": false
}
```

O campo `install` foi utilizado na validação inicial para separar **publicar uma versão** de **autorizar sua instalação**. Na política experimental da Seção 9, a intenção é temporariamente automatizar a instalação de versões superiores.

## 8. Detecção de nova versão

A comparação deve considerar `major.minor.patch` numericamente:

```text
3.6.8 > 3.6.7  → atualização
3.7.0 > 3.6.9  → atualização
4.0.0 > 3.9.9  → atualização
3.6.7 = 3.6.7  → nenhuma ação
```

Uma simples comparação alfabética de strings não deve decidir a ordem das versões.

## 9. Política temporária de atualização automática

### 9.1 Motivação

Durante a fase atual existe necessidade de evoluir rapidamente métricas, cálculos ambientais, estados, eventos, tratamento dos sensores, processamento Edge e integração Edge → Cloud, nem sempre com acesso físico à estação.

> **Decisão temporária:** a estação deverá consultar o manifesto remoto aproximadamente a cada 5 minutos e, ao encontrar uma versão superior válida, baixar e instalar automaticamente o novo firmware.

### 9.2 Comportamento

```text
A cada 5 minutos
       │
       ▼
Consulta version.json
       │
       ▼
versão remota > versão instalada?
       │
   ┌───┴───┐
  NÃO     SIM
   │        │
continua    ▼
operação   download
            │
            ▼
          SHA-256
            │
            ▼
          instalação
            │
            ▼
           reboot
```

O intervalo de cinco minutos representa um compromisso entre rapidez operacional e ausência de consultas excessivamente frequentes.

### 9.3 Natureza temporária

Posteriormente o projeto deverá migrar para publicação automatizada, autorização explícita de implantação, integração com dashboard/cloud, rollback e observabilidade mais completos.

## 10. Download e validação SHA-256

Seja $B$ a sequência de bytes do firmware baixado. Calcula-se:

$$
H = \operatorname{SHA256}(B)
$$

O ESP32 compara:

$$
H_{\text{calculado}} = H_{\text{manifesto}}
$$

Somente quando a igualdade é verdadeira a imagem pode ser considerada íntegra para prosseguir com a finalização da OTA.

O firmware é transferido em streaming e o hash pode ser calculado durante a recepção dos dados.

## 11. Partições OTA e instalação

A Flash foi particionada para permitir duas imagens de aplicação:

```text
Flash ESP32
├── Bootloader
├── Partition Table
├── OTA Data
├── APP0
├── APP1
└── LittleFS
```

Se a aplicação atual estiver em APP0, a atualização pode ser escrita em APP1. Após validação e finalização, a partição de boot é alterada e o ESP32 reinicia. Isso evita sobrescrever diretamente a aplicação em execução.

## 12. Downgrade remoto autorizado

A regra normal deve impedir downgrade acidental. Porém, durante desenvolvimento pode ser necessário retornar deliberadamente a uma versão anterior.

Está previsto um mecanismo explícito, por exemplo:

```json
{
  "version": "3.6.9",
  "force": true
}
```

Lógica prevista:

```text
remota > local → atualização normal
remota = local → nenhuma ação
remota < local → instalar somente se force = true
```

Após o uso, `force` deve retornar a `false`. Esse mecanismo deverá ser implementado e validado antes de ser considerado operacional.

## 13. Rollback automático

O downgrade remoto não resolve o caso em que uma nova versão quebra a conectividade. A evolução prevista é rollback automático:

```text
Firmware estável APP0
        │
        ▼
instala nova versão APP1
        │
        ▼
primeiro boot
        │
        ▼
testes de saúde
        │
    ┌───┴───┐
   OK     FALHA
    │        │
 confirma   rollback
 nova       anterior
 versão
```

Critérios futuros podem incluir inicialização normal, LittleFS, sensores, Wi-Fi, ciclo principal, comunicação Cloud e ausência de reinicializações repetitivas.

## 14. Operação remota e observabilidade

Sem acesso físico, o Serial Monitor deixa de ser fonte de diagnóstico. O projeto deverá registrar eventos OTA também na Cloud, por exemplo:

```text
OTA | v3.6.8 detectada
OTA | Download iniciado
OTA | SHA-256 OK
OTA | Imagem instalada
OTA | Reinicialização
OTA | Boot v3.6.8 confirmado
```

Isso permitirá verificar remotamente versão instalada, horário, download, integridade, reinicialização e confirmação da nova versão.

## 15. Segurança

### 15.1 Estado experimental atual

Durante o desenvolvimento inicial, conexões HTTPS utilizam `WiFiClientSecure` com `setInsecure()`. Existe criptografia de transporte, mas o ESP32 não valida adequadamente a identidade do servidor por certificado. Essa configuração deve ser tratada como experimental.

### 15.2 SHA-256 não substitui autenticação TLS

```text
SHA-256       → integridade do artefato
TLS validado  → autenticidade do servidor + proteção do canal
```

Os mecanismos são complementares. Se manifesto e firmware forem obtidos sem validação da identidade do servidor, o hash isoladamente não fornece toda a proteção desejada.

### 15.3 Evolução prevista

```text
HTTPS
+
validação de certificado/CA
+
SHA-256
+
rollback
+
eventual assinatura criptográfica do firmware
```

Também deverá ser considerada autenticação adequada do ArduinoOTA local.

## 16. Atualização da interface web local

A interface web local está armazenada no ESP32 utilizando LittleFS. Portanto, firmware e interface local são artefatos conceitualmente distintos:

```text
Firmware        → estacao-ambiental.bin
Interface local → imagem/arquivos LittleFS
```

No futuro será possível implementar OTA também do sistema de arquivos, permitindo alterar HTML/CSS/JS sem necessariamente atualizar a aplicação.

## 17. Dashboard web na Internet

O dashboard hospedado na Internet possui ciclo independente:

```text
Código web
   │
   ▼
GitHub
   │
   ▼
Vercel
   │ build/deploy
   ▼
Dashboard atualizado
```

Portanto:

```text
Firmware Edge       → OTA ESP32
Interface web local → LittleFS / OTA de filesystem
Dashboard Internet  → GitHub + Vercel
```

## 18. Automação futura com CI/CD

Atualmente existem etapas manuais:

```text
editar → compilar → exportar .bin → calcular SHA → criar Release → atualizar manifesto
```

A evolução prevista utiliza GitHub Actions:

```text
Alteração no código
       │
       ▼
commit / push
       │
       ▼
tag vX.Y.Z
       │
       ▼
GitHub Actions
       ├── configura toolchain
       ├── instala dependências
       ├── compila firmware
       ├── gera .bin
       ├── calcula SHA-256
       ├── cria Release
       └── gera/atualiza manifesto
```

Em etapa posterior, a autorização de implantação poderá ser controlada pelo dashboard/Supabase.

## 19. Versionamento dos componentes

À medida que a plataforma cresce, recomenda-se versionar separadamente firmware ESP32, UI local e dashboard Cloud.

Exemplo conceitual:

```json
{
  "device": "3.7.0",
  "littlefs": "2.1.0",
  "web": "1.4.0"
}
```

## 20. Estado atual e roadmap

### Implementado e validado

- [x] ArduinoOTA local
- [x] tabela de partições com APP0/APP1
- [x] consulta HTTPS ao manifesto
- [x] `version.json`
- [x] comparação de versões
- [x] GitHub Release como origem do firmware
- [x] download do `.bin`
- [x] tratamento de redirecionamento HTTP
- [x] cálculo SHA-256 em streaming
- [x] comparação com hash do manifesto
- [x] gravação na partição OTA
- [x] mudança da partição de boot
- [x] reinicialização
- [x] primeira atualização OTA HTTPS real concluída
- [x] confirmação de boot persistente da nova versão

### Próximas etapas

- [ ] alterar consulta OTA para aproximadamente 5 minutos
- [ ] habilitar temporariamente instalação automática de versão superior
- [ ] implementar downgrade remoto autorizado (`force`)
- [ ] registrar eventos OTA na Cloud
- [ ] implementar validação de primeiro boot
- [ ] implementar rollback automático
- [ ] substituir `setInsecure()` por validação TLS adequada
- [ ] proteger/autenticar melhor OTA local
- [ ] implementar OTA do LittleFS
- [ ] automatizar build e Release com GitHub Actions
- [ ] integrar autorização OTA ao dashboard/Supabase
- [ ] avaliar assinatura criptográfica de firmware

## 21. Decisões arquiteturais

### DA-01 — Manter OTA local e remota

**Decisão:** manter ArduinoOTA e OTA HTTPS como mecanismos complementares.

**Motivo:** ArduinoOTA é conveniente durante desenvolvimento local; OTA HTTPS permite manutenção quando o dispositivo está remoto.

### DA-02 — GitHub Release como distribuição

**Decisão:** armazenar o binário em GitHub Releases.

**Motivo:** separar código-fonte dos artefatos de versão e fornecer URLs versionadas.

### DA-03 — Manifesto como ponto de controle

**Decisão:** o ESP32 consulta `version.json` em vez de pesquisar diretamente as Releases.

**Motivo:** simplificar a lógica embarcada e controlar versão, URL, hash e políticas futuras em um documento pequeno.

### DA-04 — SHA-256 obrigatório

**Decisão:** validar o binário antes de concluir a atualização.

**Motivo:** evitar ativação de imagem corrompida ou diferente daquela declarada pelo manifesto.

### DA-05 — Consulta a cada cinco minutos

**Decisão temporária:** consultar periodicamente o manifesto em intervalo aproximado de cinco minutos.

**Motivo:** permitir desenvolvimento e validação remotos sem depender de acesso físico ao dispositivo.

### DA-06 — Auto-update temporário

**Decisão temporária:** instalar automaticamente uma versão superior válida.

**Motivo:** acelerar a frente de desenvolvimento das métricas enquanto a estação estiver fisicamente distante.

**Evolução:** substituir posteriormente por mecanismo controlado de implantação.

### DA-07 — Downgrade somente explícito

**Decisão:** versões inferiores não deverão ser instaladas normalmente.

**Exceção prevista:** `force=true`, ou mecanismo equivalente, para rollback manual deliberado.

### DA-08 — Separar firmware, UI local e dashboard Cloud

**Decisão:** tratar os três componentes como artefatos/versionamentos independentes.

**Motivo:** permitir evolução e implantação independentes das diferentes camadas da plataforma.

## 22. Conclusão

A OTA remota representa uma evolução importante da Estação Ambiental ESP32. O dispositivo deixa de depender de presença física para receber novas funcionalidades e passa a possuir um ciclo de manutenção compatível com uma plataforma Edge conectada.

O mecanismo já validado demonstrou:

```text
GitHub Release
      ↓
version.json
      ↓
ESP32
      ↓
HTTPS
      ↓
.bin
      ↓
SHA-256
      ↓
partição OTA
      ↓
reboot
      ↓
nova versão
```

A política de verificação frequente e instalação automática é deliberadamente **temporária** e atende à necessidade atual de acelerar os experimentos com métricas e processamento Edge.

A evolução natural é acrescentar rollback, observabilidade Cloud, TLS validado, atualização do LittleFS e uma pipeline CI/CD que automatize construção e publicação dos artefatos.

Dessa forma, a OTA deixa de ser apenas uma conveniência de programação e passa a constituir parte da **arquitetura operacional e do ciclo de vida do nó Edge**.
