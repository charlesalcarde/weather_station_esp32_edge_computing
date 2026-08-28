/*
======================================================================
 ESTAÇÃO AMBIENTAL INTELIGENTE v3.4-RC1
 ESP32 + BMP180 + DHT11 + LittleFS + Open-Meteo
======================================================================

ARQUITETURA
----------------------------------------------------------------------
Firmware C++ no ESP32:
  - aquisição BMP180 + DHT11
  - médias móveis
  - regressão linear da pressão
  - ponto de orvalho
  - histerese temporal
  - estados ambientais
  - alertas
  - anomalias
  - eventos
  - NVS / Preferences
  - NTP
  - Open-Meteo
  - geocodificação
  - servidor HTTP / API JSON
  - altitude automática por coordenadas
  - correção barométrica com altitude configurável
  - Wi-Fi configurável sem recompilar
  - Access Point de recuperação
  - varredura de redes próximas
  - troca segura de credenciais
  - captive portal local
  - até 5 redes Wi-Fi conhecidas
  - seleção automática da melhor rede conhecida disponível
  - substituição da rede mais antiga não conectada ao exceder 5
  - heartbeat visual no LED GPIO 2

LittleFS:
  /index.html
  /style.css
  /app.js

INTERVALOS
----------------------------------------------------------------------
Sensores locais:       60 s
Dashboard:             10 s
Open-Meteo:            15 min

HARDWARE
----------------------------------------------------------------------
BMP180:
  SDA  -> GPIO 21
  SCL  -> GPIO 22
  VCC  -> 3V3
  GND  -> GND

DHT11:
  DATA -> GPIO 4
  VCC  -> 3V3
  GND  -> GND

IMPORTANTE
----------------------------------------------------------------------
Edite SSID e senha antes de compilar.

A pasta data/ deve ser enviada separadamente via:
Ctrl+Shift+P -> Upload LittleFS to Pico/ESP8266/ESP32
======================================================================
*/

#include <WiFi.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_BMP085.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <time.h>
#include <math.h>

// ==================================================================
// WI-FI PORTÁTIL / PROVISIONAMENTO — v3.4-RC1
// ==================================================================
//
// Até 5 redes conhecidas são armazenadas na NVS.
// Na inicialização, o ESP32 procura as redes conhecidas disponíveis
// e tenta primeiro aquela com melhor RSSI.
//
// Ao cadastrar uma sexta rede:
//   • a mais antiga que NÃO estiver conectada é substituída;
//   • a rede atualmente conectada é preservada.
//
// Se nenhuma rede conhecida estiver disponível:
//   SSID : EstacaoAmbiental-Setup
//   Senha: Estacao@2026
//   IP   : 192.168.4.1
//
// A nova credencial só entra na lista depois de uma conexão válida.
//

const char* AP_SSID = "EstacaoAmbiental-Setup";
const char* AP_PASSWORD = "Estacao@2026";

const unsigned long WIFI_BOOT_TIMEOUT = 10000UL;
const unsigned long WIFI_TEST_TIMEOUT = 20000UL;
const unsigned long WIFI_AP_GRACE = 30000UL;

#define MAX_REDES_WIFI 5

struct RedeWiFiConhecida {
  String ssid;
  String senha;
  uint32_t ordem;
};

RedeWiFiConhecida redesConhecidas[MAX_REDES_WIFI];

int totalRedesConhecidas = 0;
uint32_t sequenciaRedeWiFi = 0;

bool modoAPAtivo = false;

DNSServer dnsServer;

// Protótipo explícito porque os endpoints Wi-Fi usam esta função
// antes de sua implementação no arquivo.
void enviarJSON(JsonDocument &doc);

enum EstadoTrocaWiFi {
  WIFI_TROCA_OCIOSA,
  WIFI_TROCA_AGUARDANDO,
  WIFI_TROCA_TESTANDO,
  WIFI_TROCA_SUCESSO,
  WIFI_TROCA_FALHA
};

EstadoTrocaWiFi estadoTrocaWiFi = WIFI_TROCA_OCIOSA;

String wifiSSIDCandidato = "";
String wifiSenhaCandidata = "";
String wifiMensagem = "";

unsigned long momentoTrocaWiFi = 0;
unsigned long inicioTesteWiFi = 0;
unsigned long desligarAPEm = 0;

// ==================================================================
// HEARTBEAT — LED GPIO 2
// ==================================================================
//
// Padrão:
//   100 ms aceso
//   100 ms apagado
//   100 ms aceso
//  1000 ms apagado
//
// Implementação não bloqueante: sem delay() no loop.
//

#define LED_HEARTBEAT 2

enum EstadoHeartbeat {
  HB_PULSO_1,
  HB_INTERVALO,
  HB_PULSO_2,
  HB_REPOUSO
};

EstadoHeartbeat estadoHeartbeat = HB_PULSO_1;
unsigned long momentoHeartbeat = 0;

String nomeEstacao = "Estacao Ambiental";
String hostnameMDNS = "estacao";
bool mdnsAtivo = false;

// ==================================================================
// OBJETOS
// ==================================================================

WebServer server(80);
Preferences preferences;
Adafruit_BMP085 bmp;

#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ==================================================================
// ESTAÇÃO LOCAL
// ==================================================================

// Altitude usada para corrigir a pressão do BMP180 ao nível do mar.
float altitudeLocal = 675.0f;

// Origem da altitude: Manual, Open-Meteo Elevation API ou Open-Meteo Geocoding.
String origemAltitude = "Manual";

const unsigned long INTERVALO_LEITURA = 60000UL;
const unsigned long INTERVALO_API     = 900000UL;

// ==================================================================
// EDGE -> CLOUD (SUPABASE) — PROVA DE CONCEITO v3.4
// ==================================================================
//
// Envia uma fotografia consolidada da estação a cada 60 segundos.
// Neste primeiro teste, enviamos apenas os campos já existentes em
// public.leituras: estacao, temperatura, umidade, pressao e estado.
//
// IMPORTANTE:
// 1) Cole abaixo a sua Publishable key (sb_publishable_...).
// 2) NÃO use Secret key nem service_role.
// 3) O dashboard local e todo processamento Edge continuam normais.
//

const char* SUPABASE_REST_URL =
  "https://follrrwbzuffutvpdoee.supabase.co/rest/v1/leituras";

const char* SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_6Qt_Ukv78o2bUBvjnY_f8g_e652M9A4";

const char* CLOUD_ESTACAO_ID =
  "EA-0001";

const unsigned long INTERVALO_CLOUD =
  60000UL;

unsigned long ultimoEnvioCloud = 0;

bool cloudEstadoAnterior = false;
bool cloudJaTentou = false;
bool cloudConfigAvisado = false;

#define JANELA_15  15
#define JANELA_60  60
#define MAX_EVENTOS 10

// ==================================================================
// REFERÊNCIA EXTERNA
// ==================================================================

const char* FONTE_METEOROLOGICA = "Open-Meteo";

String nomeLocalExterno = "Campinas - SP";
String cidadeExterna = "Campinas";
String admin1Externo = "São Paulo";
String paisExterno = "Brasil";

float latitudeExterna = -22.9056f;
float longitudeExterna = -47.0608f;

// ==================================================================
// DADOS EXTERNOS
// ==================================================================

bool externoDisponivel = false;
bool externoJaRecebeuDados = false;
bool estadoAnteriorAPI = false;

float extTemperatura = 0;
float extSensacao = 0;
float extUmidade = 0;
float extPontoOrvalho = 0;
float extPressaoMar = 0;
float extPressaoSuperficie = 0;
float extPrecipitacao = 0;
float extChuva = 0;
float extProbabilidadeChuva = 0;
float extNuvens = 0;
float extVisibilidade = 0;
float extUV = 0;
float extVento = 0;
float extDirecaoVento = 0;
float extRajada = 0;

int extWeatherCode = -1;
int extIsDay = 1;

String horaAtualizacaoExterna = "--:--:--";
String horaUltimaTentativaAPI = "--:--:--";

// ==================================================================
// HISTÓRICO LOCAL
// ==================================================================

float tempBMP[JANELA_60];
float tempDHT[JANELA_60];
float umidade[JANELA_60];
float pressao[JANELA_60];

time_t tempoAmostra[JANELA_60];

float media15TempBMPHistorico[JANELA_60];
float media15TempDHTHistorico[JANELA_60];
float media15UmidadeHistorico[JANELA_60];
float media15PressaoHistorico[JANELA_60];

int indice = 0;
int totalAmostras = 0;

// ==================================================================
// VALORES ATUAIS
// ==================================================================

float tBMPAtual = 0;
float tDHTAtual = 0;
float umidadeAtual = 0;
float pressaoLocalAtual = 0;
float pressaoNivelMarAtual = 0;

float mediaTempBMP15 = 0;
float mediaTempDHT15 = 0;
float mediaUmidade15 = 0;
float mediaPressao15 = 0;
float mediaPressao60 = 0;

// ==================================================================
// EXTREMOS
// ==================================================================

float tempBMPMax = -1000;
float tempBMPMin = 1000;
float tempDHTMax = -1000;
float tempDHTMin = 1000;
float umidadeMax = -1000;
float umidadeMin = 1000;
float pressaoMax = -1000;
float pressaoMin = 10000;

String horaTempBMPMax = "--:--";
String horaTempBMPMin = "--:--";
String horaTempDHTMax = "--:--";
String horaTempDHTMin = "--:--";
String horaUmidadeMax = "--:--";
String horaUmidadeMin = "--:--";
String horaPressaoMax = "--:--";
String horaPressaoMin = "--:--";

// ==================================================================
// DERIVADOS E ESTADOS
// ==================================================================

float diferencaTemp = 0;
float pontoOrvalho = 0;
float variacaoJanela = 0;
float tendenciaPressaoHora = 0;

String estadoGeral = "ANALISANDO";
String estadoUmidade = "ANALISANDO";
String estadoConforto = "ANALISANDO";
String estadoPressao = "FORMANDO HISTORICO";
String estadoInstabilidade = "AGUARDANDO HISTORICO";
String estadoAnomalia = "NENHUMA";

// Histerese
String pendenteGeral = "";
String pendenteUmidade = "";
String pendenteConforto = "";
String pendentePressao = "";
String pendenteInstabilidade = "";
String pendenteAnomalia = "";

int contadorGeral = 0;
int contadorUmidade = 0;
int contadorConforto = 0;
int contadorPressao = 0;
int contadorInstabilidade = 0;
int contadorAnomalia = 0;

// Alertas
String alerta1 = "";
String alerta2 = "";
String alerta3 = "";
String alerta4 = "";
int numeroAlertas = 0;

// Tempo
String horaUltimaLeitura = "--:--:--";
unsigned long ultimoTempo = 0;
unsigned long ultimoTempoAPI = 0;

// ==================================================================
// EVENTOS
// ==================================================================

struct Evento {
  String data;
  String hora;
  String tipo;
  String mensagem;
};

Evento eventos[MAX_EVENTOS];

int indiceEventos = 0;
int totalEventos = 0;

String anteriorEstadoGeral = "";
String anteriorEstadoUmidade = "";
String anteriorEstadoConforto = "";
String anteriorEstadoPressao = "";
String anteriorInstabilidade = "";
String anteriorAnomalia = "";

bool estadosInicializados = false;

String dataMinMaxAtual = "";
String dataEventosAtual = "";

// ==================================================================
// HORÁRIO
// ==================================================================

String horaAtual(bool segundos = false) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return segundos ? "--:--:--" : "--:--";

  char buffer[12];
  strftime(buffer, sizeof(buffer), segundos ? "%H:%M:%S" : "%H:%M", &timeinfo);
  return String(buffer);
}

String dataAtual() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "--/--/----";

  char buffer[12];
  strftime(buffer, sizeof(buffer), "%d/%m/%Y", &timeinfo);
  return String(buffer);
}

String dataISOAtual() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "2000-01-01";

  char buffer[12];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d", &timeinfo);
  return String(buffer);
}

// ==================================================================
// EVENTOS
// ==================================================================

