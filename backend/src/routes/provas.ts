import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { gerarProvaIndividual } from "../randomizacao";

export const provasRouter = Router();

// GET /api/provas-mestre -> lista todas as provas-mestre criadas
provasRouter.get("/", async (_req, res) => {
  const provas = await prisma.provaMestre.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      questoes: true,
      provasIndividuais: true,
    },
  });

  res.json(
    provas.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      turma: p.turma,
      duracaoMinutos: p.duracaoMinutos,
      status: p.status,
      criadoEm: p.criadoEm,
      totalQuestoes: p.questoes.length,
      totalAlunos: p.provasIndividuais.length,
    }))
  );
});

// POST /api/provas-mestre  { titulo, turma, duracaoMinutos, questaoIds: string[] }
provasRouter.post("/", async (req, res) => {
  const { titulo, turma, duracaoMinutos, questaoIds } = req.body;

  if (!titulo || !turma || !duracaoMinutos || !Array.isArray(questaoIds) || questaoIds.length === 0) {
    return res.status(400).json({ erro: "titulo, turma, duracaoMinutos e questaoIds (não vazio) são obrigatórios." });
  }

  const provaMestre = await prisma.provaMestre.create({
    data: {
      titulo,
      turma,
      duracaoMinutos,
      questoes: {
        create: questaoIds.map((questaoId: string, ordem: number) => ({ questaoId, ordem })),
      },
    },
    include: { questoes: true },
  });

  res.status(201).json(provaMestre);
});

// POST /api/provas-mestre/:id/publicar
// Gera 1 prova individual (randomizada e parametrizada) para CADA aluno cadastrado.
// Esse é o passo que materializa a garantia de equivalência: mesmo conjunto de
// questões para todos, só ordem/valores/alternativas mudam.
provasRouter.post("/:id/publicar", async (req, res) => {
  const { id } = req.params;

  const provaMestre = await prisma.provaMestre.findUnique({
    where: { id },
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });
  if (!provaMestre) return res.status(404).json({ erro: "Prova-Mestre não encontrada." });
  if (provaMestre.status === "publicada") return res.status(400).json({ erro: "Esta Prova-Mestre já foi publicada." });

  const alunos = await prisma.aluno.findMany({ orderBy: { nome: "asc" } });
  const questoesBase = provaMestre.questoes.map((pmq) => ({ id: pmq.questao.id, tipo: pmq.questao.tipo }));

  const provasCriadas: { alunoId: string; alunoNome: string; qrToken: string }[] = [];

  for (const aluno of alunos) {
    const { seed, questoes } = gerarProvaIndividual(provaMestre.id, aluno.id, questoesBase);
    const qrToken = crypto.randomBytes(12).toString("hex");

    const provaIndividual = await prisma.provaIndividual.create({
      data: {
        provaMestreId: provaMestre.id,
        alunoId: aluno.id,
        seed,
        qrToken,
        questoes: {
          create: questoes.map((q) => ({
            questaoId: q.questaoId,
            ordem: q.ordem,
            parametrosGerados: q.parametrosGerados,
            enunciadoFinal: q.enunciadoFinal,
            alternativasFinal: q.alternativasFinal,
            respostaCorretaLetra: q.respostaCorretaLetra,
          })),
        },
      },
    });

    provasCriadas.push({ alunoId: aluno.id, alunoNome: aluno.nome, qrToken: provaIndividual.qrToken });
  }

  await prisma.provaMestre.update({ where: { id }, data: { status: "publicada" } });

  res.json({ provaMestreId: id, totalGeradas: provasCriadas.length, provas: provasCriadas });
});

// GET /api/provas-mestre/:id/resultados
provasRouter.get("/:id/resultados", async (req, res) => {
  const { id } = req.params;

  const provasIndividuais = await prisma.provaIndividual.findMany({
    where: { provaMestreId: id },
    include: { aluno: true, questoes: { include: { questao: true } } },
  });

  const linhas = provasIndividuais.map((pi) => {
    const respondidas = pi.questoes.filter((q) => q.respostaAlunoLetra !== null);
    const acertos = pi.questoes.filter((q) => q.correta === true).length;
    return {
      alunoId: pi.alunoId,
      alunoNome: pi.aluno.nome,
      status: pi.status,
      acertos,
      total: pi.questoes.length,
      nota: pi.questoes.length ? +((acertos / pi.questoes.length) * 10).toFixed(2) : null,
      respondidas: respondidas.length,
      iniciadaEm: pi.iniciadaEm,
      finalizadaEm: pi.finalizadaEm,
    };
  });

  const finalizadas = linhas.filter((l) => l.status === "finalizada" && l.nota !== null);
  const notas = finalizadas.map((l) => l.nota as number);

  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const sorted = [...notas].sort((a, b) => a - b);
  const mediana = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const desvio =
    notas.length && media !== null
      ? Math.sqrt(notas.reduce((acc, n) => acc + (n - media) ** 2, 0) / notas.length)
      : null;

  // ranking de questões com maior índice de erro
  const erroPorQuestao: Record<string, { tema: string; erros: number; total: number }> = {};
  for (const pi of provasIndividuais) {
    for (const q of pi.questoes) {
      if (q.respostaAlunoLetra === null) continue;
      const key = q.questaoId;
      if (!erroPorQuestao[key]) erroPorQuestao[key] = { tema: q.questao.tema, erros: 0, total: 0 };
      erroPorQuestao[key].total++;
      if (q.correta === false) erroPorQuestao[key].erros++;
    }
  }
  const rankingErros = Object.values(erroPorQuestao)
    .map((e) => ({ tema: e.tema, percentualErro: e.total ? Math.round((e.erros / e.total) * 100) : 0 }))
    .sort((a, b) => b.percentualErro - a.percentualErro);

  res.json({
    media: media !== null ? +media.toFixed(2) : null,
    mediana,
    desvioPadrao: desvio !== null ? +desvio.toFixed(2) : null,
    totalAlunos: linhas.length,
    totalFinalizadas: finalizadas.length,
    alunos: linhas,
    rankingErros,
  });
});
