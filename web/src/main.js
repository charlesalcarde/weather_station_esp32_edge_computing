import "./style.css";
import Chart from "chart.js/auto";

let filtroAtual = { tipo: "periodo", valor: "24h", rotulo: "24 h" };
let ultimoHistorico = null;
const charts = {};

const INTERVALO_AGORA_S = 60;
const INTERVALO_HISTORICO_MS = 5 * 60 * 1000;
let segundosParaAtualizar = INTERVALO_AGORA_S;
let atualizandoAgora = false;
let atualizandoHistorico = false;
let cidadeReferenciaAtual = "localização configurada";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const INFO = {
  "sobre-estacao": {
    eyebrow: "Sobre o projeto",
    title: "Estação Ambiental Experimental",
    body: `
      <p>Esta estação é uma plataforma experimental de monitoramento ambiental baseada em <strong>Computação de Borda (Edge Computing)</strong>.</p>
      <p>Os sensores são conectados diretamente a um ESP32. O próprio microcontrolador realiza a aquisição, os cálculos, as médias, a análise de tendência, as conversões, a classificação de estados ambientais e a detecção de eventos.</p>
      <div class="modal-highlight"><strong>Edge primeiro; Cloud como extensão.</strong><br>A operação ambiental principal não depende de Supabase, Vercel ou Open-Meteo.</div>
      <p>A camada Cloud acrescenta armazenamento histórico, acesso remoto e análises. A Open-Meteo é utilizada apenas como referência meteorológica externa.</p>
    `
  },
  "edge-computing": {
    eyebrow: "Arquitetura",
    title: "O que significa Computação de Borda aqui?",
    body: `
      <p>Computação de Borda significa processar os dados próximo de onde eles são produzidos. Nesta estação, a borda é o próprio <strong>ESP32</strong>.</p>
      <ul><li>Aquisição dos sensores.</li><li>Médias móveis.</li><li>Tendência da pressão.</li><li>Conversões e ponto de orvalho.</li><li>Estados ambientais e alertas.</li><li>Registro e apresentação local.</li></ul>
      <p>Se a Internet ou a Cloud estiverem indisponíveis, a estação continua realizando essas funções. A conectividade é uma extensão da estação, não o seu núcleo operacional.</p>
    `
  },
  "medicoes-locais": {
    eyebrow: "Origem dos dados",
    title: "O que estas condições representam?",
    body: `
      <p>Estas informações descrevem o <strong>microambiente onde a estação está fisicamente instalada</strong>.</p>
      <p>Atualmente, o equipamento encontra-se em ambiente interno/isolado do meio externo. Assim, os valores locais não devem ser interpretados automaticamente como a condição meteorológica externa de <strong>{{cidade}}</strong>.</p>
      <p>A comparação com a Open-Meteo existe justamente para distinguir a medição local da referência meteorológica externa.</p>
    `
  },
  "status": {
    eyebrow: "Conectividade",
    title: "Status da estação",
    body: `<p>Indica a recência da última telemetria recebida pela plataforma Web. É um indicador de comunicação remota e não significa, por si só, que o processamento local do ESP32 esteja parado.</p>`
  },
  "temperatura": {
    eyebrow: "Medição local",
    title: "Temperatura",
    body: `<p>Temperatura utilizada como referência principal da estação e medida localmente pelo <strong>BMP180</strong>. O valor é adquirido pelo ESP32 e processado na borda.</p>`
  },
  "umidade": {
    eyebrow: "Medição local",
    title: "Umidade relativa do ar",
    body: `<p>Umidade relativa medida localmente pelo <strong>DHT11</strong>. Representa a quantidade relativa de vapor de água presente no ar do ambiente onde a estação está instalada.</p>`
  },
  "pressao-mar": {
    eyebrow: "Calculado no Edge",
    title: "Pressão ao nível do mar",
    body: `<p>É a pressão atmosférica local corrigida para uma referência equivalente ao nível do mar, utilizando a altitude da estação. Essa conversão facilita a comparação com referências meteorológicas externas.</p>`
  },
  "pressao-local": {
    eyebrow: "Medição local",
    title: "Pressão local",
    body: `<p>Pressão atmosférica medida pelo BMP180 na altitude física onde a estação está instalada. Diferentemente da pressão ao nível do mar, este valor não é normalizado para altitude zero.</p>`
  },
  "ponto-orvalho": {
    eyebrow: "Calculado no Edge",
    title: "Ponto de orvalho",
    body: `<p>Temperatura estimada na qual o vapor de água presente no ar começaria a condensar. É calculada localmente pelo ESP32 a partir de temperatura e umidade.</p>`
  },
  "tendencia-pressao": {
    eyebrow: "Calculado no Edge",
    title: "Tendência da pressão",
    body: `<p>Taxa de variação da pressão atmosférica ao longo do tempo, expressa em hPa/h. É calculada pela própria estação a partir do histórico recente. Valores positivos indicam tendência de aumento; valores negativos, tendência de queda.</p>`
  },
  "estado-geral": {
    eyebrow: "Interpretação no Edge",
    title: "Estado geral",
    body: `<p>Síntese produzida pelo processamento local da estação a partir das variáveis ambientais, tendências e regras definidas no firmware. Não é uma classificação fornecida pela Cloud.</p>`
  },
  "rssi": {
    eyebrow: "Conectividade",
    title: "RSSI",
    body: `<p>Indicador da intensidade do sinal Wi-Fi recebido pelo ESP32, medido em dBm. Valores menos negativos representam, em geral, sinal mais forte. Ele descreve a conectividade e não a condição ambiental.</p>`
  },
  "hardware-estacao": {
    eyebrow: "Hardware",
    title: "Conheça o hardware da estação",
    body: `
      <p>A estação combina um <strong>ESP32</strong> com dois sensores ambientais. O ESP32 é o núcleo de processamento Edge: recebe as leituras, executa cálculos e mantém a operação local antes de qualquer envio para a Cloud.</p>
      <div class="hardware-grid">
        <article class="hardware-card">
          <div class="hardware-image-wrap"><img src="/hardware/esp32.png" alt="Placa ESP32 utilizada como núcleo de processamento da estação" loading="lazy"></div>
          <div><h3>ESP32</h3><p>Microcontrolador que funciona como o <strong>nó Edge</strong> da estação. Faz aquisição dos sensores, médias, tendências, conversões, classificação de estados, conectividade e servidor Web local.</p></div>
        </article>
        <article class="hardware-card">
          <div class="hardware-image-wrap"><img src="/hardware/bmp180.png" alt="Módulo sensor BMP180" loading="lazy"></div>
          <div><h3>BMP180</h3><p>Sensor barométrico utilizado para <strong>pressão atmosférica</strong> e para a temperatura principal da arquitetura Cloud. Comunica-se com o ESP32 pelo barramento I²C.</p></div>
        </article>
        <article class="hardware-card">
          <div class="hardware-image-wrap"><img src="/hardware/dht11.png" alt="Módulo sensor DHT11" loading="lazy"></div>
          <div><h3>DHT11</h3><p>Sensor utilizado para medir a <strong>umidade relativa do ar</strong>. Também fornece temperatura auxiliar, mas a temperatura canônica enviada à Cloud permanece a do BMP180.</p></div>
        </article>
      </div>
      <div class="modal-highlight"><strong>Fluxo local:</strong> sensores → ESP32 → processamento Edge → dashboard local / telemetria Cloud.</div>
    `
  },
  "open-meteo": {
    eyebrow: "Fonte externa",
    title: "O que é Open-Meteo?",
    body: `
      <p><strong>Open-Meteo</strong> é um serviço externo de dados meteorológicos consultado pela estação/plataforma por API.</p>
      <p>Seus dados não são medições produzidas pelos sensores locais. Eles funcionam como <strong>referência meteorológica externa</strong> para a localização configurada e permitem comparar o microambiente da estação com as condições externas estimadas.</p>
      <div class="modal-highlight">Estação = medição local.<br>Open-Meteo = referência externa.</div>
    `
  },
  "historico": {
    eyebrow: "Cloud",
    title: "Histórico e evolução temporal",
    body: `<p>Os dados enviados pelo ESP32 são armazenados no Supabase. A camada Web consulta esse histórico por meio das APIs serverless da Vercel e apresenta a evolução temporal sem transferir o processamento ambiental principal para a nuvem.</p>`
  },
  "delta": {
    eyebrow: "Comparação",
    title: "Δ Estação − Open-Meteo",
    body: `<p>O delta mostra a diferença entre a medição/valor da estação e a referência externa da Open-Meteo. Um valor positivo significa que a estação está acima da referência; um valor negativo, abaixo.</p><p>Essa diferença é especialmente útil porque a estação encontra-se em um microambiente local que pode responder de forma diferente das condições externas.</p>`
  },
  "resposta-subdiaria": {
    eyebrow: "Dinâmica em horas",
    title: "Resposta subdiária do microambiente",
    body: `<p>Os pontos históricos são agrupados em horas UTC completas, com pelo menos 75% dos intervalos de agregação presentes e valores válidos de ambas as fontes. A análise exige resolução histórica de até 1 hora.</p><p>Calculam-se diferenças entre médias de horas consecutivas, reduzindo a influência de tendências lentas. A razão de variabilidade compara os desvios-padrão dessas diferenças horárias locais e externas. Um valor inferior a 1 indica mudanças horárias locais menos variáveis, mas não demonstra isolamento térmico.</p><p>Testam-se atrasos locais de 1 a 6 horas. Cada candidato é comparado ao atraso zero usando os mesmos horários e exige pelo menos 18 pares, variabilidade suficiente e ganho de correlação de pelo menos 0,10. A curva expansível mostra r para 0–6 horas; o número de pares pode variar por atraso. A escolha do atraso continua exigindo ganho em relação a r(0) nos mesmos horários. A correlação cruzada é exploratória: não prova causalidade nem mede diretamente o tempo de resposta física. A umidade relativa também depende da temperatura.</p>`
  },
  "resposta-dinamica": {
    eyebrow: "Dinâmica ambiental",
    title: "Defasagem e variabilidade local × externa",
    body: `<p>Para evitar tratar valores horários repetidos como observações independentes, a análise utiliza médias diárias em UTC ou agregados diários fornecidos pela API para janelas acima de 31 dias. Apenas dias completos, com cobertura de pelo menos 75% dos intervalos históricos e dados de ambas as fontes, são aceitos.</p><p>A defasagem é o deslocamento em dias que maximiza a correlação positiva entre as séries, testando de 0 a 3 dias de atraso local. É uma associação exploratória, não uma medida causal do tempo de resposta. O indicador só é exibido com pelo menos 8 pares de dias, variabilidade suficiente e melhoria de correlação de pelo menos 0,10 sobre o atraso zero, comparando os mesmos dias para cada atraso.</p><p>A razão de variabilidade é o desvio-padrão das médias diárias locais dividido pelo desvio-padrão das médias diárias externas, sem deslocamento. Valores inferiores a 1 indicam menor variabilidade diária local, mas não provam atenuação física de uma oscilação específica. A umidade relativa depende da temperatura; para conclusões sobre transporte de vapor, avaliar também umidade absoluta ou ponto de orvalho.</p>`
  },
  "analise-contextual": {
    eyebrow: "Análise científica",
    title: "Relação local × referência externa",
    body: `<p>Compara valores locais e externos que compartilham o mesmo intervalo agregado. A diferença média é local menos externo; na umidade, a unidade é ponto percentual.</p><p>O coeficiente de Pearson descreve associação linear, não causalidade. Não é calculado quando há poucos pares ou variabilidade insuficiente. Valores externos repetidos entre intervalos não representam novas observações independentes; por isso, a correlação é apenas exploratória e não recebe teste de significância.</p><p>Esta versão não estima defasagem temporal, atenuação de ciclos nem incerteza de sensores.</p>`
  },
  "qualidade-temporal": {
    eyebrow: "Observabilidade",
    title: "Qualidade temporal do histórico",
    body: `<p>Os indicadores medem a presença de intervalos agregados no histórico. A cobertura não equivale à taxa de recebimento das leituras brutas do ESP32.</p><p>Uma lacuna pode indicar ausência de transmissão, armazenamento ou consulta; não comprova interrupção das medições locais. A latência Edge → Cloud exige timestamps separados de medição e recebimento.</p>`
  },
  "resumo": {
    eyebrow: "Análise histórica",
    title: "Resumo do período",
    body: `<p>Apresenta estatísticas do período selecionado, como mínimo, média, máximo e amplitude. Esses valores são derivados do histórico armazenado na Cloud para facilitar análise temporal.</p>`
  }
};