void registrarEvento(const String &tipo, const String &mensagem) {
  eventos[indiceEventos].data = dataISOAtual();
  eventos[indiceEventos].hora = horaAtual(true);
  eventos[indiceEventos].tipo = tipo;
  eventos[indiceEventos].mensagem = mensagem;

  indiceEventos = (indiceEventos + 1) % MAX_EVENTOS;
  if (totalEventos < MAX_EVENTOS) totalEventos++;

  Serial.print("[EVENTO] ");
  Serial.print(horaAtual(true));
  Serial.print(" | ");
  Serial.print(tipo);
  Serial.print(" | ");
  Serial.println(mensagem);
}

// ==================================================================
// HEARTBEAT VISUAL
// ==================================================================

void iniciarHeartbeat() {
  pinMode(
    LED_HEARTBEAT,
    OUTPUT
  );

  digitalWrite(
    LED_HEARTBEAT,
    HIGH
  );

  estadoHeartbeat =
    HB_PULSO_1;

  momentoHeartbeat =
    millis();
}

void processarHeartbeat() {
  unsigned long agora =
    millis();

  switch (estadoHeartbeat) {

    case HB_PULSO_1:
      if (
        agora -
        momentoHeartbeat >=
        100UL
      ) {
        digitalWrite(
          LED_HEARTBEAT,
          LOW
        );

        estadoHeartbeat =
          HB_INTERVALO;

        momentoHeartbeat =
          agora;
      }
      break;

    case HB_INTERVALO:
      if (
        agora -
        momentoHeartbeat >=
        100UL
      ) {
        digitalWrite(
          LED_HEARTBEAT,
          HIGH
        );

        estadoHeartbeat =
          HB_PULSO_2;

        momentoHeartbeat =
          agora;
      }
      break;

    case HB_PULSO_2:
      if (
        agora -
        momentoHeartbeat >=
        100UL
      ) {
        digitalWrite(
          LED_HEARTBEAT,
          LOW
        );

        estadoHeartbeat =
          HB_REPOUSO;

        momentoHeartbeat =
          agora;
      }
      break;

    case HB_REPOUSO:
      if (
        agora -
        momentoHeartbeat >=
        1000UL
      ) {
        digitalWrite(
          LED_HEARTBEAT,
          HIGH
        );

        estadoHeartbeat =
          HB_PULSO_1;

        momentoHeartbeat =
          agora;
      }
      break;
  }
}

// ==================================================================
// WI-FI — NVS E LISTA DE REDES CONHECIDAS
// ==================================================================

String chaveWiFi(
  const char* prefixo,
  int indice
) {
  return String(prefixo) +
         String(indice);
}

int indiceRedeConhecida(
  const String &ssidBusca
) {
  for (
    int i = 0;
    i < totalRedesConhecidas;
    i++
  ) {
    if (
      redesConhecidas[i].ssid ==
      ssidBusca
    ) {
      return i;
    }
  }

  return -1;
}

bool redeEstaConectada(
  const String &ssidRede
) {
  return (
    WiFi.status() ==
    WL_CONNECTED &&
    WiFi.SSID() ==
    ssidRede
  );
}

void salvarListaRedesWiFi() {
  preferences.begin(
    "estacao",
    false
  );

  preferences.putUInt(
    "wifiCount",
    totalRedesConhecidas
  );

  preferences.putUInt(
    "wifiSeq",
    sequenciaRedeWiFi
  );

  for (
    int i = 0;
    i < MAX_REDES_WIFI;
    i++
  ) {
    String kSSID =
      chaveWiFi(
        "ws",
        i
      );

    String kPass =
      chaveWiFi(
        "wp",
        i
      );

    String kOrder =
      chaveWiFi(
        "wo",
        i
      );

    if (
      i <
      totalRedesConhecidas
    ) {
      preferences.putString(
        kSSID.c_str(),
        redesConhecidas[i].ssid
      );

      preferences.putString(
        kPass.c_str(),
        redesConhecidas[i].senha
      );

      preferences.putUInt(
        kOrder.c_str(),
        redesConhecidas[i].ordem
      );
    }
    else {
      preferences.remove(
        kSSID.c_str()
      );

      preferences.remove(
        kPass.c_str()
      );

      preferences.remove(
        kOrder.c_str()
      );
    }
  }

  // Chaves antigas da v3.2 deixam de ser necessárias.
  preferences.remove(
    "wifiSSID"
  );

  preferences.remove(
    "wifiPass"
  );

  preferences.end();
}

void migrarRedeLegadaSeNecessario() {
  if (
    totalRedesConhecidas >
    0
  ) {
    return;
  }

  preferences.begin(
    "estacao",
    true
  );

  String ssidLegado =
    preferences.getString(
      "wifiSSID",
      ""
    );

  String senhaLegada =
    preferences.getString(
      "wifiPass",
      ""
    );

  preferences.end();

  if (
    ssidLegado.length() ==
    0
  ) {
    return;
  }

  sequenciaRedeWiFi++;

  redesConhecidas[0].ssid =
    ssidLegado;

  redesConhecidas[0].senha =
    senhaLegada;

  redesConhecidas[0].ordem =
    sequenciaRedeWiFi;

  totalRedesConhecidas = 1;

  salvarListaRedesWiFi();

  Serial.println(
    "Rede Wi-Fi da v3.2 migrada para a lista v3.4-RC1."
  );
}

void carregarConfiguracaoWiFi() {
  totalRedesConhecidas = 0;

  preferences.begin(
    "estacao",
    true
  );

  uint32_t quantidade =
    preferences.getUInt(
      "wifiCount",
      0
    );

  sequenciaRedeWiFi =
    preferences.getUInt(
      "wifiSeq",
      0
    );

  if (
    quantidade >
    MAX_REDES_WIFI
  ) {
    quantidade =
      MAX_REDES_WIFI;
  }

  for (
    uint32_t i = 0;
    i < quantidade;
    i++
  ) {
    String kSSID =
      chaveWiFi(
        "ws",
        i
      );

    String kPass =
      chaveWiFi(
        "wp",
        i
      );

    String kOrder =
      chaveWiFi(
        "wo",
        i
      );

    String nome =
      preferences.getString(
        kSSID.c_str(),
        ""
      );

    if (
      nome.length() ==
      0
    ) {
      continue;
    }

    redesConhecidas[
      totalRedesConhecidas
    ].ssid =
      nome;

    redesConhecidas[
      totalRedesConhecidas
    ].senha =
      preferences.getString(
        kPass.c_str(),
        ""
      );

    redesConhecidas[
      totalRedesConhecidas
    ].ordem =
      preferences.getUInt(
        kOrder.c_str(),
        0
      );

    totalRedesConhecidas++;
  }

  preferences.end();

  migrarRedeLegadaSeNecessario();
}

int indiceMaisAntigaNaoConectada() {
  int candidata = -1;
  uint32_t menorOrdem =
    0xFFFFFFFFUL;

  for (
    int i = 0;
    i < totalRedesConhecidas;
    i++
  ) {
    if (
      redeEstaConectada(
        redesConhecidas[i].ssid
      )
    ) {
      continue;
    }

    if (
      redesConhecidas[i].ordem <
      menorOrdem
    ) {
      menorOrdem =
        redesConhecidas[i].ordem;

      candidata = i;
    }
  }

  return candidata;
}

void adicionarOuAtualizarRede(
  const String &ssidNovo,
  const String &senhaNova
) {
  int existente =
    indiceRedeConhecida(
      ssidNovo
    );

  sequenciaRedeWiFi++;

  if (
    existente >= 0
  ) {
    redesConhecidas[
      existente
    ].senha =
      senhaNova;

    redesConhecidas[
      existente
    ].ordem =
      sequenciaRedeWiFi;

    salvarListaRedesWiFi();
    return;
  }

  if (
    totalRedesConhecidas <
    MAX_REDES_WIFI
  ) {
    int pos =
      totalRedesConhecidas;

    redesConhecidas[pos].ssid =
      ssidNovo;

    redesConhecidas[pos].senha =
      senhaNova;

    redesConhecidas[pos].ordem =
      sequenciaRedeWiFi;

    totalRedesConhecidas++;

    salvarListaRedesWiFi();
    return;
  }

  int substituir =
    indiceMaisAntigaNaoConectada();

  // Em condição normal sempre haverá uma candidata,
  // pois a estação só pode estar conectada a uma rede.
  if (
    substituir < 0
  ) {
    substituir = 0;
  }

  String removida =
    redesConhecidas[
      substituir
    ].ssid;

  redesConhecidas[
    substituir
  ].ssid =
    ssidNovo;

  redesConhecidas[
    substituir
  ].senha =
    senhaNova;

  redesConhecidas[
    substituir
  ].ordem =
    sequenciaRedeWiFi;

  salvarListaRedesWiFi();

  registrarEvento(
    "WIFI",
    "Rede antiga substituida: " +
    removida
  );
}

bool removerRedeConhecida(
  const String &ssidRemover
) {
  int pos =
    indiceRedeConhecida(
      ssidRemover
    );

  if (
    pos < 0
  ) {
    return false;
  }

  for (
    int i = pos;
    i <
    totalRedesConhecidas - 1;
    i++
  ) {
    redesConhecidas[i] =
      redesConhecidas[
        i + 1
      ];
  }

  totalRedesConhecidas--;

  salvarListaRedesWiFi();

  return true;
}

void apagarTodasRedesWiFi() {
  totalRedesConhecidas = 0;
  sequenciaRedeWiFi = 0;

  salvarListaRedesWiFi();
}

// ==================================================================
// WI-FI — ACCESS POINT DE RECUPERAÇÃO
// ==================================================================

void iniciarModoAP() {
  if (modoAPAtivo)
    return;

  WiFi.mode(
    WIFI_AP_STA
  );

  if (
    !WiFi.softAP(
      AP_SSID,
      AP_PASSWORD
    )
  ) {
    Serial.println(
      "ERRO: nao foi possivel iniciar o AP de configuracao."
    );
    return;
  }

  delay(100);

  dnsServer.start(
    53,
    "*",
    WiFi.softAPIP()
  );

  modoAPAtivo = true;

  Serial.println();
  Serial.println(
    "Modo de configuracao Wi-Fi ativo"
  );

  Serial.print(
    "SSID: "
  );
  Serial.println(
    AP_SSID
  );

  Serial.print(
    "IP do setup: "
  );
  Serial.println(
    WiFi.softAPIP()
  );
}

void encerrarModoAP() {
  if (!modoAPAtivo)
    return;

  dnsServer.stop();

  WiFi.softAPdisconnect(
    true
  );

  modoAPAtivo = false;

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    WiFi.mode(
      WIFI_STA
    );
  }

  Serial.println(
    "Modo AP de configuracao encerrado."
  );
}

// ==================================================================
// WI-FI — CONEXÃO AUTOMÁTICA À MELHOR REDE CONHECIDA
// ==================================================================

struct CandidatoWiFi {
  int indiceRede;
  int32_t rssi;
};

bool conectarRedePorIndice(
  int indiceRede,
  unsigned long timeoutMs
) {
  if (
    indiceRede < 0 ||
    indiceRede >=
    totalRedesConhecidas
  ) {
    return false;
  }

  Serial.print(
    "Tentando rede conhecida: "
  );

  Serial.print(
    redesConhecidas[
      indiceRede
    ].ssid
  );

  Serial.print(
    " | ordem "
  );

  Serial.println(
    redesConhecidas[
      indiceRede
    ].ordem
  );

  WiFi.mode(
    WIFI_STA
  );

  WiFi.begin(
    redesConhecidas[
      indiceRede
    ].ssid.c_str(),
    redesConhecidas[
      indiceRede
    ].senha.c_str()
  );

  unsigned long inicio =
    millis();

  while (
    WiFi.status() !=
    WL_CONNECTED &&
    millis() - inicio <
    timeoutMs
  ) {
    processarHeartbeat();
    delay(25);
  }

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    Serial.println(
      "Wi-Fi conectado"
    );

    Serial.print(
      "SSID: "
    );

    Serial.println(
      WiFi.SSID()
    );

    Serial.print(
      "IP: "
    );

    Serial.println(
      WiFi.localIP()
    );

    Serial.print(
      "RSSI: "
    );

    Serial.print(
      WiFi.RSSI()
    );

    Serial.println(
      " dBm"
    );

    return true;
  }

  WiFi.disconnect(
    false,
    false
  );

  return false;
}

