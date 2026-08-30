# Supabase

Artefatos da integração **Supabase** da Estação Ambiental ESP32.

Este diretório registra as migrações efetivamente utilizadas no desenvolvimento da v3.4, as permissões conhecidas da camada de ingestão e scripts administrativos.

> A arquitetura conceitual e o detalhamento da telemetria permanecem em [`../../docs/07-cloud.md`](../../docs/07-cloud.md).

---

## Índice

- [1. Estado atual](#1-estado-atual)
- [2. Estrutura](#2-estrutura)
- [3. Migrações v3.4](#3-migrações-v34)
- [4. Schema atual](#4-schema-atual)
- [5. Políticas e permissões](#5-políticas-e-permissões)
- [6. Manutenção](#6-manutenção)
- [7. Ordem histórica da migração](#7-ordem-histórica-da-migração)
- [8. Segurança](#8-segurança)
- [9. Próximos passos](#9-próximos-passos)

---

## 1. Estado atual

A integração Cloud v3.4 foi validada com telemetria ativa após a remoção das colunas legadas:

```text
pressao
estado
```

O firmware v3.4 utiliza os campos definitivos:

```text
pressao_mar
estado_geral
```

Após a aplicação da migração de finalização, novas leituras continuaram chegando normalmente ao Supabase.

Assim, a migração de compatibilidade da v3.4 pode ser considerada concluída no ambiente atualmente homologado.

---

## 2. Estrutura

```text
supabase/
├── README.md
├── policies.sql
├── migrations/
│   ├── 01_schema_cloud_v3_4_migracao_segura.sql
│   └── 03_finalizar_migracao_v3_4_remover_legados.sql
└── maintenance/
    └── limpar_dados_poc.sql
```

A numeração das migrações preserva a sequência histórica do desenvolvimento.

O antigo script `02_limpar_dados_poc.sql` não é uma migração estrutural; por isso foi classificado em `maintenance/`.

---

## 3. Migrações v3.4

### `01_schema_cloud_v3_4_migracao_segura.sql`

Foi utilizado para ampliar a tabela `public.leituras` sem interromper a PoC existente.

Durante essa fase, os campos:

```text
pressao
estado
```

foram temporariamente preservados, enquanto:

```text
pressao_mar
estado_geral
```

e os demais campos da v3.4 foram adicionados.

O script também cria `public.eventos` e configura a ingestão correspondente.

### `03_finalizar_migracao_v3_4_remover_legados.sql`

Foi executado somente depois da validação do firmware v3.4.

Remove:

```text
public.leituras.pressao
public.leituras.estado
```

Esse script permanece no repositório como histórico de migração e para reprodução em instalações que ainda estejam no estágio intermediário.

---

## 4. Schema atual

O estado homologado da v3.4 **não possui mais** as colunas legadas `pressao` e `estado`.

Entre os campos definitivos estão:

```text
temperatura
umidade
pressao_mar
pressao_local
pressao_media15
pressao_media60
estado_geral
estado_umidade
estado_conforto
estado_pressao
```

além de extremos diários, tendência barométrica, alertas, informações operacionais e dados externos.

Este repositório preserva, neste momento, o **histórico real das migrações aplicadas**, em vez de substituir esse histórico por um script reconstruído de memória.

Um futuro `schema_v3_4.sql` de instalação limpa deverá ser gerado a partir do schema efetivamente exportado do Supabase, garantindo reprodução exata da base homologada.

---

## 5. Políticas e permissões

O arquivo [`policies.sql`](policies.sql) documenta as permissões conhecidas da camada de ingestão.

A diretriz é:

```text
ESP32
  │
  └── INSERT com privilégio mínimo
```

Não é criada neste estágio uma política pública de `SELECT`.

A leitura necessária ao futuro dashboard remoto será tratada separadamente, junto com a estratégia de autenticação e segurança.

---

## 6. Manutenção

O arquivo:

```text
maintenance/limpar_dados_poc.sql
```

remove os registros de `public.leituras` e `public.eventos` e reinicia os contadores identity.

Ele **não deve ser executado como parte da instalação ou das migrações**.

É um procedimento destrutivo de manutenção e deve ser usado apenas quando houver decisão explícita de descartar dados experimentais.

---

## 7. Ordem histórica da migração

O processo realizado na v3.4 foi:

```text
PoC existente
      │
      ▼
01_schema_cloud_v3_4_migracao_segura.sql
      │
      ├── preserva pressao e estado
      ├── adiciona campos v3.4
      └── cria eventos
      │
      ▼
Firmware v3.4 em compatibilidade
      │
      ▼
Firmware v3.4 deixa de enviar campos legados
      │
      ▼
validação de novas leituras
      │
      ▼
03_finalizar_migracao_v3_4_remover_legados.sql
      │
      ▼
Schema v3.4 homologado
```

---

## 8. Segurança

Nunca versionar neste diretório:

- `service_role`;
- Secret key;
- senha do banco;
- tokens administrativos;
- credenciais privadas.

As credenciais utilizadas pelo cliente devem seguir o princípio do menor privilégio.

---

## 9. Próximos passos

As evoluções previstas incluem:

- exportar o schema homologado diretamente do Supabase;
- criar um script de instalação limpa reproduzível;
- definir a política de leitura do dashboard remoto;
- implementar envio Cloud de eventos;
- desenvolver mecanismo resiliente de fila e reenvio;
- adicionar prevenção de duplicidades.

Esses itens são evolução futura e não devem ser interpretados como já implementados.