const CARD_META = {
  "Status": { info: "status", kind: "connectivity", badge: "Conectividade" },
  "Temperatura": { info: "temperatura", kind: "measured", badge: "Medido" },
  "Umidade": { info: "umidade", kind: "measured", badge: "Medido" },
  "Pressão mar": { info: "pressao-mar", kind: "calculated", badge: "Edge" },
  "Pressão local": { info: "pressao-local", kind: "measured", badge: "Medido" },
  "Ponto de orvalho": { info: "ponto-orvalho", kind: "calculated", badge: "Edge" },
  "Tendência pressão": { info: "tendencia-pressao", kind: "calculated", badge: "Edge" },
  "Estado geral": { info: "estado-geral", kind: "calculated", badge: "Edge" },
  "RSSI": { info: "rssi", kind: "connectivity", badge: "Conectividade" }
};

function fmtNumero(valor, casas = 1) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function fmtDataHora(valor) {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data.toLocaleString("pt-BR") : "—";
}

function dataInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function abrirInfo(chave) {
  const info = INFO[chave];
  if (!info) return;
  $("#info-modal-eyebrow").textContent = info.eyebrow || "Informação";
  $("#info-modal-title").textContent = info.title;
  $("#info-modal-body").innerHTML = info.body.replaceAll("{{cidade}}", cidadeReferenciaAtual);
  $("#info-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  $("#info-modal-close").focus();
}

function fecharInfo() {
  $("#info-modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function configurarInfos() {
  $$(".info-action").forEach((el) => el.addEventListener("click", () => abrirInfo(el.dataset.info)));
  $("#info-modal-close").addEventListener("click", fecharInfo);
  $("#info-modal").addEventListener("click", (ev) => { if (ev.target === $("#info-modal")) fecharInfo(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("#info-modal").classList.contains("hidden")) fecharInfo(); });
}

function setConexao(status) {
  const dot = $("#connection-dot");
  const texto = $("#connection-text");
  dot.className = "dot";
  if (status === "online") { dot.classList.add("online"); texto.textContent = "estação online"; }
  else if (status === "atraso") { dot.classList.add("delay"); texto.textContent = "estação com atraso"; }
  else { dot.classList.add("offline"); texto.textContent = "estação offline"; }
}

function card(rotulo, valor) {
  const meta = CARD_META[rotulo] || {};
  return `<article class="metric-card ${meta.kind || ""}">
    <div class="metric-card-head">
      <span>${rotulo}</span>
      ${meta.info ? `<button class="info-icon metric-info" type="button" data-card-info="${meta.info}" aria-label="Explicação sobre ${rotulo}">i</button>` : ""}
    </div>
    <strong>${valor}</strong>
    ${meta.badge ? `<small class="metric-origin ${meta.kind || ""}">${meta.badge}</small>` : ""}
  </article>`;
}

function obterCidadeReferencia(local) {
  if (!local || typeof local !== "string") return "localização configurada";
  const texto = local.trim();
  if (!texto) return "localização configurada";
  if (texto.includes(" - ")) return texto.split(" - ")[0].trim() || texto;
  if (texto.includes(",")) return texto.split(",")[0].trim() || texto;
  return texto;
}

function atualizarCidadeReferencia(local) {
  cidadeReferenciaAtual = obterCidadeReferencia(local);
  const el = $("#context-city");
  if (el) el.textContent = cidadeReferenciaAtual;
}

function renderIdentidade(d) {
  const local = d.externo?.local || "—";
  atualizarCidadeReferencia(d.externo?.local);
  $("#station-code").textContent = d.estacao || "—";
  $("#station-name").textContent = d.nome_estacao || "—";
  $("#station-location").textContent = local;
  $("#station-altitude").textContent = d.altitude == null ? "—" : `${fmtNumero(d.altitude, 0)} m`;
}

function renderEdge(d) {
  const fonte = $("#edge-fonte");
  const painel = $("#edge-evidencias");
  if (!fonte || !painel) return;
  fonte.textContent = "Fonte: última telemetria recebida • " + fmtDataHora(d.ultima_leitura) + " • " + (d.estacao || "estação não identificada") + ".";

  // Interpreta apenas critérios cujo valor de entrada é efetivamente transmitido.
  // O estado permanece aquele informado pelo firmware: não recalculamos a classificação.
  function contextualizarPressao() {
    const t = d.tendencia_pressao_hora;
    if (typeof t !== "number" || !Number.isFinite(t)) return "Tendência não disponível para comparação com os limiares.";
    const faixa = t > 0.5 ? "subida (> +0,5 hPa/h)" : t < -0.5 ? "queda (< −0,5 hPa/h)" : "estabilidade (−0,5 a +0,5 hPa/h)";
    return "Tendência " + fmtNumero(t, 2) + " hPa/h na faixa de " + faixa + ". A classificação transmitida pode refletir histerese (3 avaliações) e disponibilidade de histórico.";
  }
  function contextualizarUmidade() {
    const u = d.umidade;
    if (typeof u !== "number" || !Number.isFinite(u)) return "Umidade não disponível para comparação com os limiares.";
    const faixa = u < 30 ? "muito seco" : u < 40 ? "seco" : u <= 70 ? "moderada" : u <= 80 ? "elevada" : "muito alta";
    return "Leitura de " + fmtNumero(u, 0) + "% na faixa " + faixa + ". O estado transmitido pode refletir histerese (3 avaliações).";
  }
  function contextualizarGeral() {
    return "Síntese informada pelo ESP32 a partir de anomalia, instabilidade e alertas; a transição exige 2 avaliações. Não é possível reconstruir todos os critérios internos a partir desta telemetria.";
  }
  const campos = [
    ["Estado geral", d.estado_geral, "Classificação transmitida", contextualizarGeral()],
    ["Estado da umidade", d.estado_umidade, "Classificação transmitida", contextualizarUmidade()],
    ["Estado de conforto", d.estado_conforto, "Classificação transmitida", "Depende da temperatura DHT11 e da umidade, com 3 avaliações de histerese. A temperatura BMP180 exibida no dashboard não permite verificar isoladamente essa decisão."],
    ["Estado da pressão", d.estado_pressao, "Classificação transmitida", contextualizarPressao()],
    ["Instabilidade", d.instabilidade, "Indicador transmitido", "Pontuação combina tendência barométrica, desvios de temperatura DHT11 e umidade. Sem todas as médias e contadores internos, a pontuação não é reconstruída."],
    ["Anomalia", d.anomalia, "Indicador transmitido", "Pode considerar saltos, divergência entre sensores e desvios das médias de 15 minutos. O disparador específico não está disponível nesta telemetria."],
    ["Número de alertas", d.numero_alertas, "Contagem transmitida"],
    ["Tendência da pressão", d.tendencia_pressao_hora == null ? null : fmtNumero(d.tendencia_pressao_hora, 2) + " hPa/h", "Derivado no Edge"],
    ["Temperatura", d.temperatura == null ? null : fmtNumero(d.temperatura) + " °C", "Medição local (BMP180)"],
    ["Umidade", d.umidade == null ? null : fmtNumero(d.umidade, 0) + " %", "Medição local"],
    ["RSSI", d.rssi == null ? null : fmtNumero(d.rssi, 0) + " dBm", "Telemetria de conectividade"]
  ];
  painel.replaceChildren();
  for (const [nome,valor,origem,contexto] of campos) {
    const item = document.createElement("div");
    item.className = "edge-indicador";
    const titulo = document.createElement("span");
    titulo.className = "edge-indicador-nome";
    titulo.textContent = nome;
    const valorEl = document.createElement("strong");
    valorEl.textContent = valor == null || valor === "" ? "Não informado" : String(valor);
    const descricao = document.createElement("small");
    descricao.textContent = origem;
    item.append(titulo, valorEl, descricao);
    if (contexto) {
      const explicacao = document.createElement("p");
      explicacao.className = "edge-indicador-contexto";
      explicacao.textContent = contexto;
      item.appendChild(explicacao);
    }
    painel.appendChild(item);
  }
}

function renderAgora(d) {
  setConexao(d.status);
  renderEdge(d);
  renderIdentidade(d);
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
  $("#cards-agora").innerHTML = itens.map(([r,v]) => card(r,v)).join("");
  $$("[data-card-info]").forEach((el) => el.addEventListener("click", () => abrirInfo(el.dataset.cardInfo)));
  $("#ultima-leitura").textContent = `Última leitura: ${fmtDataHora(d.ultima_leitura)}`;
  $("#nome-estacao").textContent = `Estação: ${d.nome_estacao || d.estacao || "—"}`;
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
    const fonte = $("#edge-fonte");
    if (fonte) fonte.textContent = "Última telemetria indisponível. Não é possível apresentar estados atuais."; 
    const painel = $("#edge-evidencias");
    if (painel) painel.replaceChildren();
    throw erro;
  }
}

function queryAtual() {
  return filtroAtual.tipo === "periodo"
    ? `periodo=${encodeURIComponent(filtroAtual.valor)}`
    : `inicio=${encodeURIComponent(filtroAtual.inicio)}&fim=${encodeURIComponent(filtroAtual.fim)}`;
}

function labelTempo(timestamp) {
  const d = new Date(timestamp);
  const inicio = ultimoHistorico?.periodo?.inicio ? new Date(ultimoHistorico.periodo.inicio) : null;
  const fim = ultimoHistorico?.periodo?.fim ? new Date(ultimoHistorico.periodo.fim) : null;
  const dias = inicio && fim ? (fim - inicio) / 86400000 : 1;
  if (dias <= 1.2) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dias <= 8) return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
  return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit" });
}