bool conectarMelhorRedeConhecida() {
  if (
    totalRedesConhecidas ==
    0
  ) {
    return false;
  }

  WiFi.mode(
    WIFI_STA
  );

  int encontrados =
    WiFi.scanNetworks(
      false,
      true
    );

  CandidatoWiFi candidatos[
    MAX_REDES_WIFI
  ];

  int totalCandidatos = 0;

  for (
    int i = 0;
    i < encontrados;
    i++
  ) {
    String nome =
      WiFi.SSID(i);

    int conhecida =
      indiceRedeConhecida(
        nome
      );

    if (
      conhecida < 0
    ) {
      continue;
    }

    // Mantemos apenas o melhor RSSI para cada SSID.
    int jaExiste = -1;

    for (
      int c = 0;
      c < totalCandidatos;
      c++
    ) {
      if (
        candidatos[c].indiceRede ==
        conhecida
      ) {
        jaExiste = c;
        break;
      }
    }

    if (
      jaExiste >= 0
    ) {
      if (
        WiFi.RSSI(i) >
        candidatos[
          jaExiste
        ].rssi
      ) {
        candidatos[
          jaExiste
        ].rssi =
          WiFi.RSSI(i);
      }
    }
    else if (
      totalCandidatos <
      MAX_REDES_WIFI
    ) {
      candidatos[
        totalCandidatos
      ].indiceRede =
        conhecida;

      candidatos[
        totalCandidatos
      ].rssi =
        WiFi.RSSI(i);

      totalCandidatos++;
    }
  }

  WiFi.scanDelete();

  // Ordena do sinal mais forte para o mais fraco.
  for (
    int i = 0;
    i < totalCandidatos - 1;
    i++
  ) {
    for (
      int j = i + 1;
      j < totalCandidatos;
      j++
    ) {
      if (
        candidatos[j].rssi >
        candidatos[i].rssi
      ) {
        CandidatoWiFi temp =
          candidatos[i];

        candidatos[i] =
          candidatos[j];

        candidatos[j] =
          temp;
      }
    }
  }

  for (
    int i = 0;
    i < totalCandidatos;
    i++
  ) {
    Serial.print(
      "Rede conhecida disponivel: "
    );

    Serial.print(
      redesConhecidas[
        candidatos[i].indiceRede
      ].ssid
    );

    Serial.print(
      " | "
    );

    Serial.print(
      candidatos[i].rssi
    );

    Serial.println(
      " dBm"
    );
  }

  for (
    int i = 0;
    i < totalCandidatos;
    i++
  ) {
    if (
      conectarRedePorIndice(
        candidatos[i].indiceRede,
        WIFI_BOOT_TIMEOUT
      )
    ) {
      return true;
    }
  }

  // Fallback: se o scan não mostrou uma rede conhecida,
  // tentamos a mais recente uma vez; ajuda em alguns APs ocultos.
  if (
    totalCandidatos ==
    0
  ) {
    int maisRecente = 0;

    for (
      int i = 1;
      i < totalRedesConhecidas;
      i++
    ) {
      if (
        redesConhecidas[i].ordem >
        redesConhecidas[
          maisRecente
        ].ordem
      ) {
        maisRecente = i;
      }
    }

    return conectarRedePorIndice(
      maisRecente,
      WIFI_BOOT_TIMEOUT
    );
  }

  return false;
}

void iniciarWiFiPortatil() {
  carregarConfiguracaoWiFi();

  Serial.print(
    "Redes Wi-Fi conhecidas: "
  );

  Serial.print(
    totalRedesConhecidas
  );

  Serial.print(
    "/"
  );

  Serial.println(
    MAX_REDES_WIFI
  );

  if (
    conectarMelhorRedeConhecida()
  ) {
    return;
  }

  iniciarModoAP();
}

// ==================================================================
// WI-FI — TROCA SEGURA DE REDE
// ==================================================================

String estadoTrocaWiFiTexto() {
  switch (
    estadoTrocaWiFi
  ) {
    case WIFI_TROCA_AGUARDANDO:
      return "AGUARDANDO";

    case WIFI_TROCA_TESTANDO:
      return "TESTANDO";

    case WIFI_TROCA_SUCESSO:
      return "SUCESSO";

    case WIFI_TROCA_FALHA:
      return "FALHA";

    default:
      return "OCIOSO";
  }
}

void agendarTrocaWiFi(
  const String &ssidNovo,
  const String &senhaNova
) {
  wifiSSIDCandidato =
    ssidNovo;

  wifiSenhaCandidata =
    senhaNova;

  wifiMensagem =
    "Configuracao recebida. Teste da nova rede sera iniciado.";

  estadoTrocaWiFi =
    WIFI_TROCA_AGUARDANDO;

  momentoTrocaWiFi =
    millis() + 1500UL;
}

void processarTrocaWiFi() {
  unsigned long agora =
    millis();

  verificarViradaDoDia();

  if (
    estadoTrocaWiFi ==
    WIFI_TROCA_AGUARDANDO
  ) {
    if (
      (long)(
        agora -
        momentoTrocaWiFi
      ) < 0
    ) {
      return;
    }

    iniciarModoAP();

    Serial.print(
      "Testando nova rede Wi-Fi: "
    );

    Serial.println(
      wifiSSIDCandidato
    );

    WiFi.disconnect(
      false,
      false
    );

    delay(50);

    WiFi.mode(
      WIFI_AP_STA
    );

    WiFi.begin(
      wifiSSIDCandidato.c_str(),
      wifiSenhaCandidata.c_str()
    );

    inicioTesteWiFi =
      millis();

    wifiMensagem =
      "Testando conexao com a nova rede...";

    estadoTrocaWiFi =
      WIFI_TROCA_TESTANDO;

    return;
  }

  if (
    estadoTrocaWiFi ==
    WIFI_TROCA_TESTANDO
  ) {
    if (
      WiFi.status() ==
      WL_CONNECTED
    ) {
      adicionarOuAtualizarRede(
        wifiSSIDCandidato,
        wifiSenhaCandidata
      );

      wifiMensagem =
        "Nova rede validada e adicionada as redes conhecidas.";

      estadoTrocaWiFi =
        WIFI_TROCA_SUCESSO;

      desligarAPEm =
        millis() +
        WIFI_AP_GRACE;

      registrarEvento(
        "WIFI",
        "Rede validada: " +
        wifiSSIDCandidato
      );

      Serial.println(
        "Nova rede Wi-Fi validada e salva."
      );

      Serial.print(
        "Novo IP: "
      );

      Serial.println(
        WiFi.localIP()
      );

      configTime(
        -3 * 3600,
        0,
        "pool.ntp.org",
        "time.nist.gov"
      );

      ultimoTempoAPI =
        millis() -
        INTERVALO_API;

      return;
    }

    if (
      millis() -
      inicioTesteWiFi >=
      WIFI_TEST_TIMEOUT
    ) {
      wifiMensagem =
        "Falha na nova rede. Lista de redes conhecidas nao foi alterada.";

      estadoTrocaWiFi =
        WIFI_TROCA_FALHA;

      registrarEvento(
        "WIFI",
        "Falha ao validar nova rede"
      );

      WiFi.disconnect(
        false,
        false
      );

      delay(50);

      // Tenta recuperar automaticamente a melhor rede já conhecida.
      if (
        !conectarMelhorRedeConhecida()
      ) {
        iniciarModoAP();
      }

      return;
    }
  }

  if (
    estadoTrocaWiFi ==
    WIFI_TROCA_SUCESSO &&
    modoAPAtivo &&
    desligarAPEm > 0 &&
    (long)(
      agora -
      desligarAPEm
    ) >= 0
  ) {
    encerrarModoAP();
    desligarAPEm = 0;
  }
}

// ==================================================================
// ENDPOINTS WI-FI
// ==================================================================

void enviarStatusWiFi() {
  JsonDocument doc;

  bool conectado =
    WiFi.status() ==
    WL_CONNECTED;

  doc["conectado"] =
    conectado;

  doc["ssidAtual"] =
    conectado
    ? WiFi.SSID()
    : "";

  doc["rssi"] =
    conectado
    ? WiFi.RSSI()
    : 0;

  doc["ip"] =
    conectado
    ? WiFi.localIP().toString()
    : "";

  doc["apAtivo"] =
    modoAPAtivo;

  doc["apSSID"] =
    AP_SSID;

  doc["apIP"] =
    modoAPAtivo
    ? WiFi.softAPIP().toString()
    : "";

  doc["trocaEstado"] =
    estadoTrocaWiFiTexto();

  doc["trocaMensagem"] =
    wifiMensagem;

  doc["totalConhecidas"] =
    totalRedesConhecidas;

  doc["maxConhecidas"] =
    MAX_REDES_WIFI;

  JsonArray conhecidas =
    doc["conhecidas"].to<JsonArray>();

  for (
    int i = 0;
    i < totalRedesConhecidas;
    i++
  ) {
    JsonObject item =
      conhecidas.add<JsonObject>();

    item["ssid"] =
      redesConhecidas[i].ssid;

    item["ordem"] =
      redesConhecidas[i].ordem;

    item["conectada"] =
      redeEstaConectada(
        redesConhecidas[i].ssid
      );
  }

  enviarJSON(doc);
}

void escanearRedesWiFi() {
  int encontrados =
    WiFi.scanNetworks(
      false,
      true
    );

  JsonDocument doc;

  JsonArray redes =
    doc["redes"].to<JsonArray>();

  for (
    int i = 0;
    i < encontrados;
    i++
  ) {
    String nome =
      WiFi.SSID(i);

    if (
      nome.length() ==
      0
    ) {
      continue;
    }

    bool duplicada =
      false;

    for (
      JsonObject existente :
      redes
    ) {
      if (
        String(
          existente["ssid"] |
          ""
        ) ==
        nome
      ) {
        duplicada =
          true;

        break;
      }
    }

    if (duplicada)
      continue;

    JsonObject rede =
      redes.add<JsonObject>();

    rede["ssid"] =
      nome;

    rede["rssi"] =
      WiFi.RSSI(i);

    rede["aberta"] =
      WiFi.encryptionType(i) ==
      WIFI_AUTH_OPEN;

    rede["conhecida"] =
      indiceRedeConhecida(
        nome
      ) >= 0;

    rede["conectada"] =
      redeEstaConectada(
        nome
      );
  }

  WiFi.scanDelete();

  enviarJSON(doc);
}

void receberConfiguracaoWiFi() {
  if (
    !server.hasArg(
      "plain"
    )
  ) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"Corpo JSON ausente\"}"
    );

    return;
  }

  JsonDocument entrada;

  if (
    deserializeJson(
      entrada,
      server.arg("plain")
    )
  ) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"JSON invalido\"}"
    );

    return;
  }

  String ssidNovo =
    entrada["ssid"] |
    "";

  String senhaNova =
    entrada["senha"] |
    "";

  ssidNovo.trim();

  if (
    ssidNovo.length() ==
    0
  ) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"SSID nao informado\"}"
    );

    return;
  }

  agendarTrocaWiFi(
    ssidNovo,
    senhaNova
  );

  JsonDocument resposta;

  resposta["aceito"] =
    true;

  resposta["mensagem"] =
    "Configuracao recebida. A rede sera testada antes de entrar na lista.";

  resposta["apSSID"] =
    AP_SSID;

  resposta["apIP"] =
    WiFi.softAPIP().toString();

  enviarJSON(
    resposta
  );
}

