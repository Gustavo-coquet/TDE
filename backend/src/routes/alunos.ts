import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../asyncHandler";

export const alunosRouter = Router();

// GET /api/alunos -> lista todos os alunos cadastrados
alunosRouter.get("/", asyncHandler(async (_req, res) => {
  const alunos = await prisma.aluno.findMany({ orderBy: { nome: "asc" } });
  res.json(alunos);
}));

// POST /api/alunos  { nomes: string[] } -> cadastra um ou vários alunos de uma vez
alunosRouter.post("/", asyncHandler(async (req, res) => {
  const { nomes } = req.body;
  if (!Array.isArray(nomes) || nomes.length === 0) {
    return res.status(400).json({ erro: "Informe ao menos um nome em 'nomes'." });
  }

  const nomesLimpos = nomes.map((n: string) => String(n).trim()).filter(Boolean);
  const criados: any[] = [];
  for (const nome of nomesLimpos) {
    const aluno = await prisma.aluno.create({ data: { nome } });
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