function temaChart() {
  const css = getComputedStyle(document.documentElement);
  return {
    texto: css.getPropertyValue("--chart-text").trim(),
    grade: css.getPropertyValue("--chart-grid").trim(),
    estacao: css.getPropertyValue("--chart-station").trim(),
    externo: css.getPropertyValue("--chart-external").trim(),
    delta: css.getPropertyValue("--chart-delta").trim()
  };
}

function datasetSerie(label, data, tipo = "estacao") {
  const t = temaChart();
  return {
    label, data, borderWidth: tipo === "externo" ? 1.5 : 2, pointRadius: 0,
    tension: 0.18, spanGaps: true,
    borderColor: tipo === "externo" ? t.externo : tipo === "delta" ? t.delta : t.estacao,
    backgroundColor: tipo === "externo" ? t.externo : tipo === "delta" ? t.delta : t.estacao,
    ...(tipo === "externo" ? { borderDash: [6,5] } : {})
  };
}

function criarChart(id, labels, datasets) {
  if (charts[id]) charts[id].destroy();
  const t = temaChart();
  charts[id] = new Chart(document.getElementById(id), {
    type: "line", data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: t.texto } },
        tooltip: { callbacks: { title(items) {
          const i = items?.[0]?.dataIndex;
          const ts = ultimoHistorico?.dados?.[i]?.timestamp;
          return ts ? new Date(ts).toLocaleString("pt-BR") : "";
        } } }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 10, autoSkip: true, color: t.texto }, grid: { color: t.grade } },
        y: { ticks: { maxTicksLimit: 6, color: t.texto }, grid: { color: t.grade } }
      }
    }
  });
}