void removerRedeWiFiEndpoint() {
  if (
    !server.hasArg(
      "plain"
    )
  ) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"Corpo JSON ausente\"}"
    );

    return;
  }

  JsonDocument entrada;

  if (
    deserializeJson(
      entrada,
      server.arg("plain")
    )
  ) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"JSON invalido\"}"
    );

    return;
  }

  String ssidRemover =
    entrada["ssid"] |
    "";

  if (
    indiceRedeConhecida(
      ssidRemover
    ) < 0
  ) {
    server.send(
      404,
      "application/json",
      "{\"erro\":\"Rede nao encontrada\"}"
    );

    return;
  }

  // Proteção contra remoção acidental da última rede.
  // Para apagar todas, existe o botão específico de recuperação.
  if (
    totalRedesConhecidas ==
    1
  ) {
    server.send(
      409,
      "application/json",
      "{\"erro\":\"Esta e a ultima rede conhecida. Use 'Esquecer todas as redes' para entrar no modo de recuperacao.\"}"
    );

    return;
  }

  bool eraAtual =
    redeEstaConectada(
      ssidRemover
    );

  removerRedeConhecida(
    ssidRemover
  );

  registrarEvento(
    "WIFI",
    "Rede removida: " +
    ssidRemover
  );

  JsonDocument doc;

  doc["ok"] =
    true;

  doc["eraAtual"] =
    eraAtual;

  doc["mensagem"] =
    eraAtual
    ? "Rede removida da lista. A conexao atual permanece ate uma troca ou reinicio."
    : "Rede removida da lista.";

  enviarJSON(doc);
}

void esquecerTodasRedesWiFi() {
  apagarTodasRedesWiFi();

  WiFi.disconnect(
    true,
    true
  );

  iniciarModoAP();

  wifiMensagem =
    "Todas as redes conhecidas foram removidas. Configure uma nova rede.";

  estadoTrocaWiFi =
    WIFI_TROCA_OCIOSA;

  registrarEvento(
    "WIFI",
    "Todas as redes Wi-Fi removidas"
  );

  JsonDocument doc;

  doc["ok"] =
    true;

  doc["apSSID"] =
    AP_SSID;

  doc["apIP"] =
    WiFi.softAPIP().toString();

  enviarJSON(
    doc
  );
}

// ==================================================================
// NVS
// ==================================================================

void carregarConfiguracaoLocal() {
  preferences.begin("estacao", true);

  cidadeExterna = preferences.getString("cidade", "Campinas");
  admin1Externo = preferences.getString("admin1", "São Paulo");
  paisExterno = preferences.getString("pais", "Brasil");
  nomeLocalExterno = preferences.getString("nomeLocal", "Campinas - SP");
  latitudeExterna = preferences.getFloat("latitude", -22.9056f);
  longitudeExterna = preferences.getFloat("longitude", -47.0608f);

  altitudeLocal = preferences.getFloat("altitude", 675.0f);
  origemAltitude = preferences.getString("altOrigem", "Manual");
  nomeEstacao = preferences.getString("nomeEst", "Estacao Ambiental");
  hostnameMDNS = preferences.getString("mdnsHost", "estacao");

  preferences.end();
}

void salvarConfiguracaoLocal() {
  preferences.begin("estacao", false);

  preferences.putString("cidade", cidadeExterna);
  preferences.putString("admin1", admin1Externo);
  preferences.putString("pais", paisExterno);
  preferences.putString("nomeLocal", nomeLocalExterno);
  preferences.putFloat("latitude", latitudeExterna);
  preferences.putFloat("longitude", longitudeExterna);

  preferences.putFloat("altitude", altitudeLocal);
  preferences.putString("altOrigem", origemAltitude);
  preferences.putString("nomeEst", nomeEstacao);
  preferences.putString("mdnsHost", hostnameMDNS);

  preferences.end();
}

// ==================================================================
// UTILITÁRIOS
// ==================================================================

String urlEncode(const String &texto) {
  String resultado;
  const char hex[] = "0123456789ABCDEF";

  for (size_t i = 0; i < texto.length(); i++) {
    unsigned char c = texto.charAt(i);

    if (
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c == '-' || c == '_' || c == '.' || c == '~'
    ) {
      resultado += (char)c;
    } else {
      resultado += '%';
      resultado += hex[c >> 4];
      resultado += hex[c & 15];
    }
  }

  return resultado;
}

String direcaoCardeal(float graus) {
  const char* direcoes[] = {
    "N","NNE","NE","ENE",
    "E","ESE","SE","SSE",
    "S","SSO","SO","OSO",
    "O","ONO","NO","NNO"
  };

  int pos = (int)((graus + 11.25f) / 22.5f) % 16;
  return String(direcoes[pos]);
}

int posicaoCronologica(int i) {
  int inicio = totalAmostras < JANELA_60 ? 0 : indice;
  return (inicio + i) % JANELA_60;
}

float calcularMedia(float vetor[], int quantidade) {
  if (totalAmostras == 0) return 0;

  int n = min(totalAmostras, quantidade);
  float soma = 0;

  for (int i = 0; i < n; i++) {
    int pos = indice - 1 - i;
    if (pos < 0) pos += JANELA_60;
    soma += vetor[pos];
  }

  return soma / n;
}

float calcularPontoOrvalho(float temperatura, float umidadeRelativa) {
  if (umidadeRelativa <= 0) return temperatura;

  const float a = 17.62f;
  const float b = 243.12f;

  float gamma =
    log(umidadeRelativa / 100.0f)
    +
    (a * temperatura) / (b + temperatura);

  return (b * gamma) / (a - gamma);
}

float calcularTendenciaPressao() {
  int n = totalAmostras;
  if (n < 5) return 0;

  int primeiro = posicaoCronologica(0);
  time_t tempoInicial = tempoAmostra[primeiro];

  double sx = 0, sy = 0, sxy = 0, sx2 = 0;

  for (int i = 0; i < n; i++) {
    int pos = posicaoCronologica(i);
    double x = difftime(tempoAmostra[pos], tempoInicial) / 3600.0;
    double y = pressao[pos];

    sx += x;
    sy += y;
    sxy += x * y;
    sx2 += x * x;
  }

  double den = n * sx2 - sx * sx;
  if (fabs(den) < 0.000001) return 0;

  return (float)((n * sxy - sx * sy) / den);
}

// ==================================================================
// HISTERESE
// ==================================================================

bool aplicarHisterese(
  const String &candidato,
  String &atual,
  String &pendente,
  int &contador,
  int necessario
) {
  if (atual == "ANALISANDO") {
    atual = candidato;
    pendente = "";
    contador = 0;
    return true;
  }

  if (candidato == atual) {
    pendente = "";
    contador = 0;
    return false;
  }

  if (candidato != pendente) {
    pendente = candidato;
    contador = 1;
    return false;
  }

  contador++;

  if (contador >= necessario) {
    atual = candidato;
    pendente = "";
    contador = 0;
    return true;
  }

  return false;
}

// ==================================================================
// ALERTAS / ESTADOS
// ==================================================================

void adicionarAlerta(const String &texto) {
  numeroAlertas++;

  if (numeroAlertas == 1) alerta1 = texto;
  else if (numeroAlertas == 2) alerta2 = texto;
  else if (numeroAlertas == 3) alerta3 = texto;
  else if (numeroAlertas == 4) alerta4 = texto;
}

void analisarEstadoAmbiental(bool saltoAnomalo) {
  String cUmidade;

  if (umidadeAtual < 30) cUmidade = "AR MUITO SECO";
  else if (umidadeAtual < 40) cUmidade = "AR SECO";
  else if (umidadeAtual <= 70) cUmidade = "FAIXA MODERADA";
  else if (umidadeAtual <= 80) cUmidade = "UMIDADE ELEVADA";
  else cUmidade = "UMIDADE MUITO ALTA";

  aplicarHisterese(
    cUmidade,
    estadoUmidade,
    pendenteUmidade,
    contadorUmidade,
    3
  );

  String cConforto;

  if (tDHTAtual < 18) cConforto = "FRIO";
  else if (
    tDHTAtual >= 20 &&
    tDHTAtual <= 26 &&
    umidadeAtual >= 40 &&
    umidadeAtual <= 60
  ) cConforto = "CONFORTAVEL";
  else if (
    tDHTAtual >= 18 &&
    tDHTAtual <= 28 &&
    umidadeAtual >= 30 &&
    umidadeAtual <= 70
  ) cConforto = "ACEITAVEL";
  else if (tDHTAtual > 28) cConforto = "QUENTE";
  else cConforto = "FORA DA FAIXA IDEAL";

  aplicarHisterese(
    cConforto,
    estadoConforto,
    pendenteConforto,
    contadorConforto,
    3
  );

  String cPressao;

  if (totalAmostras < 15) cPressao = "FORMANDO HISTORICO";
  else if (tendenciaPressaoHora > 0.5f) cPressao = "SUBINDO";
  else if (tendenciaPressaoHora < -0.5f) cPressao = "EM QUEDA";
  else cPressao = "ESTAVEL";

  aplicarHisterese(
    cPressao,
    estadoPressao,
    pendentePressao,
    contadorPressao,
    3
  );

  String cInstabilidade;

  if (totalAmostras < 15) {
    cInstabilidade = "AGUARDANDO HISTORICO";
  } else {
    int pontos = 0;

    if (tendenciaPressaoHora < -0.5f) pontos++;
    if (tendenciaPressaoHora < -1.0f) pontos++;
    if (umidadeAtual - mediaUmidade15 > 3.0f) pontos++;
    if (tDHTAtual - mediaTempDHT15 < -0.5f) pontos++;
    if (umidadeAtual > 70) pontos++;

    if (pontos >= 3) cInstabilidade = "ELEVADA";
    else if (pontos >= 2) cInstabilidade = "MODERADA";
    else cInstabilidade = "BAIXA";
  }

  aplicarHisterese(
    cInstabilidade,
    estadoInstabilidade,
    pendenteInstabilidade,
    contadorInstabilidade,
    3
  );

  bool anomalia = saltoAnomalo;

  if (totalAmostras >= 5) {
    if (fabs(tBMPAtual - mediaTempBMP15) > 2.5f) anomalia = true;
    if (fabs(tDHTAtual - mediaTempDHT15) > 2.5f) anomalia = true;
    if (fabs(umidadeAtual - mediaUmidade15) > 12.0f) anomalia = true;
    if (fabs(pressaoNivelMarAtual - mediaPressao15) > 2.0f) anomalia = true;
  }

  if (fabs(diferencaTemp) > 3.0f) anomalia = true;

  aplicarHisterese(
    anomalia ? "DETECTADA" : "NENHUMA",
    estadoAnomalia,
    pendenteAnomalia,
    contadorAnomalia,
    2
  );

  numeroAlertas = 0;
  alerta1 = alerta2 = alerta3 = alerta4 = "";

  if (estadoUmidade == "AR MUITO SECO")
    adicionarAlerta("Umidade muito baixa");

  if (estadoUmidade == "UMIDADE MUITO ALTA")
    adicionarAlerta("Umidade muito elevada");

  if (estadoPressao == "EM QUEDA")
    adicionarAlerta("Pressao atmosferica em queda");

  if (estadoInstabilidade == "ELEVADA")
    adicionarAlerta("Possivel aumento de instabilidade");

  if (estadoAnomalia == "DETECTADA")
    adicionarAlerta("Comportamento anomalo detectado");

  String cGeral;

  if (
    estadoAnomalia == "DETECTADA" ||
    estadoInstabilidade == "ELEVADA"
  ) cGeral = "ALERTA";
  else if (
    numeroAlertas > 0 ||
    estadoInstabilidade == "MODERADA"
  ) cGeral = "ATENCAO";
  else cGeral = "ESTAVEL";

  aplicarHisterese(
    cGeral,
    estadoGeral,
    pendenteGeral,
    contadorGeral,
    2
  );
}

