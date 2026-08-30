import "./style.css";
import Chart from "chart.js/auto";

let periodoAtual = "24h";
const charts = {};

const $ = (seletor) => document.querySelector(seletor);
const $$ = (seletor) => [...document.querySelectorAll(seletor)];

function fmtNumero(valor, casas = 1) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function fmtDataHora(valor) {
  if (!valor) return "—";
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return "—";
  return data.toLocaleString("pt-BR");
}

function setConexao(status) {
  const dot = $("#connection-dot");
  const texto = $("#connection-text");
  dot.className = "dot";

  if (status === "online") {
    dot.classList.add("online");
    texto.textContent = "estação online";
  } else if (status === "atraso") {
    dot.classList.add("delay");
    texto.textContent = "estação com atraso";
  } else {
    dot.classList.add("offline");
    texto.textContent = "estação offline";
  }
}

function card(rotulo, valor, classe = "") {
  return `
    <article class="metric-card ${classe}">
      <span>${rotulo}</span>
      <strong>${valor}</strong>
    </article>
  `;
}

function renderAgora(d) {
  setConexao(d.status);

  const itens = [
    ["Status", (d.status || "—").toUpperCase()],
    ["Temperatura", `${fmtNumero(d.temperatura)} °C`],
    ["Umidade", `${fmtNumero(d.umidade, 0)} %`],
    ["Pressão mar", `${fmtNumero(d.pressao_mar, 1)} hPa`],
    ["Pressão local", `${fmtNumero(d.pressao_local, 1)} hPa`],
    ["Ponto de orvalho", `${fmtNumero(d.ponto_orvalho)} °C`],
    ["Tendência pressão", `${fmtNumero(d.tendencia_pressao_hora, 2)} hPa/h`],
    ["Estado geral", d.estado_geral || "—"],
    ["RSSI", `${fmtNumero(d.rssi, 0)} dBm`]
  ];

  $("#cards-agora").innerHTML = itens.map(([r, v]) => card(r, v)).join("");
  $("#ultima-leitura").textContent = `Última leitura: ${fmtDataHora(d.ultima_leitura)}`;
  $("#nome-estacao").textContent = `Estação: ${d.nome_estacao || d.estacao || "—"}`;
  $("#json-agora").textContent = JSON.stringify(d, null, 2);
}

async function carregarAgora() {
  $("#connection-text").textContent = "consultando...";
  try {
    const resp = await fetch("/api/agora", { cache: "no-store" });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.mensagem || `HTTP ${resp.status}`);
    renderAgora(dados);
    return dados;
  } catch (erro) {
    setConexao("offline");
    $("#json-agora").textContent = String(erro);
    throw erro;
  }
}

function labelTempo(timestamp, periodo) {
  const d = new Date(timestamp);

  if (periodo === "24h") {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  if (periodo === "7d") {
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit"
  });
}

function criarOuAtualizarChart(id, labels, serieEstacao, serieExterna, tituloEstacao, tituloExterno) {
  const canvas = document.getElementById(id);

  if (charts[id]) {
    charts[id].destroy();
  }

  const datasets = [
    {
      label: tituloEstacao,
      data: serieEstacao,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.18,
      spanGaps: true
    }
  ];

  if (Array.isArray(serieExterna)) {
    datasets.push({
      label: tituloExterno,
      data: serieExterna,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.18,
      spanGaps: true,
      borderDash: [6, 5]
    });
  }

  charts[id] = new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "bottom"
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 10,
            autoSkip: true
          }
        },
        y: {
          ticks: {
            maxTicksLimit: 6
          }
        }
      }
    }
  });
}

function renderHistorico(h) {
  const dados = Array.isArray(h.dados) ? h.dados : [];
  const labels = dados.map((p) => labelTempo(p.timestamp, periodoAtual));

  criarOuAtualizarChart(
    "chart-temperatura",
    labels,
    dados.map((p) => p.temperatura),
    dados.map((p) => p.externo_temperatura),
    "Estação",
    "Open-Meteo"
  );

  criarOuAtualizarChart(
    "chart-umidade",
    labels,
    dados.map((p) => p.umidade),
    dados.map((p) => p.externo_umidade),
    "Estação",
    "Open-Meteo"
  );

  criarOuAtualizarChart(
    "chart-pressao",
    labels,
    dados.map((p) => p.pressao_mar),
    dados.map((p) => p.externo_pressao_mar),
    "Estação",
    "Open-Meteo"
  );

  criarOuAtualizarChart(
    "chart-orvalho",
    labels,
    dados.map((p) => p.ponto_orvalho),
    null,
    "Estação",
    null
  );

  $("#resolucao-info").textContent = `Resolução: ${h.resolucao || "—"}`;
  $("#amostras-info").textContent = `Amostras: ${h.amostras_brutas ?? "—"}`;
}

