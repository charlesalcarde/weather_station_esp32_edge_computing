# Firmware

Este diretório contém os arquivos executáveis e os recursos embarcados
da **Estação Ambiental ESP32**.

Seu objetivo é reunir, em um único local, tudo o que é necessário para
**compilar e gravar a versão corrente do firmware**, sem duplicar a
documentação técnica detalhada mantida em [`../docs/`](../docs/).

------------------------------------------------------------------------

## Índice

-   [1. Finalidade](#1-finalidade)
-   [2. Conteúdo do diretório](#2-conteúdo-do-diretório)
-   [3. Relação entre os arquivos](#3-relação-entre-os-arquivos)
-   [4. Arquivos que devem permanecer
    juntos](#4-arquivos-que-devem-permanecer-juntos)
-   [5. Configuração e credenciais](#5-configuração-e-credenciais)
-   [6. Fluxo básico de atualização](#6-fluxo-básico-de-atualização)
-   [7. Controle de versões](#7-controle-de-versões)
-   [8. Documentação relacionada](#8-documentação-relacionada)

------------------------------------------------------------------------

## 1. Finalidade

A pasta `firmware/` representa a implementação embarcada da estação.

Ela reúne:

-   o código-fonte executado pelo ESP32;
-   a tabela de particionamento da Flash;
-   os arquivos do dashboard armazenados no LittleFS;
-   demais recursos necessários à compilação e gravação da versão
    corrente.

Detalhes sobre algoritmos, arquitetura, hardware, instalação e operação
**não são repetidos neste arquivo**. Eles estão organizados na
documentação principal do projeto.

------------------------------------------------------------------------

## 2. Conteúdo do diretório

A estrutura esperada é:

``` text
firmware/
└── estacao_ambiental/
    ├── EstacaoAmbiental.ino
    ├── partitions.csv
    └── data/
        ├── index.html
        ├── style.css
        ├── app.js
        └── favicon.png
```

Dependendo da evolução do projeto, novos arquivos `.h` e `.cpp` poderão
ser incorporados para modularizar o firmware.

### `EstacaoAmbiental.ino`

Sketch principal da estação.

É o ponto de entrada da aplicação embarcada e coordena os componentes do
sistema.

Para descrição detalhada da organização interna do firmware, consulte
[`../docs/04-firmware.md`](../docs/04-firmware.md).

### `partitions.csv`

Define o particionamento personalizado da Flash utilizado pelo projeto.

Esse arquivo faz parte da configuração da versão e deve acompanhar o
firmware.

Detalhes:
[`../docs/08-particionamento-flash.md`](../docs/08-particionamento-flash.md).

### `data/`

Contém os recursos estáticos gravados no LittleFS e servidos pelo ESP32
para formar o dashboard local.

``` text
data/
├── index.html
├── style.css
├── app.js
└── favicon.png
```

Detalhes da interface:
[`../docs/05-dashboard-local.md`](../docs/05-dashboard-local.md).

------------------------------------------------------------------------

## 3. Relação entre os arquivos

O firmware e a interface Web são gravados em regiões distintas da Flash.

``` text
EstacaoAmbiental.ino
        │
        ▼
   compilação
        │
        ▼
  partição APP


data/
  │
  ▼
imagem LittleFS
  │
  ▼
partição de filesystem
```

O arquivo `partitions.csv` determina como essas regiões são organizadas.

Por isso, uma versão funcional da estação deve ser entendida como o
conjunto:

``` text
firmware
   +
partitions.csv
   +
arquivos LittleFS
```

e não apenas como o arquivo `.ino`.

------------------------------------------------------------------------

## 4. Arquivos que devem permanecer juntos

Ao copiar, arquivar ou preparar uma versão do firmware, preserve a
estrutura completa da pasta.

Evite distribuir somente:

``` text
EstacaoAmbiental.ino
```

sem os demais arquivos correspondentes.

Uma alteração no firmware pode depender de uma nova versão do dashboard,
e uma alteração no particionamento pode exigir nova gravação do
LittleFS.

O procedimento completo de gravação está documentado em
[`../docs/09-instalacao.md`](../docs/09-instalacao.md).

------------------------------------------------------------------------

## 5. Configuração e credenciais

Credenciais reais não devem ser publicadas no repositório.

Isso inclui, entre outras:

-   senhas de redes Wi-Fi;
-   chaves administrativas;
-   tokens privados;
-   credenciais de banco de dados;
-   chaves `service_role`;
-   outros segredos de serviços externos.

Quando uma configuração precisar existir no código-fonte público,
utilize placeholders, arquivos locais ignorados pelo Git ou outro
mecanismo apropriado de configuração.

Exemplo conceitual:

``` cpp
const char* API_KEY = "INSIRA_SUA_CHAVE_AQUI";
```

Nunca faça commit de uma credencial secreta apenas para facilitar a
compilação.

------------------------------------------------------------------------

## 6. Fluxo básico de atualização

O fluxo recomendado durante o desenvolvimento é:

``` text
alterar código
     │
     ▼
compilar
     │
     ▼
validar tamanho
     │
     ▼
gravar firmware
     │
     ├── se data/ mudou ──► gravar LittleFS
     │
     ▼
reiniciar
     │
     ▼
validar operação
```

Se `partitions.csv` for alterado, o particionamento e o filesystem devem
receber atenção especial antes da homologação.

As instruções operacionais completas permanecem em
[`../docs/09-instalacao.md`](../docs/09-instalacao.md).

------------------------------------------------------------------------

## 7. Controle de versões

A pasta `firmware/` deve representar o código corrente em
desenvolvimento ou a versão indicada pelo estado atual do repositório.

Marcos homologados devem ser identificados por **tags/releases do Git**
e registrados no diretório [`../releases/`](../releases/), evitando
manter cópias desnecessárias do mesmo código-fonte em vários locais.

Antes de considerar uma nova versão homologada, devem ser validados os
componentes relevantes da estação, incluindo firmware, dashboard,
filesystem, conectividade e integrações utilizadas pela versão.

------------------------------------------------------------------------

## 8. Documentação relacionada

Para evitar duplicação, utilize os documentos especializados:

  ----------------------------------------------------------------------------------------------------------
  Documento                                                              Assunto
  ---------------------------------------------------------------------- -----------------------------------
  [`04-firmware.md`](../docs/04-firmware.md)                             arquitetura e organização do
                                                                         firmware

  [`05-dashboard-local.md`](../docs/05-dashboard-local.md)               frontend armazenado no LittleFS

  [`06-conectividade.md`](../docs/06-conectividade.md)                   Wi-Fi, configuração, NVS e mDNS

  [`07-cloud.md`](../docs/07-cloud.md)                                   integração de telemetria com a
                                                                         Cloud

  [`08-particionamento-flash.md`](../docs/08-particionamento-flash.md)   tabela de partições e organização
                                                                         da Flash

  [`09-instalacao.md`](../docs/09-instalacao.md)                         compilação, gravação e configuração

  [`10-operacao.md`](../docs/10-operacao.md)                             operação e diagnóstico

  [`11-processamento-edge.md`](../docs/11-processamento-edge.md)         cálculos e processamento executados
                                                                         no ESP32
  ----------------------------------------------------------------------------------------------------------

O [`README.md` principal](../README.md) apresenta a visão geral do
projeto.