void registrarMudancasEstado() {
  if (!estadosInicializados) {
    anteriorEstadoGeral = estadoGeral;
    anteriorEstadoUmidade = estadoUmidade;
    anteriorEstadoConforto = estadoConforto;
    anteriorEstadoPressao = estadoPressao;
    anteriorInstabilidade = estadoInstabilidade;
    anteriorAnomalia = estadoAnomalia;
    estadosInicializados = true;
    return;
  }

  if (estadoGeral != anteriorEstadoGeral) {
    registrarEvento(
      "ESTADO",
      "Condicao geral: " +
      anteriorEstadoGeral +
      " -> " +
      estadoGeral
    );
    anteriorEstadoGeral = estadoGeral;
  }

  if (estadoUmidade != anteriorEstadoUmidade) {
    registrarEvento(
      "UMIDADE",
      "Umidade passou para " +
      estadoUmidade
    );
    anteriorEstadoUmidade = estadoUmidade;
  }

  if (estadoConforto != anteriorEstadoConforto) {
    registrarEvento(
      "CONFORTO",
      "Conforto passou para " +
      estadoConforto
    );
    anteriorEstadoConforto = estadoConforto;
  }

  if (estadoPressao != anteriorEstadoPressao) {
    registrarEvento(
      "PRESSAO",
      "Tendencia passou para " +
      estadoPressao
    );
    anteriorEstadoPressao = estadoPressao;
  }

  if (estadoInstabilidade != anteriorInstabilidade) {
    registrarEvento(
      "ATMOSFERA",
      "Instabilidade passou para " +
      estadoInstabilidade
    );
    anteriorInstabilidade = estadoInstabilidade;
  }

  if (estadoAnomalia != anteriorAnomalia) {
    registrarEvento(
      "ANOMALIA",
      estadoAnomalia == "DETECTADA"
      ? "Anomalia detectada"
      : "Anomalia encerrada"
    );
    anteriorAnomalia = estadoAnomalia;
  }
}

// ==================================================================
// AQUISIÇÃO
// ==================================================================

bool adquirirDados() {
  bool possuiAnterior = totalAmostras > 0;

  float anteriorBMP = 0;
  float anteriorDHT = 0;
  float anteriorUmidade = 0;
  float anteriorPressao = 0;

  if (possuiAnterior) {
    int p = indice - 1;
    if (p < 0) p += JANELA_60;

    anteriorBMP = tempBMP[p];
    anteriorDHT = tempDHT[p];
    anteriorUmidade = umidade[p];
    anteriorPressao = pressao[p];
  }

  float antigoTempBMPMin = tempBMPMin;
  float antigoTempBMPMax = tempBMPMax;
  float antigoTempDHTMin = tempDHTMin;
  float antigoTempDHTMax = tempDHTMax;
  float antigaUmidadeMin = umidadeMin;
  float antigaUmidadeMax = umidadeMax;
  float antigaPressaoMin = pressaoMin;
  float antigaPressaoMax = pressaoMax;

  float novaTempBMP = bmp.readTemperature();
  float novaTempDHT = dht.readTemperature();
  float novaUmidade = dht.readHumidity();
  float novaPressaoLocal = bmp.readPressure() / 100.0f;
  float novaPressaoMar =
    bmp.readSealevelPressure(altitudeLocal) /
    100.0f;

  if (isnan(novaTempDHT) || isnan(novaUmidade)) {
    registrarEvento(
      "SENSOR",
      "Falha de leitura do DHT11"
    );
    return false;
  }

  tBMPAtual = novaTempBMP;
  tDHTAtual = novaTempDHT;
  umidadeAtual = novaUmidade;
  pressaoLocalAtual = novaPressaoLocal;
  pressaoNivelMarAtual = novaPressaoMar;
  horaUltimaLeitura = horaAtual(true);

  String hora = horaAtual(false);
  int posicaoAtual = indice;

  tempBMP[posicaoAtual] = tBMPAtual;
  tempDHT[posicaoAtual] = tDHTAtual;
  umidade[posicaoAtual] = umidadeAtual;
  pressao[posicaoAtual] = pressaoNivelMarAtual;
  tempoAmostra[posicaoAtual] = time(nullptr);

  indice = (indice + 1) % JANELA_60;
  if (totalAmostras < JANELA_60) totalAmostras++;

  mediaTempBMP15 = calcularMedia(tempBMP, JANELA_15);

  mediaTempDHT15 = calcularMedia(tempDHT, JANELA_15);

  mediaUmidade15 = calcularMedia(umidade, JANELA_15);

  mediaPressao15 = calcularMedia(pressao, JANELA_15);
  mediaPressao60 = calcularMedia(pressao, JANELA_60);

  media15TempBMPHistorico[posicaoAtual] = mediaTempBMP15;
  media15TempDHTHistorico[posicaoAtual] = mediaTempDHT15;
  media15UmidadeHistorico[posicaoAtual] = mediaUmidade15;
  media15PressaoHistorico[posicaoAtual] = mediaPressao15;

  if (tBMPAtual > tempBMPMax) {
    tempBMPMax = tBMPAtual;
    horaTempBMPMax = hora;
  }

  if (tBMPAtual < tempBMPMin) {
    tempBMPMin = tBMPAtual;
    horaTempBMPMin = hora;
  }

  if (tDHTAtual > tempDHTMax) {
    tempDHTMax = tDHTAtual;
    horaTempDHTMax = hora;
  }

  if (tDHTAtual < tempDHTMin) {
    tempDHTMin = tDHTAtual;
    horaTempDHTMin = hora;
  }

  if (umidadeAtual > umidadeMax) {
    umidadeMax = umidadeAtual;
    horaUmidadeMax = hora;
  }

  if (umidadeAtual < umidadeMin) {
    umidadeMin = umidadeAtual;
    horaUmidadeMin = hora;
  }

  if (pressaoNivelMarAtual > pressaoMax) {
    pressaoMax = pressaoNivelMarAtual;
    horaPressaoMax = hora;
  }

  if (pressaoNivelMarAtual < pressaoMin) {
    pressaoMin = pressaoNivelMarAtual;
    horaPressaoMin = hora;
  }

  if (
    possuiAnterior &&
    tempBMPMin < antigoTempBMPMin - 0.3f
  ) {
    registrarEvento(
      "TEMPERATURA",
      "Nova minima BMP180: " +
      String(tempBMPMin, 1) +
      " C"
    );
  }

  if (
    possuiAnterior &&
    tempBMPMax > antigoTempBMPMax + 0.3f
  ) {
    registrarEvento(
      "TEMPERATURA",
      "Nova maxima BMP180: " +
      String(tempBMPMax, 1) +
      " C"
    );
  }

  if (
    possuiAnterior &&
    tempDHTMin < antigoTempDHTMin - 0.3f
  ) {
    registrarEvento(
      "TEMPERATURA",
      "Nova minima DHT11: " +
      String(tempDHTMin, 1) +
      " C"
    );
  }

  if (
    possuiAnterior &&
    tempDHTMax > antigoTempDHTMax + 0.3f
  ) {
    registrarEvento(
      "TEMPERATURA",
      "Nova maxima DHT11: " +
      String(tempDHTMax, 1) +
      " C"
    );
  }

  if (
    possuiAnterior &&
    umidadeMin < antigaUmidadeMin - 2.0f
  ) {
    registrarEvento(
      "UMIDADE",
      "Nova minima: " +
      String(umidadeMin, 0) +
      " %"
    );
  }

  if (
    possuiAnterior &&
    umidadeMax > antigaUmidadeMax + 2.0f
  ) {
    registrarEvento(
      "UMIDADE",
      "Nova maxima: " +
      String(umidadeMax, 0) +
      " %"
    );
  }

  if (
    possuiAnterior &&
    pressaoMin < antigaPressaoMin - 0.5f
  ) {
    registrarEvento(
      "PRESSAO",
      "Nova minima: " +
      String(pressaoMin, 1) +
      " hPa"
    );
  }

  if (
    possuiAnterior &&
    pressaoMax > antigaPressaoMax + 0.5f
  ) {
    registrarEvento(
      "PRESSAO",
      "Nova maxima: " +
      String(pressaoMax, 1) +
      " hPa"
    );
  }

  diferencaTemp = tBMPAtual - tDHTAtual;

  pontoOrvalho =
    calcularPontoOrvalho(
      tDHTAtual,
      umidadeAtual
    );

  if (totalAmostras >= 2) {
    int maisAntigo = posicaoCronologica(0);
    variacaoJanela =
      pressaoNivelMarAtual -
      pressao[maisAntigo];
  } else {
    variacaoJanela = 0;
  }

  tendenciaPressaoHora =
    calcularTendenciaPressao();

  bool saltoAnomalo = false;

  if (possuiAnterior) {
    if (fabs(tBMPAtual - anteriorBMP) > 3.0f) saltoAnomalo = true;
    if (fabs(tDHTAtual - anteriorDHT) > 3.0f) saltoAnomalo = true;
    if (fabs(umidadeAtual - anteriorUmidade) > 20.0f) saltoAnomalo = true;
    if (fabs(pressaoNivelMarAtual - anteriorPressao) > 2.0f) saltoAnomalo = true;
  }

  analisarEstadoAmbiental(saltoAnomalo);
  registrarMudancasEstado();

  return true;
}

// ==================================================================
// METEOROLOGIA EXTERNA
// ==================================================================

bool atualizarMeteorologiaExterna() {
  horaUltimaTentativaAPI = horaAtual(true);

  if (WiFi.status() != WL_CONNECTED) {
    externoDisponivel = false;
    return false;
  }

  String url =
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=" + String(latitudeExterna, 5) +
    "&longitude=" + String(longitudeExterna, 5) +
    "&current="
    "temperature_2m,"
    "relative_humidity_2m,"
    "apparent_temperature,"
    "dew_point_2m,"
    "pressure_msl,"
    "surface_pressure,"
    "precipitation,"
    "rain,"
    "precipitation_probability,"
    "weather_code,"
    "cloud_cover,"
    "visibility,"
    "uv_index,"
    "wind_speed_10m,"
    "wind_direction_10m,"
    "wind_gusts_10m,"
    "is_day"
    "&elevation=" + String(altitudeLocal, 1) +
    "&timezone=auto"
    "&forecast_days=1";

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  Serial.print("[API] Consultando ");
  Serial.println(nomeLocalExterno);

  if (!http.begin(client, url)) {
    externoDisponivel = false;
    return false;
  }

  http.setTimeout(12000);

  int code = http.GET();

  if (code != HTTP_CODE_OK) {
    Serial.print("[API] HTTP ");
    Serial.println(code);

    http.end();
    externoDisponivel = false;

    if (estadoAnteriorAPI) {
      registrarEvento(
        "API",
        "Fonte meteorologica externa indisponivel"
      );
    }

    estadoAnteriorAPI = false;
    return false;
  }

  String payload = http.getString();
  http.end();

  JsonDocument doc;
  DeserializationError erro =
    deserializeJson(doc, payload);

  if (erro) {
    Serial.print("[API] JSON: ");
    Serial.println(erro.c_str());
    externoDisponivel = false;
    return false;
  }

  JsonObject atual = doc["current"];

  if (atual.isNull()) {
    externoDisponivel = false;
    return false;
  }

  extTemperatura = atual["temperature_2m"] | 0.0f;
  extUmidade = atual["relative_humidity_2m"] | 0.0f;
  extSensacao = atual["apparent_temperature"] | 0.0f;

  extPontoOrvalho =
    atual["dew_point_2m"] |
    calcularPontoOrvalho(
      extTemperatura,
      extUmidade
    );

  extPressaoMar = atual["pressure_msl"] | 0.0f;
  extPressaoSuperficie = atual["surface_pressure"] | 0.0f;
  extPrecipitacao = atual["precipitation"] | 0.0f;
  extChuva = atual["rain"] | 0.0f;
  extProbabilidadeChuva = atual["precipitation_probability"] | 0.0f;
  extWeatherCode = atual["weather_code"] | -1;
  extNuvens = atual["cloud_cover"] | 0.0f;
  extVisibilidade = atual["visibility"] | 0.0f;
  extUV = atual["uv_index"] | 0.0f;
  extVento = atual["wind_speed_10m"] | 0.0f;
  extDirecaoVento = atual["wind_direction_10m"] | 0.0f;
  extRajada = atual["wind_gusts_10m"] | 0.0f;
  extIsDay = atual["is_day"] | 1;

  externoDisponivel = true;
  externoJaRecebeuDados = true;
  horaAtualizacaoExterna = horaAtual(true);

  if (!estadoAnteriorAPI) {
    registrarEvento(
      "API",
      "Fonte meteorologica externa conectada"
    );
  }

  estadoAnteriorAPI = true;

  Serial.println("[API] Atualizacao OK");
  return true;
}

