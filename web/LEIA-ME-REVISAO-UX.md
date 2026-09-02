# Revisão UX/UI — Estação Ambiental Experimental

## Índice

1. [Objetivo](#objetivo)
2. [Principais mudanças](#principais-mudanças)
3. [Arquivos alterados](#arquivos-alterados)
4. [Componentes preservados](#componentes-preservados)
5. [Validação recomendada](#validação-recomendada)

## Objetivo

Esta revisão melhora a identidade, a contextualização e a explicabilidade do dashboard Web sem alterar a arquitetura de dados homologada.

A interface passa a comunicar explicitamente que a EA-0001 é uma **Estação Ambiental Experimental baseada em Computação de Borda (Edge Computing)**.

## Principais mudanças

- título principal alterado para **Estação Ambiental Experimental**;
- versão `v3.4` deslocada para o rodapé como metadado técnico;
- destaque visual para a independência do Edge em relação à Cloud;
- modal **Conheça a estação**;
- modais `i` para as principais métricas e conceitos;
- explicação explícita do ambiente interno/isolado em que a estação está instalada;
- diferenciação visual entre dados medidos, calculados no Edge e indicadores de conectividade;
- explicação da Open-Meteo como referência meteorológica externa;
- reorganização da comparação Estação × Open-Meteo;
- manutenção dos modos claro/escuro e da atualização automática.

## Arquivos alterados

```text
web/index.html
web/src/main.js
web/src/style.css
web/README.md
web/LEIA-ME-REVISAO-UX.md
```

## Componentes preservados

Nenhum arquivo da API foi alterado:

```text
web/api/_supabase.js
web/api/agora.js
web/api/historico.js
web/api/resumo.js
```

Também não houve alteração em firmware, Supabase, migrations ou schema do banco.

## Validação recomendada

Após publicar na Vercel, validar:

1. carregamento de `/api/agora`;
2. histórico de 24 h, 7 dias e 30 dias;
3. resumo estatístico;
4. alternância claro/escuro;
5. atualização automática;
6. abertura e fechamento dos modais `i`;
7. responsividade em desktop e celular;
8. comparação Estação × Open-Meteo;
9. ausência de erros no console do navegador.