function delta(a,b) { return typeof a === "number" && typeof b === "number" ? a-b : null; }

function aplicarVisibilidadeGlobal() {
  const est = $("#serie-estacao").checked;
  const ext = $("#serie-openmeteo").checked;
  ["chart-temperatura","chart-umidade","chart-pressao"].forEach(id => {
    const c=charts[id]; if(!c) return;
    c.setDatasetVisibility(0, est); c.setDatasetVisibility(1, ext); c.update();
  });
  const orv=charts["chart-orvalho"];
  if(orv){ orv.setDatasetVisibility(0, est); orv.update(); }
}

function renderQualidadeTemporal(h) {
  const alvo = $("#cards-qualidade");
  if (!alvo) return;
  const inicio = Date.parse(h.periodo?.inicio);
  const fim = Date.parse(h.periodo?.fim);
  const bucketMs = Number(h.intervalo_minutos) * 60000;
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio || !Number.isFinite(bucketMs) || bucketMs <= 0) {
    alvo.textContent = "Metadados temporais indisponíveis.";
    return;
  }

  // Considera apenas buckets inteiramente contidos na janela [inicio, fim).
  // Os buckets parciais das bordas não são classificados como perdas.
  const primeiroCompleto = Math.ceil(inicio / bucketMs);
  const ultimoCompleto = Math.floor(fim / bucketMs) - 1;
  const esperados = Math.max(0, ultimoCompleto - primeiroCompleto + 1);
  const presentes = new Set();
  let ultimaLeitura = null;

  for (const ponto of (Array.isArray(h.dados) ? h.dados : [])) {
    const ts = Date.parse(ponto.timestamp);
    if (!Number.isFinite(ts)) continue;
    if (ts >= inicio && ts < fim && (ultimaLeitura === null || ts > ultimaLeitura)) ultimaLeitura = ts;
    const indice = Math.floor(ts / bucketMs);
    if (indice >= primeiroCompleto && indice <= ultimoCompleto) presentes.add(indice);
  }

  const indices = [...presentes].sort((a,b) => a-b);
  let maiorLacuna = 0;
  let anterior = primeiroCompleto - 1;
  for (const indice of indices) {
    maiorLacuna = Math.max(maiorLacuna, indice - anterior - 1);
    anterior = indice;
  }
  if (esperados > 0) maiorLacuna = Math.max(maiorLacuna, ultimoCompleto - anterior);
  const faltantes = Math.max(0, esperados - presentes.size);
  const cobertura = esperados ? 100 * presentes.size / esperados : null;
  const atraso = ultimaLeitura === null ? null : Math.max(0, (fim - ultimaLeitura) / 60000);
  const cards = [
    ["Cobertura de intervalos", cobertura === null ? "—" : `${fmtNumero(cobertura, 1)} %`, `${presentes.size} de ${esperados} intervalos completos`],
    ["Intervalos sem dados", String(faltantes), `Resolução: ${h.resolucao || "—"}`],
    ["Maior lacuna", `${fmtNumero(maiorLacuna * Number(h.intervalo_minutos), 0)} min`, "Intervalos completos consecutivos sem dados"],
    ["Último ponto do período", ultimaLeitura === null ? "—" : fmtDataHora(ultimaLeitura), atraso === null ? "Nenhum ponto disponível" : `${fmtNumero(atraso, 1)} min antes do fim consultado`]
  ];
  alvo.innerHTML = cards.map(([titulo,valor,descricao]) => `<article class="summary-card"><h3>${titulo}</h3><strong class="quality-value">${valor}</strong><p class="quality-caption">${descricao}</p></article>`).join("");
}