// ==================================================================
// EDGE -> CLOUD — SUPABASE
// ==================================================================

bool chaveCloudConfigurada() {
  String chave =
    String(SUPABASE_PUBLISHABLE_KEY);

  return (
    chave.startsWith("sb_publishable_") &&
    chave.length() > 20
  );
}

bool enviarLeituraCloud() {
  if (
    WiFi.status() !=
    WL_CONNECTED
  ) {
    Serial.println(
      "[CLOUD] Sem Wi-Fi; envio adiado."
    );

    return false;
  }

  if (!chaveCloudConfigurada()) {
    Serial.println(
      "[CLOUD] Publishable key ainda nao configurada."
    );

    if (!cloudConfigAvisado) {
      registrarEvento(
        "CLOUD",
        "Supabase nao configurado"
      );

      cloudConfigAvisado = true;
    }

    return false;
  }

  cloudConfigAvisado = false;

  JsonDocument doc;

  // ----------------------------------------------------------
  // IDENTIFICAÇÃO
  // ----------------------------------------------------------

  doc["estacao"] =
    CLOUD_ESTACAO_ID;

  doc["nome_estacao"] =
    nomeEstacao;

  doc["hostname_local"] =
    hostnameMDNS;

  // ----------------------------------------------------------
  // TEMPO LOCAL DA ESTAÇÃO
  // created_at continua sendo preenchido automaticamente
  // pelo Supabase em UTC.
  // ----------------------------------------------------------

  doc["data_local"] =
    dataISOAtual();

  doc["hora_local"] =
    horaAtual(true);

  doc["epoch"] =
    (uint32_t)time(nullptr);

  if (
    horaUltimaLeitura !=
    "--:--:--"
  ) {
    doc["ultima_leitura"] =
      horaUltimaLeitura;
  }

  // ----------------------------------------------------------
  // TEMPERATURA OFICIAL — BMP180
  // A temperatura DHT11 permanece disponível apenas localmente.
  // ----------------------------------------------------------

  doc["temperatura"] =
    tBMPAtual;

  doc["temperatura_media15"] =
    mediaTempBMP15;

  doc["temperatura_min_dia"] =
    tempBMPMin;

  doc["hora_temperatura_min"] =
    horaTempBMPMin;

  doc["temperatura_max_dia"] =
    tempBMPMax;

  doc["hora_temperatura_max"] =
    horaTempBMPMax;

  // ----------------------------------------------------------
  // UMIDADE — DHT11
  // ----------------------------------------------------------

  doc["umidade"] =
    umidadeAtual;

  doc["umidade_media15"] =
    mediaUmidade15;

  doc["umidade_min_dia"] =
    umidadeMin;

  doc["hora_umidade_min"] =
    horaUmidadeMin;

  doc["umidade_max_dia"] =
    umidadeMax;

  doc["hora_umidade_max"] =
    horaUmidadeMax;

  // ----------------------------------------------------------
  // PRESSÃO
  // Mantemos "pressao" temporariamente para compatibilidade
  // com a PoC1a durante a migração segura.
  // ----------------------------------------------------------

  doc["pressao"] =
    pressaoNivelMarAtual;

  doc["pressao_mar"] =
    pressaoNivelMarAtual;

  doc["pressao_local"] =
    pressaoLocalAtual;

  doc["pressao_media15"] =
    mediaPressao15;

  doc["pressao_media60"] =
    mediaPressao60;

  doc["pressao_min_dia"] =
    pressaoMin;

  doc["hora_pressao_min"] =
    horaPressaoMin;

  doc["pressao_max_dia"] =
    pressaoMax;

  doc["hora_pressao_max"] =
    horaPressaoMax;

  doc["variacao_pressao_janela"] =
    variacaoJanela;

  doc["tendencia_pressao_hora"] =
    tendenciaPressaoHora;

  // ----------------------------------------------------------
  // PROCESSAMENTO EDGE
  // Mantemos "estado" temporariamente para compatibilidade.
  // ----------------------------------------------------------

  doc["ponto_orvalho"] =
    pontoOrvalho;

  doc["estado"] =
    estadoGeral;

  doc["estado_geral"] =
    estadoGeral;

  doc["estado_umidade"] =
    estadoUmidade;

  doc["estado_conforto"] =
    estadoConforto;

  doc["estado_pressao"] =
    estadoPressao;

  doc["instabilidade"] =
    estadoInstabilidade;

  doc["anomalia"] =
    estadoAnomalia;

  // ----------------------------------------------------------
  // ALERTAS
  // ----------------------------------------------------------

  doc["numero_alertas"] =
    numeroAlertas;

  doc["alerta1"] =
    alerta1;

  doc["alerta2"] =
    alerta2;

  doc["alerta3"] =
    alerta3;

  doc["alerta4"] =
    alerta4;

  // ----------------------------------------------------------
  // CONTEXTO DA ESTAÇÃO
  // ----------------------------------------------------------

  doc["amostras"] =
    totalAmostras;

  doc["rssi"] =
    WiFi.RSSI();

  doc["altitude"] =
    altitudeLocal;

  doc["origem_altitude"] =
    origemAltitude;

  // ----------------------------------------------------------
  // REFERÊNCIA METEOROLÓGICA EXTERNA
  // ----------------------------------------------------------

  doc["externo_disponivel"] =
    externoDisponivel;

  doc["externo_tem_dados"] =
    externoJaRecebeuDados;

  doc["externo_local"] =
    nomeLocalExterno;

  doc["externo_cidade"] =
    cidadeExterna;

  doc["externo_admin1"] =
    admin1Externo;

  doc["externo_pais"] =
    paisExterno;

  doc["externo_latitude"] =
    latitudeExterna;

  doc["externo_longitude"] =
    longitudeExterna;

  doc["externo_fonte"] =
    FONTE_METEOROLOGICA;

  if (
    horaAtualizacaoExterna !=
    "--:--:--"
  ) {
    doc["externo_atualizado"] =
      horaAtualizacaoExterna;
  }

  if (
    horaUltimaTentativaAPI !=
    "--:--:--"
  ) {
    doc["externo_ultima_tentativa"] =
      horaUltimaTentativaAPI;
  }

  if (externoJaRecebeuDados) {
    doc["externo_temperatura"] =
      extTemperatura;

    doc["externo_sensacao"] =
      extSensacao;

    doc["externo_umidade"] =
      extUmidade;

    doc["externo_orvalho"] =
      extPontoOrvalho;

    doc["externo_pressao_mar"] =
      extPressaoMar;

    doc["externo_pressao_superficie"] =
      extPressaoSuperficie;

    doc["externo_precipitacao"] =
      extPrecipitacao;

    doc["externo_chuva"] =
      extChuva;

    doc["externo_prob_chuva"] =
      extProbabilidadeChuva;

    doc["externo_nuvens"] =
      extNuvens;

    doc["externo_visibilidade"] =
      extVisibilidade;

    doc["externo_uv"] =
      extUV;

    doc["externo_vento"] =
      extVento;

    doc["externo_direcao_vento"] =
      extDirecaoVento;

    doc["externo_direcao_cardeal"] =
      direcaoCardeal(
        extDirecaoVento
      );

    doc["externo_rajada"] =
      extRajada;

    doc["externo_weather_code"] =
      extWeatherCode;

    doc["externo_is_day"] =
      (extIsDay == 1);
  }

  String payload;

  serializeJson(
    doc,
    payload
  );

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (
    !http.begin(
      client,
      SUPABASE_REST_URL
    )
  ) {
    Serial.println(
      "[CLOUD] Falha ao iniciar HTTPS."
    );

    return false;
  }

  http.setTimeout(
    12000
  );

  http.addHeader(
    "apikey",
    SUPABASE_PUBLISHABLE_KEY
  );

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "Prefer",
    "return=minimal"
  );

  int code =
    http.POST(
      payload
    );

  String resposta = "";

  if (
    code > 0
  ) {
    resposta =
      http.getString();
  }

  http.end();

  bool ok =
    (
      code == 200 ||
      code == 201 ||
      code == 204
    );

  Serial.print(
    "[CLOUD] POST Supabase -> HTTP "
  );

  Serial.println(
    code
  );

  if (
    !ok &&
    resposta.length() > 0
  ) {
    Serial.print(
      "[CLOUD] Resposta: "
    );

    Serial.println(
      resposta
    );
  }

  if (
    !cloudJaTentou ||
    ok != cloudEstadoAnterior
  ) {
    registrarEvento(
      "CLOUD",
      ok
      ? "Telemetria Supabase conectada"
      : "Falha no envio de telemetria"
    );
  }

  cloudEstadoAnterior =
    ok;

  cloudJaTentou =
    true;

  return ok;
}

// ==================================================================
// GEOCODIFICAÇÃO
// ==================================================================

void buscarLocal() {
  if (!server.hasArg("q")) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"Busca nao informada\"}"
    );
    return;
  }

  String busca = server.arg("q");
  busca.trim();

  if (busca.length() < 2) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"Digite pelo menos 2 caracteres\"}"
    );
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    server.send(
      503,
      "application/json",
      "{\"erro\":\"Internet indisponivel\"}"
    );
    return;
  }

  String url =
    "https://geocoding-api.open-meteo.com/v1/search"
    "?name=" + urlEncode(busca) +
    "&count=5"
    "&language=pt"
    "&format=json";

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, url)) {
    server.send(
      500,
      "application/json",
      "{\"erro\":\"Falha ao iniciar consulta\"}"
    );
    return;
  }

  http.setTimeout(12000);

  int code = http.GET();

  if (code != HTTP_CODE_OK) {
    http.end();

    server.send(
      502,
      "application/json",
      "{\"erro\":\"Servico de localizacao indisponivel\"}"
    );
    return;
  }

  String payload = http.getString();
  http.end();

  JsonDocument entrada;

  if (deserializeJson(entrada, payload)) {
    server.send(
      500,
      "application/json",
      "{\"erro\":\"Resposta de localizacao invalida\"}"
    );
    return;
  }

  JsonDocument saida;
  JsonArray out = saida["resultados"].to<JsonArray>();

  JsonArray resultados = entrada["results"];

  if (!resultados.isNull()) {
    for (JsonObject item : resultados) {
      JsonObject r = out.add<JsonObject>();

      r["nome"] = item["name"] | "";
      r["admin1"] = item["admin1"] | "";
      r["pais"] = item["country"] | "";
      r["lat"] = item["latitude"] | 0.0f;
      r["lon"] = item["longitude"] | 0.0f;
      r["elevation"] = item["elevation"] | 0.0f;
    }
  }

  String json;
  serializeJson(saida, json);

  server.send(
    200,
    "application/json",
    json
  );
}


// ==================================================================
// ALTITUDE AUTOMÁTICA — OPEN-METEO ELEVATION API
// ==================================================================

bool obterAltitudeAutomatica(
  float latitude,
  float longitude,
  float &altitude
) {
  if (WiFi.status() != WL_CONNECTED)
    return false;

  String url =
    "https://api.open-meteo.com/v1/elevation"
    "?latitude=" + String(latitude, 6) +
    "&longitude=" + String(longitude, 6);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, url))
    return false;

  http.setTimeout(12000);

  int code = http.GET();

  if (code != HTTP_CODE_OK) {
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  JsonDocument doc;

  if (deserializeJson(doc, payload))
    return false;

  JsonArray elevacoes = doc["elevation"];

  if (elevacoes.isNull() || elevacoes.size() == 0)
    return false;

  altitude = elevacoes[0] | 0.0f;

  return true;
}

