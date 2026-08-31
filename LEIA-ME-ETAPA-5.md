# Dashboard Web v3.4 — Etapa 5

## Índice

- [Objetivo](#objetivo)
- [Evoluções](#evoluções)
- [Arquivos alterados](#arquivos-alterados)
- [Banco de dados](#banco-de-dados)
- [Roteiro de homologação](#roteiro-de-homologação)

## Objetivo

Evoluir a camada Web sem alterar o firmware homologado e sem criar nova migração no Supabase.

## Evoluções

- modo claro/escuro persistente;
- código da estação, nome, localização e altitude no cabeçalho;
- períodos 24 h, 7 dias, 30 dias, mês atual e personalizado;
- controle global de visibilidade Estação/Open-Meteo;
- tooltip com data e hora completas;
- gráficos de diferença temporal para temperatura, umidade e pressão.

A diferença usada nos novos gráficos é:

$$
\Delta = x_{estacao} - x_{OpenMeteo}
$$

## Arquivos alterados

```text
web/index.html
web/src/main.js
web/src/style.css
web/package.json
web/README.md
```

## Banco de dados

Nenhuma nova migração SQL é necessária. Os endpoints homologados da Etapa 3 continuam sendo utilizados.

## Roteiro de homologação

1. Validar código, nome, localização e altitude no cabeçalho.
2. Alternar Claro/Escuro e recarregar a página para confirmar persistência.
3. Testar 24 h, 7 dias e 30 dias.
4. Testar Mês atual.
5. Testar um período personalizado.
6. Mostrar/ocultar Estação e Open-Meteo.
7. Conferir tooltips com data/hora.
8. Conferir os três gráficos Δ.
9. Conferir resumo e comparação do período.
