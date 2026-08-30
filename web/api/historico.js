import {
  buscarHistoricoAgregado,
  getConfig
} from "./_supabase.js";

const MAX_PERIODO_MS = 365 * 24 * 60 * 60 * 1000;

function erroHttp(status, code, mensagem) {
  const erro = new Error(mensagem);
  erro.httpStatus = status;
  erro.code = code;
  return erro;
}

function parseData(valor, nome) {
  if (!valor) return null;

  let texto = String(valor).trim();

  // Data pura é aceita como UTC nesta versão.
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    texto += nome === "fim"
      ? "T23:59:59.999Z"
      : "T00:00:00.000Z";
  }

  const data = new Date(texto);

  if (!Number.isFinite(data.getTime())) {
    throw erroHttp(
      400,
      "data_invalida",
      `O parâmetro ${nome} não contém uma data válida.`
    );
  }

  return data;
}

function resolverIntervalo(query) {
  const agora = new Date();

  if (query.inicio || query.fim) {
    if (!query.inicio || !query.fim) {
      throw erroHttp(
        400,
        "intervalo_incompleto",
        "Informe inicio e fim juntos."
      );
    }

    const inicio = parseData(query.inicio, "inicio");
    const fim = parseData(query.fim, "fim");

    if (inicio >= fim) {
      throw erroHttp(
        400,
        "periodo_invalido",
        "A data inicial deve ser anterior à data final."
      );
    }

    return {
      tipo: "personalizado",
      inicio,
      fim
    };
  }

  const periodo = String(query.periodo || "24h").toLowerCase();

  const duracoes = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000
  };

  if (!duracoes[periodo]) {
    throw erroHttp(
      400,
      "periodo_invalido",
      "Use periodo=24h, periodo=7d, periodo=30d ou informe inicio e fim."
    );
  }

  return {
    tipo: periodo,
    inicio: new Date(agora.getTime() - duracoes[periodo]),
    fim: agora
  };
}

function resolverResolucao(inicio, fim) {
  const duracaoMs = fim.getTime() - inicio.getTime();
  const dia = 24 * 60 * 60 * 1000;

  if (duracaoMs <= dia) {
    return {
      nome: "1min",
      bucketSeconds: 60,
      intervaloMinutos: 1
    };
  }

  if (duracaoMs <= 7 * dia) {
    return {
      nome: "15min",
      bucketSeconds: 15 * 60,
      intervaloMinutos: 15
    };
  }

  if (duracaoMs <= 31 * dia) {
    return {
      nome: "1h",
      bucketSeconds: 60 * 60,
      intervaloMinutos: 60
    };
  }

  return {
    nome: "1d",
    bucketSeconds: 24 * 60 * 60,
    intervaloMinutos: 24 * 60
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      erro: "metodo_nao_permitido",
      mensagem: "Use GET neste endpoint."
    });
  }

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");

  try {
    const { estacao: estacaoConfigurada } = getConfig();
    const estacaoSolicitada = String(
      req.query.estacao || estacaoConfigurada
    ).trim();

    // Nesta etapa o endpoint só expõe a estação configurada no Vercel.
    if (estacaoSolicitada !== estacaoConfigurada) {
      throw erroHttp(
        403,
        "estacao_nao_autorizada",
        "A estação solicitada não está autorizada neste projeto."
      );
    }

    const intervalo = resolverIntervalo(req.query);
    const duracao = intervalo.fim.getTime() - intervalo.inicio.getTime();

    if (duracao > MAX_PERIODO_MS) {
      throw erroHttp(
        400,
        "periodo_maximo_excedido",
        "O período máximo por consulta é de 365 dias."
      );
    }

    const resolucao = resolverResolucao(intervalo.inicio, intervalo.fim);

    const agregado = await buscarHistoricoAgregado({
      estacao: estacaoConfigurada,
      inicio: intervalo.inicio.toISOString(),
      fim: intervalo.fim.toISOString(),
      bucketSeconds: resolucao.bucketSeconds
    });

    return res.status(200).json({
      estacao: estacaoConfigurada,
      periodo: {
        tipo: intervalo.tipo,
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString()
      },
      resolucao: resolucao.nome,
      intervalo_minutos: resolucao.intervaloMinutos,
      fuso_dos_timestamps: "UTC",
      amostras_brutas: agregado?.amostras ?? 0,
      pontos: agregado?.pontos ?? 0,
      dados: Array.isArray(agregado?.dados) ? agregado.dados : []
    });
  } catch (erro) {
    console.error("[api/historico]", erro);

    const status = erro.httpStatus || 500;

    return res.status(status).json({
      erro: erro.code || "erro_interno",
      mensagem:
        status === 500
          ? "Não foi possível consultar o histórico da estação."
          : erro.message
    });
  }
}
