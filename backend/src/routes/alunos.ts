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

// POST /api/alunos  { turmaId, alunos: [{ nome, matricula }] } -> matricula um ou vários alunos numa turma
alunosRouter.post("/", asyncHandler(async (req, res) => {
  const { turmaId, alunos } = req.body;
  if (!turmaId) return res.status(400).json({ erro: "turmaId é obrigatório." });
  if (!Array.isArray(alunos) || alunos.length === 0) {
    return res.status(400).json({ erro: "Informe ao menos um aluno." });
  }

  const criados: any[] = [];
  const erros: string[] = [];

  for (const a of alunos) {
    const nome = String(a?.nome || "").trim();
    const matricula = String(a?.matricula || "").trim();
    if (!nome || !matricula) {
      erros.push(`Linha ignorada (faltou nome ou matrícula): "${a?.nome || ""}" / "${a?.matricula || ""}"`);
      continue;
    }
    try {
      const aluno = await prisma.aluno.create({ data: { nome, matricula, turmaId } });
      criados.push(aluno);
    } catch (e: any) {
      if (e.code === "P2002") {
        erros.push(`${nome} (matrícula ${matricula}) já existe nessa turma — ignorado.`);
      } else {
        throw e;
      }
    }
  }

  res.status(201).json({ criados, erros });
}));

// DELETE /api/alunos/:id   body opcional: { senha }
// Se o aluno já tem TDEs respondidos, exige a senha do professor pra confirmar
// (apaga em cascata: respostas, provas individuais, e por fim o aluno).
alunosRouter.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { senha } = (req.body || {}) as { senha?: string };

  const totalProvas = await prisma.provaIndividual.count({ where: { alunoId: id } });

  if (totalProvas > 0) {
    const senhaEsperada = process.env.PROFESSOR_SENHA;
    if (senhaEsperada && senha !== senhaEsperada) {
      return res.status(403).json({ erro: "Senha incorreta. Este aluno já respondeu algum TDE — a exclusão foi bloqueada." });
    }
    await prisma.$transaction([
      prisma.provaIndividualQuestao.deleteMany({ where: { provaIndividual: { alunoId: id } } }),
      prisma.provaIndividual.deleteMany({ where: { alunoId: id } }),
      prisma.aluno.delete({ where: { id } }),
    ]);
    return res.json({ ok: true, historicoApagado: true });
  }

  try {
    await prisma.aluno.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ erro: "Não foi possível remover este aluno." });
  }
}));
