import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../asyncHandler";

export const alunoExamRouter = Router();

// GET /api/prova/:provaMestreId/:token -> dados da prova pro aluno resolver (SEM revelar a correta)
// :token aqui é a matrícula do aluno — única DENTRO desse TDE específico
alunoExamRouter.get("/:provaMestreId/:token", asyncHandler(async (req, res) => {
  const { provaMestreId, token } = req.params;

  const provaIndividual = await prisma.provaIndividual.findUnique({
    where: { provaMestreId_qrToken: { provaMestreId, qrToken: token } },
    include: {
      aluno: true,
      provaMestre: true,
      questoes: { include: { questao: true }, orderBy: { ordem: "asc" } },
    },
  });
  if (!provaIndividual) return res.status(404).json({ erro: "Matrícula não encontrada para este TDE." });

  if (provaIndividual.status === "gerada") {
    await prisma.provaIndividual.update({
      where: { id: provaIndividual.id },
      data: { status: "em_andamento", iniciadaEm: new Date() },
    });
  }

  res.json({
    provaMestreId,
    token,
    alunoNome: provaIndividual.aluno.nome,
    tituloProva: provaIndividual.provaMestre.titulo,
    duracaoMinutos: provaIndividual.provaMestre.duracaoMinutos,
    status: provaIndividual.status,
    questoes: provaIndividual.questoes.map((q) => ({
      id: q.id,
      tema: q.questao.tema,
      enunciado: q.enunciadoFinal,
      imagem: q.questao.imagem,
      respostaAlunoLetra: q.respostaAlunoLetra,
      alternativas: (q.alternativasFinal as any[]).map((a) => ({ letra: a.letra, campos: a.campos })), // sem "correta"
    })),
  });
}));

// POST /api/prova/:provaMestreId/:token/responder  { provaIndividualQuestaoId, letra }
alunoExamRouter.post("/:provaMestreId/:token/responder", asyncHandler(async (req, res) => {
  const { provaMestreId, token } = req.params;
  const { provaIndividualQuestaoId, letra } = req.body;

  const provaIndividual = await prisma.provaIndividual.findUnique({
    where: { provaMestreId_qrToken: { provaMestreId, qrToken: token } },
  });
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
}));

// POST /api/prova/:provaMestreId/:token/finalizar -> corrige automaticamente e retorna o resultado
alunoExamRouter.post("/:provaMestreId/:token/finalizar", asyncHandler(async (req, res) => {
  const { provaMestreId, token } = req.params;

  const provaIndividual = await prisma.provaIndividual.findUnique({
    where: { provaMestreId_qrToken: { provaMestreId, qrToken: token } },
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
}));