function statLine(rotulo, valor, unidade) {
  return `<div class="stat-line"><span>${rotulo}</span><strong>${valor}${unidade}</strong></div>`;
}

function summaryCard(titulo, bloco, unidade, incluirAmplitude = false) {
  return `
    <article class="summary-card">
      <h3>${titulo}</h3>
      ${statLine("Mínimo", fmtNumero(bloco?.min), ` ${unidade}`)}
      ${statLine("Média", fmtNumero(bloco?.media), ` ${unidade}`)}
      ${statLine("Máximo", fmtNumero(bloco?.max), ` ${unidade}`)}
      ${incluirAmplitude ? statLine("Amplitude", fmtNumero(bloco?.amplitude), ` ${unidade}`) : ""}
    </article>
  `;
}

function renderResumo(r) {
  $("#cards-resumo").innerHTML = [
    summaryCard("Temperatura", r.temperatura, "°C", true),
    summaryCard("Umidade", r.umidade, "%"),
    summaryCard("Pressão mar", r.pressao_mar, "hPa", true),
    summaryCard("Pressão local", r.pressao_local, "hPa", true),
    summaryCard("Ponto de orvalho", r.ponto_orvalho, "°C")
  ].join("");

  const ext = r.externo || {};
  const comparacoes = [
    ["Temperatura média", r.temperatura?.media, ext.temperatura?.media, "°C"],
    ["Umidade média", r.umidade?.media, ext.umidade?.media, "%"],
    ["Pressão média", r.pressao_mar?.media, ext.pressao_mar?.media, "hPa"]
  ];

  $("#cards-comparacao").innerHTML = comparacoes.map(([rotulo, est, ex, unidade]) => {
    const delta = (typeof est === "number" && typeof ex === "number") ? est - ex : null;
    const deltaTxt = delta === null ? "—" : `${delta >= 0 ? "+" : ""}${fmtNumero(delta)} ${unidade}`;

    return `
      <article class="comparison-card">
        <h3>${rotulo}</h3>
        <div class="comparison-values">
          <div><span>Estação</span><strong>${fmtNumero(est)} ${unidade}</strong></div>
          <div><span>Open-Meteo</span><strong>${fmtNumero(ex)} ${unidade}</strong></div>
          <div><span>Δ</span><strong>${deltaTxt}</strong></div>
        </div>
      </article>
    `;
  }).join("");

  $("#json-resumo").textContent = JSON.stringify(r, null, 2);
}

async function carregarHistoricoEResumo() {
  $("#periodo-info").textContent = `Período: ${periodoAtual === "24h" ? "24 h" : periodoAtual === "7d" ? "7 dias" : "30 dias"}`;

  const [respHist, respResumo] = await Promise.all([
    fetch(`/api/historico?periodo=${periodoAtual}`, { cache: "no-store" }),
    fetch(`/api/resumo?periodo=${periodoAtual}`, { cache: "no-store" })
  ]);

  const [hist, resumo] = await Promise.all([respHist.json(), respResumo.json()]);

  if (!respHist.ok) throw new Error(hist.mensagem || `Histórico HTTP ${respHist.status}`);
  if (!respResumo.ok) throw new Error(resumo.mensagem || `Resumo HTTP ${respResumo.status}`);

  renderHistorico(hist);
  renderResumo(resumo);
}

async function trocarPeriodo(periodo) {
  periodoAtual = periodo;
  $$(".period-button").forEach((b) => b.classList.toggle("active", b.dataset.periodo === periodo));
  await carregarHistoricoEResumo();
}

$("#atualizar-agora").addEventListener("click", async () => {
  const botao = $("#atualizar-agora");
  botao.disabled = true;
  try {
    await carregarAgora();
  } finally {
    botao.disabled = false;
  }
});

$$(".period-button").forEach((botao) => {
  botao.addEventListener("click", () => trocarPeriodo(botao.dataset.periodo));
});

async function iniciar() {
  try {
    await Promise.all([carregarAgora(), carregarHistoricoEResumo()]);
  } catch (erro) {
    console.error("[dashboard]", erro);
  }
}

iniciar();