function renderAnaliseContextual(h) {
  const alvo = $("#cards-contextuais");
  if (!alvo) return;
  const dados = Array.isArray(h.dados) ? h.dados : [];
  const variaveis = [
    ["Temperatura", "temperatura", "externo_temperatura", "°C"],
    ["Umidade", "umidade", "externo_umidade", "p.p."],
    ["Pressão ao nível do mar", "pressao_mar", "externo_pressao_mar", "hPa"]
  ];
  const resultado = variaveis.map(([titulo,local,externo,unidade]) => {
    const pares = dados.filter(p => Number.isFinite(p[local]) && Number.isFinite(p[externo]))
      .map(p => [p[local],p[externo]]);
    const n = pares.length;
    if (!n) return { titulo, unidade, n, media:null, r:null, motivo:"Sem pares válidos" };
    const mediaL = pares.reduce((s,p)=>s+p[0],0)/n;
    const mediaE = pares.reduce((s,p)=>s+p[1],0)/n;
    const media = mediaL-mediaE;
    let cov=0, varL=0, varE=0;
    for (const [l,e] of pares) {
      const dl=l-mediaL, de=e-mediaE;
      cov+=dl*de; varL+=dl*dl; varE+=de*de;
    }
    // Evita correlação espúria com referência externa constante ou quase constante.
    const limiarL = Math.max(1e-12,n*1e-10*Math.max(1,Math.abs(mediaL))**2);
    const limiarE = Math.max(1e-12,n*1e-10*Math.max(1,Math.abs(mediaE))**2);
    const valido = n >= 10 && varL > limiarL && varE > limiarE;
    const r = valido ? Math.max(-1,Math.min(1,cov/Math.sqrt(varL*varE))) : null;
    const motivo = n < 10 ? "Pares insuficientes" : !valido ? "Variabilidade insuficiente" : "Associação linear exploratória";
    return {titulo,unidade,n,media,r,motivo};
  });
  alvo.innerHTML = resultado.map(x => {
    const diferenca = x.media === null ? "—" : `${x.media >= 0 ? "+" : ""}${fmtNumero(x.media,2)} ${x.unidade}`;
    const correlacao = x.r === null ? "Não estimável" : fmtNumero(x.r,3);
    return `<article class="summary-card contextual-card"><h3>${x.titulo}</h3><div class="stat-line"><span>Diferença média</span><strong>${diferenca}</strong></div><div class="stat-line"><span>Correlação (r)</span><strong>${correlacao}</strong></div><div class="stat-line"><span>Pares válidos</span><strong>${x.n}</strong></div><p class="quality-caption">${x.motivo}</p></article>`;
  }).join("");
}

