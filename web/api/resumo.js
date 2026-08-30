export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(501).json({ erro: "nao_implementado", mensagem: "O endpoint de resumo analítico será implementado após o histórico." });
}