void salvarNovoLocal() {
  if (
    !server.hasArg("nome") ||
    !server.hasArg("lat") ||
    !server.hasArg("lon")
  ) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"Parametros incompletos\"}"
    );
    return;
  }

  cidadeExterna = server.arg("nome");
  admin1Externo = server.hasArg("admin1")
    ? server.arg("admin1")
    : "";
  paisExterno = server.hasArg("pais")
    ? server.arg("pais")
    : "";

  latitudeExterna =
    server.arg("lat").toFloat();

  longitudeExterna =
    server.arg("lon").toFloat();

  // Primeiro tentamos obter a altitude do ponto exato pela
  // Elevation API (DEM GLO-90). Se falhar, usamos a elevação
  // devolvida pela própria busca de geocodificação.
  float altitudeObtida = 0.0f;

  bool altitudeOK =
    obterAltitudeAutomatica(
      latitudeExterna,
      longitudeExterna,
      altitudeObtida
    );

  if (altitudeOK) {
    altitudeLocal = altitudeObtida;
    origemAltitude = "Open-Meteo Elevation API";
  }
  else if (server.hasArg("elevation")) {
    altitudeLocal =
      server.arg("elevation").toFloat();

    origemAltitude =
      "Open-Meteo Geocoding";
  }

  nomeLocalExterno = cidadeExterna;

  if (admin1Externo.length()) {
    nomeLocalExterno += " - ";
    nomeLocalExterno += admin1Externo;
  }

  salvarConfiguracaoLocal();

  registrarEvento(
    "CONFIG",
    "Referencia externa alterada para " +
    nomeLocalExterno
  );

  externoDisponivel = false;
  externoJaRecebeuDados = false;

  bool ok =
    atualizarMeteorologiaExterna();

  ultimoTempoAPI = millis();

  JsonDocument doc;
  doc["ok"] = true;
  doc["api"] = ok;
  doc["local"] = nomeLocalExterno;
  doc["altitude"] = altitudeLocal;
  doc["origemAltitude"] = origemAltitude;

  String json;
  serializeJson(doc, json);

  server.send(
    200,
    "application/json",
    json
  );
}


// ==================================================================
// CONFIGURAÇÃO DA ALTITUDE
// ==================================================================

void salvarAltitudeManual() {
  if (!server.hasArg("valor")) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"Altitude nao informada\"}"
    );
    return;
  }

  float valor =
    server.arg("valor").toFloat();

  if (valor < -500.0f || valor > 9000.0f) {
    server.send(
      400,
      "application/json",
      "{\"erro\":\"Altitude fora da faixa valida\"}"
    );
    return;
  }

  altitudeLocal = valor;
  origemAltitude = "Manual";

  salvarConfiguracaoLocal();

  registrarEvento(
    "CONFIG",
    "Altitude manual definida: " +
    String(altitudeLocal, 1) +
    " m"
  );

  // A pressão ao nível do mar será recalculada já na próxima leitura.
  // Fazemos uma leitura imediata para atualizar o painel agora.
  adquirirDados();
  ultimoTempo = millis();

  JsonDocument doc;
  doc["ok"] = true;
  doc["altitude"] = altitudeLocal;
  doc["origemAltitude"] = origemAltitude;

  enviarJSON(doc);
}

void usarAltitudeAutomatica() {
  float altitudeObtida = 0.0f;

  if (
    !obterAltitudeAutomatica(
      latitudeExterna,
      longitudeExterna,
      altitudeObtida
    )
  ) {
    server.send(
      502,
      "application/json",
      "{\"erro\":\"Nao foi possivel obter a altitude automaticamente\"}"
    );
    return;
  }

  altitudeLocal = altitudeObtida;
  origemAltitude = "Open-Meteo Elevation API";

  salvarConfiguracaoLocal();

  registrarEvento(
    "CONFIG",
    "Altitude automatica atualizada: " +
    String(altitudeLocal, 1) +
    " m"
  );

  adquirirDados();
  ultimoTempo = millis();

  JsonDocument doc;
  doc["ok"] = true;
  doc["altitude"] = altitudeLocal;
  doc["origemAltitude"] = origemAltitude;

  enviarJSON(doc);
}


bool hostnameValido(const String &host) {
  if (host.length() < 1 || host.length() > 32) return false;
  if (host.startsWith("-") || host.endsWith("-")) return false;
  for (size_t i = 0; i < host.length(); i++) {
    char c = host.charAt(i);
    bool ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-';
    if (!ok) return false;
  }
  return true;
}

void iniciarMDNS() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!hostnameValido(hostnameMDNS)) {
    hostnameMDNS = "estacao";
    salvarConfiguracaoLocal();
  }

  MDNS.end();
  mdnsAtivo = false;

  if (MDNS.begin(hostnameMDNS.c_str())) {
    MDNS.addService("http", "tcp", 80);
    mdnsAtivo = true;
    Serial.print("mDNS: http://");
    Serial.print(hostnameMDNS);
    Serial.println(".local");
  } else {
    Serial.println("Aviso: mDNS nao iniciado.");
  }
}

void enviarIdentidadeJSON() {
  JsonDocument doc;
  doc["nomeEstacao"] = nomeEstacao;
  doc["hostname"] = hostnameMDNS;
  doc["enderecoLocal"] = "http://" + hostnameMDNS + ".local";
  doc["mdnsAtivo"] = mdnsAtivo;
  enviarJSON(doc);
}

void salvarIdentidade() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"erro\":\"Corpo JSON ausente\"}");
    return;
  }

  JsonDocument entrada;
  if (deserializeJson(entrada, server.arg("plain"))) {
    server.send(400, "application/json", "{\"erro\":\"JSON invalido\"}");
    return;
  }

  String novoNome = entrada["nomeEstacao"] | "";
  String novoHost = entrada["hostname"] | "";
  novoNome.trim();
  novoHost.trim();
  novoHost.toLowerCase();

  if (novoNome.length() < 1 || novoNome.length() > 48) {
    server.send(400, "application/json", "{\"erro\":\"Nome da estacao deve ter entre 1 e 48 caracteres\"}");
    return;
  }

  if (!hostnameValido(novoHost)) {
    server.send(400, "application/json", "{\"erro\":\"Hostname invalido. Use apenas letras minusculas, numeros e hifen, sem espacos ou acentos.\"}");
    return;
  }

  nomeEstacao = novoNome;
  hostnameMDNS = novoHost;
  salvarConfiguracaoLocal();

  registrarEvento("CONFIG", "Identidade alterada: " + nomeEstacao + " | " + hostnameMDNS + ".local");
  iniciarMDNS();

  JsonDocument doc;
  doc["ok"] = true;
  doc["nomeEstacao"] = nomeEstacao;
  doc["hostname"] = hostnameMDNS;
  doc["enderecoLocal"] = "http://" + hostnameMDNS + ".local";
  doc["mdnsAtivo"] = mdnsAtivo;
  enviarJSON(doc);
}

// ==================================================================
// RESET DE ESTADO
// ==================================================================

void zerarMinMax() {
  String hora = horaAtual(false);
  dataMinMaxAtual = dataISOAtual();

  tempBMPMin = tempBMPMax = tBMPAtual;
  tempDHTMin = tempDHTMax = tDHTAtual;
  umidadeMin = umidadeMax = umidadeAtual;
  pressaoMin = pressaoMax = pressaoNivelMarAtual;

  horaTempBMPMin = horaTempBMPMax = hora;
  horaTempDHTMin = horaTempDHTMax = hora;
  horaUmidadeMin = horaUmidadeMax = hora;
  horaPressaoMin = horaPressaoMax = hora;

  registrarEvento(
    "SISTEMA",
    "Minimos e maximos reiniciados"
  );
}

void verificarViradaDoDia() {
  String hoje = dataISOAtual();

  if (hoje == "2000-01-01")
    return;

  if (dataMinMaxAtual.length() == 0)
    dataMinMaxAtual = hoje;

  if (dataEventosAtual.length() == 0)
    dataEventosAtual = hoje;

  if (hoje != dataMinMaxAtual) {
    String hora = horaAtual(false);

    tempBMPMin = tempBMPMax = tBMPAtual;
    tempDHTMin = tempDHTMax = tDHTAtual;
    umidadeMin = umidadeMax = umidadeAtual;
    pressaoMin = pressaoMax = pressaoNivelMarAtual;

    horaTempBMPMin = horaTempBMPMax = hora;
    horaTempDHTMin = horaTempDHTMax = hora;
    horaUmidadeMin = horaUmidadeMax = hora;
    horaPressaoMin = horaPressaoMax = hora;

    dataMinMaxAtual = hoje;
  }

  if (hoje != dataEventosAtual) {
    indiceEventos = 0;
    totalEventos = 0;
    dataEventosAtual = hoje;
  }
}

void limparHistorico() {
  indice = 0;
  totalAmostras = 0;

  variacaoJanela = 0;
  tendenciaPressaoHora = 0;

  estadoPressao = "FORMANDO HISTORICO";
  estadoInstabilidade = "AGUARDANDO HISTORICO";

  pendentePressao = "";
  pendenteInstabilidade = "";

  contadorPressao = 0;
  contadorInstabilidade = 0;

  estadosInicializados = false;

  registrarEvento(
    "SISTEMA",
    "Historico ambiental reiniciado"
  );
}

void limparEventos() {
  indiceEventos = 0;
  totalEventos = 0;
  dataEventosAtual = dataISOAtual();

  registrarEvento(
    "SISTEMA",
    "Registro de eventos reiniciado"
  );
}

// ==================================================================
// JSON / API LOCAL
// ==================================================================

void enviarJSON(JsonDocument &doc) {
  String json;
  serializeJson(doc, json);

  server.send(
    200,
    "application/json",
    json
  );
}

void enviarDadosJSON() {
  JsonDocument doc;

  doc["tempBMP"] = tBMPAtual;
  doc["tempBMP15"] = mediaTempBMP15;
  doc["tempBMPMin"] = tempBMPMin;
  doc["tempBMPMax"] = tempBMPMax;
  doc["horaTempBMPMin"] = horaTempBMPMin;
  doc["horaTempBMPMax"] = horaTempBMPMax;

  doc["tempDHT"] = tDHTAtual;
  doc["tempDHT15"] = mediaTempDHT15;
  doc["tempDHTMin"] = tempDHTMin;
  doc["tempDHTMax"] = tempDHTMax;
  doc["horaTempDHTMin"] = horaTempDHTMin;
  doc["horaTempDHTMax"] = horaTempDHTMax;

  doc["diferenca"] = diferencaTemp;

  doc["umidade"] = umidadeAtual;
  doc["umidade15"] = mediaUmidade15;
  doc["umidadeMin"] = umidadeMin;
  doc["umidadeMax"] = umidadeMax;
  doc["horaUmidadeMin"] = horaUmidadeMin;
  doc["horaUmidadeMax"] = horaUmidadeMax;

  doc["pressaoLocal"] = pressaoLocalAtual;
  doc["pressaoMar"] = pressaoNivelMarAtual;
  doc["pressao15"] = mediaPressao15;
  doc["pressao60"] = mediaPressao60;
  doc["pressaoMin"] = pressaoMin;
  doc["pressaoMax"] = pressaoMax;
  doc["horaPressaoMin"] = horaPressaoMin;
  doc["horaPressaoMax"] = horaPressaoMax;

  doc["pontoOrvalho"] = pontoOrvalho;
  doc["variacao"] = variacaoJanela;
  doc["tendenciaHora"] = tendenciaPressaoHora;

  doc["estadoGeral"] = estadoGeral;
  doc["estadoUmidade"] = estadoUmidade;
  doc["estadoConforto"] = estadoConforto;
  doc["estadoPressao"] = estadoPressao;
  doc["instabilidade"] = estadoInstabilidade;
  doc["anomalia"] = estadoAnomalia;

  doc["numeroAlertas"] = numeroAlertas;
  doc["alerta1"] = alerta1;
  doc["alerta2"] = alerta2;
  doc["alerta3"] = alerta3;
  doc["alerta4"] = alerta4;

  doc["amostras"] = totalAmostras;
  doc["rssi"] = WiFi.RSSI();

  doc["altitude"] = altitudeLocal;
  doc["origemAltitude"] = origemAltitude;

  doc["ultimaLeitura"] = horaUltimaLeitura;
  doc["dataAtual"] = dataAtual();
  doc["dataISO"] = dataISOAtual();
  doc["horaAtual"] = horaAtual(true);
  doc["epoch"] = (uint32_t)time(nullptr);

  enviarJSON(doc);
}