function renderRespostaSubdiaria(h) {
  const alvo = $("#cards-subdiaria");
  if (!alvo) return;
  const inicio = Date.parse(h.periodo?.inicio), fim = Date.parse(h.periodo?.fim);
  const passo = Number(h.intervalo_minutos) * 60000, hora = 3600000;
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || !Number.isFinite(passo) || passo <= 0 || passo > hora) {
    alvo.textContent = "Análise indisponível: selecione um período com resolução de até 1 hora.";
    return;
  }
  const primeiraHora = Math.ceil(inicio / hora), ultimaHora = Math.floor(fim / hora) - 1;
  const horas = new Map();
  for (const p of (Array.isArray(h.dados) ? h.dados : [])) {
    const ts = Date.parse(p.timestamp);
    if (!Number.isFinite(ts)) continue;
    const indice = Math.floor(ts / hora);
    if (indice < primeiraHora || indice > ultimaHora) continue;
    if (!horas.has(indice)) horas.set(indice, []);
    horas.get(indice).push(p);
  }
  const esperados = Math.round(hora / passo);
  function estatistica(pares) {
    if (pares.length < 18) return null;
    const n=pares.length, ml=pares.reduce((s,p)=>s+p[0],0)/n, me=pares.reduce((s,p)=>s+p[1],0)/n;
    let vl=0,ve=0,cov=0;
    for (const [l,e] of pares) {const dl=l-ml,de=e-me;vl+=dl*dl;ve+=de*de;cov+=dl*de;}
    if (vl/n < 1e-6 || ve/n < 1e-6) return null;
    return {r:cov/Math.sqrt(vl*ve),ratio:Math.sqrt(vl/ve),n};
  }
  const variaveis=[["Temperatura","temperatura","externo_temperatura"],["Umidade relativa","umidade","externo_umidade"]];
  alvo.innerHTML=variaveis.map(([titulo,lKey,eKey])=>{
    const medias=new Map();
    for (const [indice,pontos] of horas) {
      const validos=pontos.filter(p=>Number.isFinite(p[lKey])&&Number.isFinite(p[eKey]));
      if (validos.length < Math.ceil(esperados*0.75)) continue;
      medias.set(indice,[validos.reduce((s,p)=>s+p[lKey],0)/validos.length,validos.reduce((s,p)=>s+p[eKey],0)/validos.length]);
    }
    // Diferenças apenas entre horas consecutivas, sem preencher lacunas artificialmente.
    const mudancas=new Map();
    for (const [indice,valor] of medias) {
      const anterior=medias.get(indice-1);
      if (anterior) mudancas.set(indice,[valor[0]-anterior[0],valor[1]-anterior[1]]);
    }
    const base=estatistica([...mudancas.values()]);
    let melhor=null;
    const curva = [];
    if (base) curva.push({atraso:0,r:base.r,n:base.n});
    if (base) for(let atraso=1;atraso<=6;atraso++){
      const deslocados=[],zero=[];
      for (const [indice,local] of mudancas) {
        const externoAnterior=mudancas.get(indice-atraso);
        if (!externoAnterior) continue;
        deslocados.push([local[0],externoAnterior[1]]);
        zero.push([local[0],local[1]]);
      }
      if (deslocados.length < 18 || deslocados.length < Math.ceil(mudancas.size*0.7)) continue;
      const teste=estatistica(deslocados),controle=estatistica(zero);
      curva.push({atraso,r:teste?.r ?? null,n:teste?.n ?? deslocados.length,comparavel:!!controle && !!teste});
      if(teste&&controle&&teste.r>controle.r+0.10&&(!melhor||teste.r-controle.r>melhor.ganho))
        melhor={atraso,r:teste.r,r0:controle.r,n:teste.n,ganho:teste.r-controle.r};
    }
    const atrasoTexto=!base?"Não estimável":melhor?`${melhor.atraso} h`:"Não evidenciado";
    const razaoTexto=base?fmtNumero(base.ratio,2):"Não estimável";
    const nota=!base?"Exige pelo menos 18 mudanças horárias válidas e variabilidade suficiente.":melhor?`Correlação alinhada: ${fmtNumero(melhor.r,2)}; sem atraso nos mesmos horários: ${fmtNumero(melhor.r0,2)} (n=${melhor.n}).`:`Sem ganho suficiente para atrasos de 1–6 h; r(0)=${fmtNumero(base.r,2)}.`;
    const linhas = curva.map(p => {
      const valido = p.r !== null && (p.atraso===0 || p.comparavel);
      const r = valido ? p.r : null;
      const x = r === null ? 50 : 50 + 50 * Math.max(-1,Math.min(1,r));
      const left = Math.min(50,x), width=Math.abs(x-50);
      const destaque = melhor?.atraso===p.atraso;
      return `<div class="lag-row${destaque?" lag-row-selected":""}" role="listitem" aria-label="Atraso ${p.atraso} horas: correlação ${r===null?"indisponível":fmtNumero(r,2)}, ${p.n} pares">
        <span class="lag-hour">${p.atraso} h</span>
        <div class="lag-track" aria-hidden="true"><span class="lag-zero"></span>${r===null?"":`<span class="lag-bar" style="left:${left}%;width:${width}%"></span>`}</div>
        <strong class="lag-value">${r===null?"—":fmtNumero(r,2)}</strong><small class="lag-count">n=${p.n}</small>
      </div>`;
    }).join("");
    const grafico = base ? `<details class="lag-details"><summary>Curva de correlação cruzada (0–6 h)</summary><p class="quality-caption">Correlação de Pearson entre mudanças horárias; cada atraso utiliza pares disponíveis distintos. Compare a seleção de atraso somente com r(0) calculado nos mesmos horários, conforme a nota acima. Barras à esquerda indicam correlação negativa.</p><div class="lag-axis"><span>−1</span><span>0</span><span>+1</span></div><div class="lag-rows" role="list" aria-label="Correlação por atraso">${linhas}</div></details>` : "";
    return `<article class="summary-card contextual-card"><h3>${titulo}</h3><div class="stat-line"><span>Atraso local exploratório</span><strong>${atrasoTexto}</strong></div><div class="stat-line"><span>Razão de variabilidade horária</span><strong>${razaoTexto}</strong></div><div class="stat-line"><span>Mudanças horárias válidas</span><strong>${mudancas.size}</strong></div><p class="quality-caption">${nota}</p>${grafico}</article>`;
  }).join("");
}

function renderRespostaDinamica(h) {
  const alvo = $("#cards-dinamica");
  if (!alvo) return;
  const inicio = Date.parse(h.periodo?.inicio), fim = Date.parse(h.periodo?.fim);
  const passoMs = Number(h.intervalo_minutos) * 60000;
  const diaMs = 86400000;
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || !Number.isFinite(passoMs) || passoMs <= 0 || passoMs > diaMs) {
    alvo.textContent = "Resolução ou período indisponível para análise diária.";
    return;
  }
  const primeiroDia = Math.ceil(inicio / diaMs), ultimoDia = Math.floor(fim / diaMs) - 1;
  const dias = new Map();
  for (const p of (Array.isArray(h.dados) ? h.dados : [])) {
    const ts = Date.parse(p.timestamp);
    if (!Number.isFinite(ts)) continue;
    const d = Math.floor(ts / diaMs);
    if (d < primeiroDia || d > ultimoDia) continue;
    if (!dias.has(d)) dias.set(d, []);
    dias.get(d).push(p);
  }
  const esperadoDia = Math.round(diaMs / passoMs);
  const variaveis = [
    ["Temperatura", "temperatura", "externo_temperatura"],
    ["Umidade relativa", "umidade", "externo_umidade"]
  ];
  const estatisticas = (pares) => {
    const n = pares.length;
    if (n < 8) return null;
    const ml = pares.reduce((s,p)=>s+p[0],0)/n, me = pares.reduce((s,p)=>s+p[1],0)/n;
    let vl=0,ve=0,cov=0;
    for(const [l,e] of pares){const dl=l-ml,de=e-me;vl+=dl*dl;ve+=de*de;cov+=dl*de;}
    if(vl/n < 1e-6 || ve/n < 1e-6) return null;
    return {r:cov/Math.sqrt(vl*ve),ratio:Math.sqrt(vl/ve),n};
  };
  const cards = variaveis.map(([titulo,lKey,eKey]) => {
    const series = new Map();
    for (const [dia,pontos] of dias) {
      const validos = pontos.filter(p => Number.isFinite(p[lKey]) && Number.isFinite(p[eKey]));
      const cobertura = validos.length / esperadoDia;
      if (cobertura < 0.75) continue;
      series.set(dia,[
        validos.reduce((s,p)=>s+p[lKey],0)/validos.length,
        validos.reduce((s,p)=>s+p[eKey],0)/validos.length
      ]);
    }
    const pares = [...series.values()];
    const base = estatisticas(pares);
    let melhor = null;
    if (base && series.size >= 10) {
      for (let atraso=1;atraso<=3;atraso++) {
        const alinhados=[], comparacaoZero=[];
        for (const [dia,local] of series) {
          const anterior=series.get(dia-atraso);
          if (anterior) { alinhados.push([local[0],anterior[1]]); comparacaoZero.push([local[0],local[1]]); }
        }
        if (alinhados.length < 8 || alinhados.length < Math.ceil(series.size*0.7)) continue;
        const e=estatisticas(alinhados), zero=estatisticas(comparacaoZero);
        if (e && zero && e.r > zero.r+0.10 && (!melhor || e.r-zero.r > melhor.ganho)) melhor={...e,atraso,ganho:e.r-zero.r,rZeroComparavel:zero.r};
      }
    }
    const atrasoTexto = !base ? "Não estimável" : melhor ? `${melhor.atraso} dia(s)` : "Não evidenciada";
    const razaoTexto = base ? fmtNumero(base.ratio,2) : "Não estimável";
    const descricao = !base ? "Exige ≥8 dias completos válidos e variabilidade suficiente." : melhor ? `Correlação alinhada: ${fmtNumero(melhor.r,2)} (n=${melhor.n} dias); sem atraso nos mesmos dias: ${fmtNumero(melhor.rZeroComparavel,2)}.` : `Sem evidência de atraso de 1–3 dias pelo critério adotado; r(0)=${fmtNumero(base.r,2)}.`;
    return `<article class="summary-card contextual-card"><h3>${titulo}</h3><div class="stat-line"><span>Atraso local estimado</span><strong>${atrasoTexto}</strong></div><div class="stat-line"><span>Razão de variabilidade diária</span><strong>${razaoTexto}</strong></div><div class="stat-line"><span>Dias válidos</span><strong>${series.size}</strong></div><p class="quality-caption">${descricao}</p></article>`;
  });
  alvo.innerHTML=cards.join("");
}

