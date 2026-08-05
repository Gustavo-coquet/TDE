import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../asyncHandler";

export const alunosRouter = Router();

// GET /api/alunos?turmaId=xxx -> lista alunos (de uma turma específica, se informada)
alunosRouter.get("/", asyncHandler(async (req, res) => {
  const { turmaId } = req.query as { turmaId?: string };
  const alunos = await prisma.aluno.findMany({
    where: turmaId ? { turmaId } : undefined,
    orderBy: { nome: "asc" },
  });
  res.json(alunos);
}));

// POST /api/alunos  { turmaId, nomes: string[] } -> matricula um ou vários alunos numa turma
alunosRouter.post("/", asyncHandler(async (req, res) => {
  const { turmaId, nomes } = req.body;
  if (!turmaId) return res.status(400).json({ erro: "turmaId é obrigatório." });
  if (!Array.isArray(nomes) || nomes.length === 0) {
    return res.status(400).json({ erro: "Informe ao menos um nome em 'nomes'." });
  }

  const nomesLimpos = nomes.map((n: string) => String(n).trim()).filter(Boolean);
  const criados: any[] = [];
  for (const nome of nomesLimpos) {
    const aluno = await prisma.aluno.create({ data: { nome, turmaId } });
    criados.push(aluno);
  }

  res.status(201).json(criados);
}));

// DELETE /api/alunos/:id
alunosRouter.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.aluno.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ erro: "Não foi possível remover: esse aluno já tem provas geradas vinculadas a ele." });
  }
}));
