import { Router } from "express";
import { prisma } from "../db";

export const alunoExamRouter = Router();

// GET /api/prova/:token -> dados da prova para o aluno resolver (SEM revelar a correta)
alunoExamRouter.get("/:token", async (req, res) => {
  const { token } = req.params;

  const provaIndividual = await prisma.provaIndividual.findUnique({
    where: { qrToken: token },
    include: {
      aluno: true,
      provaMestre: true,
      questoes: { include: { questao: true }, orderBy: { ordem: "asc" } },
    },
  });
  if (!provaIndividual) return res.status(404).json({ erro: "Prova não encontrada para este token." });

  if (provaIndividual.status === "gerada") {
    await prisma.provaIndividual.update({
      where: { id: provaIndividual.id },
      data: { status: "em_andamento", iniciadaEm: new Date() },
    });
  }

  res.json({
    token,
    alunoNome: provaIndividual.aluno.nome,
    tituloProva: provaIndividual.provaMestre.titulo,
    duracaoMinutos: provaIndividual.provaMestre.duracaoMinutos,
    status: provaIndividual.status,
    questoes: provaIndividual.questoes.map((q) => ({
      id: q.id,
      tema: q.questao.tema,
      enunciado: q.enunciadoFinal,
      unidade: q.questao.unidade,
      respostaAlunoLetra: q.respostaAlunoLetra,
      alternativas: (q.alternativasFinal as any[]).map((a) => ({ letra: a.letra, valor: a.valor })), // sem "correta"
    })),
  });
});

// POST /api/prova/:token/responder  { provaIndividualQuestaoId, letra }
alunoExamRouter.post("/:token/responder", async (req, res) => {
  const { token } = req.params;
  const { provaIndividualQuestaoId, letra } = req.body;

  const provaIndividual = await prisma.provaIndividual.findUnique({ where: { qrToken: token } });
  if (!provaIndividual) return res.status(404).json({ erro: "Prova não encontrada." });
  if (provaIndividual.status === "finalizada") return res.status(400).json({ erro: "Esta prova já foi finalizada." });

  const questao = await prisma.provaIndividualQuestao.findUnique({ where: { id: provaIndividualQuestaoId } });
  if (!questao || questao.provaIndividualId !== provaIndividual.id) {
    return res.status(400).json({ erro: "Questão inválida para esta prova." });
  }

  await prisma.provaIndividualQuestao.update({
    where: { id: provaIndividualQuestaoId },
    data: { respostaAlunoLetra: letra, correta: letra === questao.respostaCorretaLetra },
  });

  res.json({ ok: true });
});

// POST /api/prova/:token/finalizar -> corrige automaticamente e retorna o resultado
alunoExamRouter.post("/:token/finalizar", async (req, res) => {
  const { token } = req.params;

  const provaIndividual = await prisma.provaIndividual.findUnique({
    where: { qrToken: token },
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });
  if (!provaIndividual) return res.status(404).json({ erro: "Prova não encontrada." });

  const acertos = provaIndividual.questoes.filter((q) => q.correta === true).length;
  const total = provaIndividual.questoes.length;

  await prisma.provaIndividual.update({
    where: { id: provaIndividual.id },
    data: { status: "finalizada", finalizadaEm: new Date(), acertos, total },
  });

  res.json({
    acertos,
    total,
    percentual: total ? Math.round((acertos / total) * 100) : 0,
    detalhe: provaIndividual.questoes.map((q) => ({
      tema: q.questao.tema,
      enunciado: q.enunciadoFinal,
      respostaAlunoLetra: q.respostaAlunoLetra,
      respostaCorretaLetra: q.respostaCorretaLetra,
      correta: q.correta,
    })),
  });
});