function renderHistorico(h) {
  ultimoHistorico = h;
  const d = Array.isArray(h.dados) ? h.dados : [];
  const labels = d.map(p => labelTempo(p.timestamp));
  criarChart("chart-temperatura", labels, [datasetSerie("Estação", d.map(p=>p.temperatura)), datasetSerie("Open-Meteo", d.map(p=>p.externo_temperatura), "externo")]);
  criarChart("chart-umidade", labels, [datasetSerie("Estação", d.map(p=>p.umidade)), datasetSerie("Open-Meteo", d.map(p=>p.externo_umidade), "externo")]);
  criarChart("chart-pressao", labels, [datasetSerie("Estação", d.map(p=>p.pressao_mar)), datasetSerie("Open-Meteo", d.map(p=>p.externo_pressao_mar), "externo")]);
  criarChart("chart-orvalho", labels, [datasetSerie("Estação", d.map(p=>p.ponto_orvalho))]);
  criarChart("chart-delta-temperatura", labels, [datasetSerie("Δ temperatura", d.map(p=>delta(p.temperatura,p.externo_temperatura)), "delta")]);
  criarChart("chart-delta-umidade", labels, [datasetSerie("Δ umidade", d.map(p=>delta(p.umidade,p.externo_umidade)), "delta")]);
  criarChart("chart-delta-pressao", labels, [datasetSerie("Δ pressão", d.map(p=>delta(p.pressao_mar,p.externo_pressao_mar)), "delta")]);
  $("#periodo-info").textContent = `Período: ${filtroAtual.rotulo}`;
  const comparacaoPeriodo = $("#comparacao-periodo-info");
  if (comparacaoPeriodo) comparacaoPeriodo.textContent = `Comparação estatística: ${filtroAtual.rotulo}.`;
  $("#resolucao-info").textContent = `Resolução: ${h.resolucao || "—"}`;
  $("#amostras-info").textContent = `Amostras: ${h.amostras_brutas ?? "—"}`;
  aplicarVisibilidadeGlobal();
  renderQualidadeTemporal(h);
  renderAnaliseContextual(h);
  renderRespostaDinamica(h);
  renderRespostaSubdiaria(h);
}

function statLine(rotulo, valor, unidade) { return `<div class="stat-line"><span>${rotulo}</span><strong>${valor}${unidade}</strong></div>`; }
function summaryCard(titulo, bloco, unidade, amplitude=false) {
  return `<article class="summary-card"><h3>${titulo}</h3>${statLine("Mínimo",fmtNumero(bloco?.min),` ${unidade}`)}${statLine("Média",fmtNumero(bloco?.media),` ${unidade}`)}${statLine("Máximo",fmtNumero(bloco?.max),` ${unidade}`)}${amplitude?statLine("Amplitude",fmtNumero(bloco?.amplitude),` ${unidade}`):""}</article>`;
}

function renderResumo(r) {
  $("#cards-resumo").innerHTML = [summaryCard("Temperatura",r.temperatura,"°C",true),summaryCard("Umidade",r.umidade,"%"),summaryCard("Pressão mar",r.pressao_mar,"hPa",true),summaryCard("Pressão local",r.pressao_local,"hPa",true),summaryCard("Ponto de orvalho",r.ponto_orvalho,"°C")].join("");
  const ext=r.externo||{};
  const comps=[["Temperatura média",r.temperatura?.media,ext.temperatura?.media,"°C"],["Umidade média",r.umidade?.media,ext.umidade?.media,"%"],["Pressão média",r.pressao_mar?.media,ext.pressao_mar?.media,"hPa"]];
  $("#cards-comparacao").innerHTML=comps.map(([rotulo,est,ex,un])=>{ const d=delta(est,ex); const dt=d===null?"—":`${d>=0?"+":""}${fmtNumero(d)} ${un}`; return `<article class="comparison-card"><h3>${rotulo}</h3><div class="comparison-values"><div><span>Estação</span><strong>${fmtNumero(est)} ${un}</strong></div><div><span>Open-Meteo</span><strong>${fmtNumero(ex)} ${un}</strong></div><div><span>Δ</span><strong>${dt}</strong></div></div></article>`; }).join("");
}

async function carregarHistoricoEResumo() {
  const q=queryAtual();
  const [rh,rr]=await Promise.all([fetch(`/api/historico?${q}`,{cache:"no-store"}),fetch(`/api/resumo?${q}`,{cache:"no-store"})]);
  const [h,r]=await Promise.all([rh.json(),rr.json()]);
  if(!rh.ok) throw new Error(h.mensagem||`Histórico HTTP ${rh.status}`);
  if(!rr.ok) throw new Error(r.mensagem||`Resumo HTTP ${rr.status}`);
  renderHistorico(h); renderResumo(r);
}

function definirInputsPadrao() {
  const hoje=new Date(), inicio=new Date(hoje); inicio.setDate(inicio.getDate()-7);
  $("#data-inicio").value=dataInput(inicio); $("#data-fim").value=dataInput(hoje);
}

