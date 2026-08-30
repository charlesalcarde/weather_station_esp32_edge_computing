import { buscarResumoEstatistico, getConfig } from "./_supabase.js";

const MAX_PERIODO_MS = 365 * 24 * 60 * 60 * 1000;

function erroHttp(status, code, mensagem) {
  const erro = new Error(mensagem);
  erro.httpStatus = status;
  erro.code = code;
  return erro;
}

function parseData(valor, nome) {
  let texto = String(valor || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    texto += nome === "fim" ? "T23:59:59.999Z" : "T00:00:00.000Z";
  }
  const data = new Date(texto);
  if (!Number.isFinite(data.getTime())) {
    throw erroHttp(400, "data_invalida", `O parâmetro ${nome} não contém uma data válida.`);
  }
  return data;
}

function resolverIntervalo(query) {
  const agora = new Date();

  if (query.inicio || query.fim) {
    if (!query.inicio || !query.fim) {
      throw erroHttp(400, "intervalo_incompleto", "Informe inicio e fim juntos.");
    }
    const inicio = parseData(query.inicio, "inicio");
    const fim = parseData(query.fim, "fim");
    if (inicio >= fim) {
      throw erroHttp(400, "periodo_invalido", "A data inicial deve ser anterior à data final.");
    }
    return { tipo: "personalizado", inicio, fim };
  }

  const periodo = String(query.periodo || "24h").toLowerCase();
  const duracoes = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000
  };
  if (!duracoes[periodo]) {
    throw erroHttp(400, "periodo_invalido", "Use periodo=24h, periodo=7d, periodo=30d ou informe inicio e fim.");
  }
  return { tipo: periodo, inicio: new Date(agora.getTime() - duracoes[periodo]), fim: agora };
}

function arredondar(v, casas = 3) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

function bloco(obj) {
  if (!obj || typeof obj !== "object") return null;
  return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, typeof v === "number" ? arredondar(v) : v]));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ erro: "metodo_nao_permitido", mensagem: "Use GET neste endpoint." });
  }

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");

  try {
    const { estacao: estacaoConfigurada } = getConfig();
    const estacaoSolicitada = String(req.query.estacao || estacaoConfigurada).trim();

    if (estacaoSolicitada !== estacaoConfigurada) {
      throw erroHttp(403, "estacao_nao_autorizada", "A estação solicitada não está autorizada neste projeto.");
    }

    const intervalo = resolverIntervalo(req.query);
    const duracao = intervalo.fim.getTime() - intervalo.inicio.getTime();
    if (duracao > MAX_PERIODO_MS) {
      throw erroHttp(400, "periodo_maximo_excedido", "O período máximo por consulta é de 365 dias.");
    }

    const resumo = await buscarResumoEstatistico({
      estacao: estacaoConfigurada,
      inicio: intervalo.inicio.toISOString(),
      fim: intervalo.fim.toISOString()
    });

    return res.status(200).json({
      estacao: estacaoConfigurada,
      periodo: {
        tipo: intervalo.tipo,
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString()
      },
      fuso_dos_timestamps: "UTC",
      amostras: resumo?.amostras ?? 0,
      temperatura: bloco(resumo?.temperatura),
      umidade: bloco(resumo?.umidade),
      pressao_mar: bloco(resumo?.pressao_mar),
      pressao_local: bloco(resumo?.pressao_local),
      ponto_orvalho: bloco(resumo?.ponto_orvalho),
      externo: resumo?.externo ? {
        temperatura: bloco(resumo.externo.temperatura),
        umidade: bloco(resumo.externo.umidade),
        pressao_mar: bloco(resumo.externo.pressao_mar)
      } : null,
      qualidade_dados: resumo?.qualidade_dados ?? null
    });
  } catch (erro) {
    console.error("[api/resumo]", erro);
    const status = erro.httpStatus || 500;
    return res.status(status).json({
      erro: erro.code || "erro_interno",
      mensagem: status === 500 ? "Não foi possível calcular o resumo da estação." : erro.message
    });
  }
}
