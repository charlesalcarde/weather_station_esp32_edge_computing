# Cloud

Este diretório reúne os artefatos relacionados à camada **Cloud** da Estação Ambiental ESP32.

A implementação atual utiliza **Supabase** como backend para recepção e persistência da telemetria produzida pelo ESP32. O processamento ambiental principal continua sendo realizado no dispositivo Edge; a Cloud atua como extensão para armazenamento histórico, acesso remoto e futuras análises.

> Os detalhes técnicos da arquitetura Cloud permanecem em [`../docs/07-cloud.md`](../docs/07-cloud.md), evitando duplicação neste arquivo.

---

## Índice

- [1. Finalidade](#1-finalidade)
- [2. Arquitetura](#2-arquitetura)
- [3. Estrutura do diretório](#3-estrutura-do-diretório)
- [4. Supabase](#4-supabase)
- [5. Banco de dados](#5-banco-de-dados)
- [6. Scripts SQL](#6-scripts-sql)
- [7. Segurança e credenciais](#7-segurança-e-credenciais)
- [8. Compatibilidade e migrações](#8-compatibilidade-e-migrações)
- [9. Dados de desenvolvimento e PoC](#9-dados-de-desenvolvimento-e-poc)
- [10. Relação Edge–Cloud](#10-relação-edgecloud)
- [11. Evoluções previstas](#11-evoluções-previstas)
- [12. Documentação relacionada](#12-documentação-relacionada)

---

## 1. Finalidade

A pasta `cloud/` contém arquivos necessários para documentar, configurar e evoluir a infraestrutura Cloud do projeto.

Suas responsabilidades incluem:

- receber telemetria do ESP32;
- persistir dados ambientais;
- manter histórico de longo prazo;
- fornecer dados para futuras interfaces remotas;
- permitir análises temporais;
- futuramente armazenar eventos operacionais e ambientais.

---

## 2. Arquitetura

```text
Sensores
   │
   ▼
ESP32
   │
   │ processamento Edge
   ▼
Snapshot de telemetria
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

A Cloud recebe resultados já processados pelo ESP32. A diretriz permanece:

> **Edge primeiro; Cloud como extensão.**

---

## 3. Estrutura do diretório

A organização recomendada é:

```text
cloud/
├── README.md
└── supabase/
    ├── README.md
    ├── schema.sql
    ├── policies.sql
    └── maintenance/
        └── limpar-dados-poc.sql
```

O diretório poderá crescer quando novos serviços Cloud forem incorporados.

---

## 4. Supabase

O Supabase fornece atualmente:

```text
REST API
   +
PostgreSQL
   +
Row Level Security
```

O ESP32 envia requisições HTTPS para a API REST.

As principais entidades de dados são:

```text
public.leituras
public.eventos
```

`public.leituras` armazena snapshots periódicos. A estrutura de `public.eventos` é destinada a acontecimentos discretos e poderá ser utilizada quando o envio Cloud de eventos estiver incorporado ao firmware.

Na arquitetura atual, a temperatura canônica enviada para a Cloud é proveniente do **BMP180**.

---

## 5. Banco de dados

A telemetria pode incluir identificação, data/hora, temperatura, umidade, pressão, médias, extremos, tendência barométrica, ponto de orvalho, estados ambientais, alertas, RSSI, altitude e dados meteorológicos externos.

A definição precisa dos campos deve permanecer no schema e na documentação técnica, em vez de ser duplicada neste README.

O histórico Cloud possui escala temporal maior que a janela mantida localmente pelo ESP32 e será utilizado futuramente para consultas de dias, meses e períodos sazonais.

---

## 6. Scripts SQL

### `schema.sql`

Representa o schema compatível com a versão corrente do projeto e deve permitir reconstruir a estrutura necessária no Supabase.

### `policies.sql`

Concentra políticas RLS, grants e demais permissões necessárias.

Separar estrutura e segurança facilita revisão e manutenção.

### `maintenance/limpar-dados-poc.sql`

Script administrativo para remover dados experimentais quando necessário.

> Scripts destrutivos devem ser claramente identificados e nunca executados automaticamente.

---

## 7. Segurança e credenciais

Nenhuma credencial secreta deve ser armazenada neste diretório.

Não devem ser publicados:

- `service_role`;
- senhas de banco;
- tokens privados;
- chaves secretas;
- credenciais administrativas;
- arquivos contendo segredos reais.

O firmware deve utilizar somente credenciais apropriadas ao cliente e as permissões mínimas necessárias.

No Supabase, o acesso deve ser controlado por **Row Level Security (RLS)** e políticas explícitas.

```text
ESP32
  │
  └── permissões mínimas necessárias
```

Nunca:

```text
ESP32
  │
  └── credencial administrativa
```

---

## 8. Compatibilidade e migrações

Alterações no schema devem considerar a versão do firmware em operação.

A estratégia recomendada é:

```text
adicionar nova estrutura
        │
        ▼
manter compatibilidade
        │
        ▼
atualizar firmware
        │
        ▼
validar nova versão
        │
        ▼
remover legado
```

Durante uma migração, remover ou renomear imediatamente um campo ainda enviado pelo ESP32 pode interromper a telemetria.

---

## 9. Dados de desenvolvimento e PoC

Durante o desenvolvimento, o banco pode conter registros de:

- testes de conectividade;
- provas de conceito;
- versões intermediárias;
- validações de schema;
- reinicializações;
- testes de telemetria.

Esses registros não devem ser confundidos com uma série histórica definitiva.

Antes de iniciar uma coleta considerada oficial, os dados experimentais podem ser removidos com um script de manutenção previamente revisado.

---

## 10. Relação Edge–Cloud

A Cloud não é requisito para o funcionamento ambiental básico da estação.

Em uma falha externa:

```text
Sensores ................. operacional
Processamento Edge ....... operacional
Dashboard local .......... operacional
Histórico local recente .. operacional

Open-Meteo ............... indisponível
Supabase ................. indisponível
```

Essa separação é uma característica central da arquitetura.

---

## 11. Evoluções previstas

A camada Cloud deverá evoluir com:

- dashboard Web remoto;
- consultas históricas;
- análise sazonal;
- envio de eventos;
- autenticação;
- políticas de leitura;
- fila local de telemetria;
- reenvio após recuperação;
- prevenção de duplicidades;
- observabilidade;
- suporte a múltiplas estações;
- integração com outros serviços.

Esses itens pertencem ao roadmap e não representam necessariamente funcionalidades já implementadas.

Consulte [`../docs/12-roadmap.md`](../docs/12-roadmap.md).

---

## 12. Documentação relacionada

| Documento | Conteúdo |
|---|---|
| [`02-arquitetura.md`](../docs/02-arquitetura.md) | arquitetura geral Edge–Cloud |
| [`06-conectividade.md`](../docs/06-conectividade.md) | conectividade |
| [`07-cloud.md`](../docs/07-cloud.md) | arquitetura Cloud e telemetria |
| [`10-operacao.md`](../docs/10-operacao.md) | operação e diagnóstico |
| [`11-processamento-edge.md`](../docs/11-processamento-edge.md) | processamento antes do envio |
| [`12-roadmap.md`](../docs/12-roadmap.md) | evolução planejada |

O [`README.md` principal](../README.md) apresenta a visão geral do projeto.
