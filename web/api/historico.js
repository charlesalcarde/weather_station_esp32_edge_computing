export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(501).json({ erro: "nao_implementado", mensagem: "O endpoint histórico será implementado na próxima etapa da v3.4 Web." });
}
