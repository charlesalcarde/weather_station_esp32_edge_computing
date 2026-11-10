import { getConfig } from "./_supabase.js";

// A consulta M5 não utiliza os buckets da API de gráficos.
// Paginação explícita: não assumir que o Supabase devolve toda a série em uma chamada.
const PAGE_SIZE = 1000;
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ erro: "metodo_nao_permitido" });
  }
  try {
    const { url, serviceRole, estacao } = getConfig();
    const inicio = new Date(String(req.query.inicio || ""));
    const fim = new Date(String(req.query.fim || ""));
    const pagina = Number(req.query.pagina ?? 0);
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) ||
        inicio >= fim || fim.getTime() - inicio.getTime() > 365 * 86400000 ||
        !Number.isSafeInteger(pagina) || pagina < 0 || pagina > 100000) {
      return res.status(400).json({ erro: "parametros_invalidos" });
    }
    const endpoint = new URL(url + "/rest/v1/leituras");
    endpoint.searchParams.set("select", "id,created_at,temperatura,umidade,pressao_mar");
    endpoint.searchParams.set("estacao", "eq." + estacao);
    endpoint.searchParams.set("created_at", "gte." + inicio.toISOString());
    endpoint.searchParams.set("and", "(created_at.lt." + fim.toISOString() + ")");
    endpoint.searchParams.set("order", "created_at.asc,id.asc");
    endpoint.searchParams.set("limit", String(PAGE_SIZE));
    endpoint.searchParams.set("offset", String(pagina * PAGE_SIZE));
    const resposta = await fetch(endpoint, {
      headers: { apikey: serviceRole, Accept: "application/json" },
      cache: "no-store"
    });
    if (!resposta.ok) throw new Error("Supabase HTTP " + resposta.status);
    const dados = await resposta.json();
    if (!Array.isArray(dados)) throw new Error("Resposta inválida do Supabase");
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      pagina, tamanho_pagina: PAGE_SIZE,
      proxima_pagina: dados.length === PAGE_SIZE ? pagina + 1 : null,
      dados: dados.map(p => ({
        timestamp: p.created_at,
        temperatura: p.temperatura,
        umidade: p.umidade,
        pressao_mar: p.pressao_mar
      }))
    });
  } catch (erro) {
    console.error("[api/m5-serie]", erro);
    return res.status(502).json({
      erro: "falha_serie_bruta",
      mensagem: "Não foi possível consultar todas as leituras originais para o laboratório M5."
    });
  }
}
