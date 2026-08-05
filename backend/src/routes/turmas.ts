import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../asyncHandler";

export const turmasRouter = Router();

// GET /api/turmas -> lista todas as turmas com contadores
turmasRouter.get("/", asyncHandler(async (_req, res) => {
  const turmas = await prisma.turma.findMany({
    orderBy: { nome: "asc" },
    include: { alunos: true, provasMestre: true },
  });

  res.json(
    turmas.map((t) => ({
      id: t.id,
      nome: t.nome,
      criadoEm: t.criadoEm,
      totalAlunos: t.alunos.length,
      totalTdes: t.provasMestre.length,
    }))
  );
}));

// POST /api/turmas  { nome }
turmasRouter.post("/", asyncHandler(async (req, res) => {
  const { nome } = req.body;
  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ erro: "Informe o nome da turma." });
  }
  const turma = await prisma.turma.create({ data: { nome: String(nome).trim() } });
  res.status(201).json(turma);
}));

// DELETE /api/turmas/:id -> apaga a turma e tudo que depende dela (alunos, TDEs, provas individuais, respostas)
turmasRouter.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  const provas = await prisma.provaMestre.findMany({ where: { turmaId: id }, select: { id: true } });
  const provaIds = provas.map((p) => p.id);

  await prisma.$transaction([
    prisma.provaIndividualQuestao.deleteMany({ where: { provaIndividual: { provaMestreId: { in: provaIds } } } }),
    prisma.provaIndividual.deleteMany({ where: { provaMestreId: { in: provaIds } } }),
    prisma.provaMestreQuestao.deleteMany({ where: { provaMestreId: { in: provaIds } } }),
    prisma.provaMestre.deleteMany({ where: { turmaId: id } }),
    prisma.aluno.deleteMany({ where: { turmaId: id } }),
    prisma.turma.delete({ where: { id } }),
  ]);

  res.json({ ok: true });
}));