async function selecionarPeriodo(tipo) {
  $("#erro-periodo").textContent="";
  $$(".period-button").forEach(b=>b.classList.toggle("active",b.dataset.periodo===tipo));
  if(tipo==="personalizado") { $("#custom-period").classList.remove("hidden"); return; }
  $("#custom-period").classList.add("hidden");
  if(tipo==="mes") {
    const hoje=new Date();
    filtroAtual={tipo:"personalizado",inicio:dataInput(new Date(hoje.getFullYear(),hoje.getMonth(),1)),fim:dataInput(hoje),rotulo:"mês atual"};
  } else {
    const rotulos={"60min":"60 min","24h":"24 h","7d":"7 dias","30d":"30 dias"};
    filtroAtual={tipo:"periodo",valor:tipo,rotulo:rotulos[tipo]};
  }
  await carregarHistoricoEResumo();
}

function aplicarTema(tema, persistir=true) {
  document.documentElement.dataset.theme=tema;
  if(persistir) localStorage.setItem("ea-theme",tema);
  const escuro=tema==="dark";
  $("#theme-icon").textContent=escuro?"☀":"☾";
  $("#theme-text").textContent=escuro?"Claro":"Escuro";
  if(ultimoHistorico) renderHistorico(ultimoHistorico);
}

function atualizarContador() {
  const el = $("#auto-refresh-info");
  if (!el) return;
  el.textContent = atualizandoAgora ? "Atualizando..." : `Próxima atualização em ${segundosParaAtualizar} s`;
}

async function atualizarAgoraAutomaticamente() {
  if (atualizandoAgora) return;
  atualizandoAgora = true;
  atualizarContador();
  try { await carregarAgora(); segundosParaAtualizar = INTERVALO_AGORA_S; }
  catch (erro) { console.error("[auto/agora]", erro); segundosParaAtualizar = INTERVALO_AGORA_S; }
  finally { atualizandoAgora = false; atualizarContador(); }
}

async function atualizarHistoricoAutomaticamente() {
  if (atualizandoHistorico) return;
  atualizandoHistorico = true;
  try { await carregarHistoricoEResumo(); }
  catch (erro) { console.error("[auto/historico]", erro); }
  finally { atualizandoHistorico = false; }
}

function iniciarAtualizacaoAutomatica() {
  atualizarContador();
  setInterval(() => {
    if (document.hidden) return;
    segundosParaAtualizar -= 1;
    if (segundosParaAtualizar <= 0) { segundosParaAtualizar = INTERVALO_AGORA_S; atualizarAgoraAutomaticamente(); }
    else atualizarContador();
  }, 1000);
  setInterval(() => { if (!document.hidden) atualizarHistoricoAutomaticamente(); }, INTERVALO_HISTORICO_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { segundosParaAtualizar = INTERVALO_AGORA_S; atualizarAgoraAutomaticamente(); atualizarHistoricoAutomaticamente(); }
  });
}

function configurarNavegacao() {
  // Reorganiza seções existentes, preservando IDs, handlers e gráficos.
  const monitor = $("#area-monitoramento");
  const analises = $("#area-analises");
  const callout = document.querySelector(".edge-callout");
  const sections = [...document.querySelectorAll("main.container > section.section")];
  if (callout) monitor.appendChild(callout);
  for (const section of sections) {
    const isMonitoramento = section.querySelector("#cards-agora") || section.querySelector("#cards-comparacao");
    (isMonitoramento ? monitor : analises).appendChild(section);
  }
  const botoes = $$(".dashboard-tab");
  function ativar(area, atualizarUrl=true) {
    if (!["monitoramento","analises","edge"].includes(area)) area="monitoramento";
    for (const nome of ["monitoramento","analises","edge"]) {
      const ativo=nome===area;
      $("#area-"+nome).hidden=!ativo;
      const botao=botoes.find(b=>b.dataset.area===nome);
      botao.classList.toggle("active",ativo);
      botao.setAttribute("aria-selected",String(ativo));
    }
    if (atualizarUrl) history.replaceState(null,"","#"+area);
    // Chart.js precisa recalcular o tamanho após o painel voltar a ficar visível.
    if (area==="analises") requestAnimationFrame(()=>Object.values(charts).forEach(chart=>chart.resize()));
  }
  botoes.forEach(botao=>botao.addEventListener("click",()=>ativar(botao.dataset.area)));
  window.addEventListener("hashchange",()=>ativar(location.hash.slice(1),false));
  ativar(location.hash.slice(1),false);
}

$("#theme-toggle").addEventListener("click",()=>aplicarTema(document.documentElement.dataset.theme==="dark"?"light":"dark"));
$("#atualizar-agora").addEventListener("click", async () => {
  const b = $("#atualizar-agora");
  b.disabled = true; atualizandoAgora = true; atualizarContador();
  try { await carregarAgora(); segundosParaAtualizar = INTERVALO_AGORA_S; }
  finally { atualizandoAgora = false; b.disabled = false; atualizarContador(); }
});
$$(".period-button").forEach(b=>b.addEventListener("click",()=>selecionarPeriodo(b.dataset.periodo)));
$("#serie-estacao").addEventListener("change",aplicarVisibilidadeGlobal);
$("#serie-openmeteo").addEventListener("change",aplicarVisibilidadeGlobal);
$("#aplicar-periodo").addEventListener("click",async()=>{
  const inicio=$("#data-inicio").value, fim=$("#data-fim").value, erro=$("#erro-periodo"); erro.textContent="";
  if(!inicio||!fim){erro.textContent="Informe as duas datas.";return;}
  const a=new Date(`${inicio}T00:00:00`), b=new Date(`${fim}T23:59:59`);
  if(a>b){erro.textContent="A data inicial deve ser anterior à final.";return;}
  if((b-a)/86400000>365){erro.textContent="O período máximo é de 365 dias.";return;}
  filtroAtual={tipo:"personalizado",inicio,fim,rotulo:`${a.toLocaleDateString("pt-BR")} a ${b.toLocaleDateString("pt-BR")}`};
  await carregarHistoricoEResumo();
});

async function iniciar() {
  configurarNavegacao();
  configurarInfos();
  definirInputsPadrao();
  aplicarTema(document.documentElement.dataset.theme||"light",false);
  try { await Promise.all([carregarAgora(),carregarHistoricoEResumo()]); }
  catch(erro){ console.error("[dashboard]",erro); }
  iniciarAtualizacaoAutomatica();
}
iniciar();