void enviarExternoJSON() {
  JsonDocument doc;

  doc["disponivel"] = externoDisponivel;
  doc["temDados"] = externoJaRecebeuDados;

  doc["local"] = nomeLocalExterno;
  doc["cidade"] = cidadeExterna;
  doc["admin1"] = admin1Externo;
  doc["pais"] = paisExterno;
  doc["latitude"] = latitudeExterna;
  doc["longitude"] = longitudeExterna;
  doc["altitude"] = altitudeLocal;
  doc["origemAltitude"] = origemAltitude;

  doc["fonte"] = FONTE_METEOROLOGICA;
  doc["atualizado"] = horaAtualizacaoExterna;
  doc["ultimaTentativa"] = horaUltimaTentativaAPI;

  doc["temperatura"] = extTemperatura;
  doc["sensacao"] = extSensacao;
  doc["umidade"] = extUmidade;
  doc["orvalho"] = extPontoOrvalho;

  doc["pressaoMar"] = extPressaoMar;
  doc["pressaoSuperficie"] = extPressaoSuperficie;

  doc["precipitacao"] = extPrecipitacao;
  doc["chuva"] = extChuva;
  doc["probChuva"] = extProbabilidadeChuva;

  doc["nuvens"] = extNuvens;
  doc["visibilidade"] = extVisibilidade;
  doc["uv"] = extUV;

  doc["vento"] = extVento;
  doc["direcaoVento"] = extDirecaoVento;
  doc["direcaoCardeal"] =
    direcaoCardeal(extDirecaoVento);
  doc["rajada"] = extRajada;

  doc["weatherCode"] = extWeatherCode;
  doc["isDay"] = extIsDay;

  enviarJSON(doc);
}

void enviarHistoricoJSON() {
  JsonDocument doc;
  JsonArray array = doc.to<JsonArray>();

  for (int i = 0; i < totalAmostras; i++) {
    int pos = posicaoCronologica(i);

    struct tm ti;
    char horario[6] = "--:--";

    if (localtime_r(&tempoAmostra[pos], &ti)) {
      strftime(
        horario,
        sizeof(horario),
        "%H:%M",
        &ti
      );
    }

    JsonObject item =
      array.add<JsonObject>();

    item["hora"] = horario;
    item["bmp"] = tempBMP[pos];
    item["bmp15"] =
      media15TempBMPHistorico[pos];
    item["dht"] = tempDHT[pos];
    item["dht15"] =
      media15TempDHTHistorico[pos];
    item["umidade"] = umidade[pos];
    item["umidade15"] =
      media15UmidadeHistorico[pos];
    item["pressao"] = pressao[pos];
    item["pressao15"] =
      media15PressaoHistorico[pos];
  }

  enviarJSON(doc);
}

void enviarEventosJSON() {
  JsonDocument doc;
  JsonArray array = doc.to<JsonArray>();

  for (int i = 0; i < totalEventos; i++) {
    int pos =
      indiceEventos -
      1 -
      i;

    while (pos < 0)
      pos += MAX_EVENTOS;

    if (
      eventos[pos].data !=
      dataISOAtual()
    ) {
      continue;
    }

    JsonObject item =
      array.add<JsonObject>();

    item["hora"] =
      eventos[pos].hora;

    item["tipo"] =
      eventos[pos].tipo;

    item["mensagem"] =
      eventos[pos].mensagem;
  }

  enviarJSON(doc);
}

// ==================================================================
// LITTLEFS / SERVIDOR WEB
// ==================================================================

String contentType(const String &filename) {
  if (filename.endsWith(".html"))
    return "text/html";

  if (filename.endsWith(".css"))
    return "text/css";

  if (filename.endsWith(".js"))
    return "application/javascript";

  if (filename.endsWith(".json"))
    return "application/json";

  if (filename.endsWith(".png"))
    return "image/png";

  if (filename.endsWith(".svg"))
    return "image/svg+xml";

  return "text/plain";
}

bool servirArquivo(const String &path) {
  if (!LittleFS.exists(path))
    return false;

  File file =
    LittleFS.open(
      path,
      "r"
    );

  if (!file)
    return false;

  server.streamFile(
    file,
    contentType(path)
  );

  file.close();
  return true;
}

void paginaPrincipal() {
  if (!servirArquivo("/index.html")) {
    server.send(
      500,
      "text/plain",
      "index.html nao encontrado no LittleFS"
    );
  }
}

void servirCSS() {
  if (!servirArquivo("/style.css")) {
    server.send(
      404,
      "text/plain",
      "style.css nao encontrado"
    );
  }
}

void servirJS() {
  if (!servirArquivo("/app.js")) {
    server.send(
      404,
      "text/plain",
      "app.js nao encontrado"
    );
  }
}


void servirFavicon() {
  if (!servirArquivo("/favicon.png")) {
    server.send(
      404,
      "text/plain",
      "favicon.png nao encontrado"
    );
  }
}

// ==================================================================
// COMANDOS HTTP
// ==================================================================

void comandoZerar() {
  zerarMinMax();

  server.send(
    200,
    "text/plain",
    "OK"
  );
}

void comandoLimpar() {
  limparHistorico();
  adquirirDados();
  ultimoTempo = millis();

  server.send(
    200,
    "text/plain",
    "OK"
  );
}

void comandoLimparEventos() {
  limparEventos();

  server.send(
    200,
    "text/plain",
    "OK"
  );
}

// ==================================================================
// SETUP
// ==================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==============================================");
  Serial.println(" ESTACAO AMBIENTAL INTELIGENTE v3.4-RC1");
  Serial.println(" ESP32 + LITTLEFS + EDGE COMPUTING");
  Serial.println("==============================================");

  iniciarHeartbeat();

  carregarConfiguracaoLocal();

  // LittleFS
  if (!LittleFS.begin(true)) {
    Serial.println("ERRO: LittleFS nao montado.");
  } else {
    Serial.println("LittleFS OK");

    Serial.print("index.html: ");
    Serial.println(
      LittleFS.exists("/index.html")
      ? "OK"
      : "NAO ENCONTRADO"
    );

    Serial.print("style.css: ");
    Serial.println(
      LittleFS.exists("/style.css")
      ? "OK"
      : "NAO ENCONTRADO"
    );

    Serial.print("app.js: ");
    Serial.println(
      LittleFS.exists("/app.js")
      ? "OK"
      : "NAO ENCONTRADO"
    );
  }

  // BMP180
  if (!bmp.begin()) {
    Serial.println(
      "ERRO: BMP180 nao encontrado."
    );

    while (1)
      delay(1000);
  }

  Serial.println("BMP180 OK");

  // DHT11
  dht.begin();
  Serial.println("DHT11 inicializado");

  // Wi-Fi portátil
  iniciarWiFiPortatil();

  if (
    WiFi.status() !=
    WL_CONNECTED
  ) {
    Serial.println(
      "Sem Internet no momento; processamento local permanece ativo."
    );
  }

  // NTP
  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    configTime(
      -3 * 3600,
      0,
      "pool.ntp.org",
      "time.nist.gov"
    );

    Serial.print(
      "Sincronizando horario"
    );

    struct tm ti;
    int tentativas = 0;

    while (
      !getLocalTime(&ti) &&
      tentativas < 20
    ) {
      Serial.print(".");
      delay(500);
      tentativas++;
    }

    Serial.println();

    if (tentativas < 20) {
      Serial.print("Data: ");
      Serial.println(dataAtual());

      Serial.print("Hora: ");
      Serial.println(horaAtual(true));
    } else {
      Serial.println(
        "Aviso: NTP nao sincronizado."
      );
    }
  } else {
    Serial.println(
      "NTP aguardando conexao com a Internet."
    );
  }

  // Primeira leitura
  adquirirDados();
  ultimoTempo = millis();

  registrarEvento(
    "SISTEMA",
    "Estacao ambiental v3.4-RC1 iniciada"
  );

  // Primeira API externa
  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    atualizarMeteorologiaExterna();
  }
  ultimoTempoAPI = millis();

  iniciarMDNS();

  // Rotas estáticas
  server.on("/", paginaPrincipal);
  server.on("/style.css", servirCSS);
  server.on("/app.js", servirJS);
  server.on("/favicon.png", servirFavicon);

  // APIs
  server.on("/dados", enviarDadosJSON);
  server.on("/externo", enviarExternoJSON);
  server.on("/historico", enviarHistoricoJSON);
  server.on("/eventos", enviarEventosJSON);

  server.on("/buscarLocal", buscarLocal);
  server.on("/salvarLocal", salvarNovoLocal);
  server.on("/salvarAltitude", salvarAltitudeManual);
  server.on("/altitudeAutomatica", usarAltitudeAutomatica);
  server.on("/identidade", enviarIdentidadeJSON);
  server.on("/salvarIdentidade", HTTP_POST, salvarIdentidade);

  server.on("/wifiStatus", enviarStatusWiFi);
  server.on("/wifiScan", escanearRedesWiFi);

  server.on(
    "/wifiConfig",
    HTTP_POST,
    receberConfiguracaoWiFi
  );

  server.on(
    "/wifiRemove",
    HTTP_POST,
    removerRedeWiFiEndpoint
  );

  server.on(
    "/wifiForget",
    HTTP_POST,
    esquecerTodasRedesWiFi
  );

  // Rotas comuns de captive portal.
  server.on("/generate_204", paginaPrincipal);
  server.on("/hotspot-detect.html", paginaPrincipal);
  server.on("/connecttest.txt", paginaPrincipal);
  server.on("/ncsi.txt", paginaPrincipal);

  server.on("/zerar", comandoZerar);
  server.on("/limpar", comandoLimpar);
  server.on(
    "/limparEventos",
    comandoLimparEventos
  );

  server.onNotFound([]() {
    if (modoAPAtivo) {
      server.sendHeader(
        "Location",
        "http://" +
        WiFi.softAPIP().toString() +
        "/"
      );

      server.send(
        302,
        "text/plain",
        ""
      );

      return;
    }

    server.send(
      404,
      "text/plain",
      "Recurso nao encontrado"
    );
  });

  server.begin();

  Serial.println();
  Serial.println("Servidor Web iniciado.");

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    Serial.print("Dashboard: http://");
    Serial.println(WiFi.localIP());
  }
  else if (modoAPAtivo) {
    Serial.print("Configuracao Wi-Fi: http://");
    Serial.println(WiFi.softAPIP());
  }

  Serial.print(
    "Referencia externa: "
  );
  Serial.println(nomeLocalExterno);

  Serial.print("Altitude da estacao: ");
  Serial.print(altitudeLocal, 1);
  Serial.print(" m | Origem: ");
  Serial.println(origemAltitude);
}

// ==================================================================
// LOOP
// ==================================================================

void loop() {
  processarHeartbeat();

  server.handleClient();

  if (modoAPAtivo) {
    dnsServer.processNextRequest();
  }

  processarTrocaWiFi();

  unsigned long agora =
    millis();

  if (
    agora -
    ultimoTempo >=
    INTERVALO_LEITURA
  ) {
    if (adquirirDados()) {
      ultimoTempo = agora;
    }
  }

  if (
    agora -
    ultimoEnvioCloud >=
    INTERVALO_CLOUD
  ) {
    enviarLeituraCloud();

    ultimoEnvioCloud =
      agora;
  }

  if (
    agora -
    ultimoTempoAPI >=
    INTERVALO_API
  ) {
    if (
      WiFi.status() ==
      WL_CONNECTED
    ) {
      atualizarMeteorologiaExterna();
    }

    ultimoTempoAPI = agora;
  }
}
