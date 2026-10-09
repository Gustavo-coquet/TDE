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

// GET /api/turmas/:id/exportar-resultados -> matriz nome x TDE com a nota de cada aluno.
// Para cada aluno: nota = notaManual se houver, senao a MAIOR nota entre tentativas finalizadas.
turmasRouter.get("/:id/exportar-resultados", asyncHandler(async (req, res) => {
  const { id } = req.params;

  const turma = await prisma.turma.findUnique({ where: { id } });
  if (!turma) return res.status(404).json({ erro: "Turma nao encontrada." });

  const [alunos, provas] = await Promise.all([
    prisma.aluno.findMany({ where: { turmaId: id }, orderBy: { nome: "asc" } }),
    prisma.provaMestre.findMany({
      where: { turmaId: id, status: "publicada" },
      orderBy: [{ ordem: { sort: "asc", nulls: "last" } }, { criadoEm: "asc" }],
      include: {
        provasIndividuais: {
          include: { questoes: { select: { respostaAlunoLetra: true } } },
        },
      },
    }),
  ]);

  // mapa (provaMestreId, alunoId) -> nota final (ou null)
  const nota = new Map<string, number | null>();
  for (const prova of provas) {
    const porAluno = new Map<string, typeof prova.provasIndividuais>();
    for (const pi of prova.provasIndividuais) {
      if (!porAluno.has(pi.alunoId)) porAluno.set(pi.alunoId, []);
      porAluno.get(pi.alunoId)!.push(pi);
    }
    for (const [alunoId, tentativas] of porAluno) {
      const comManual = tentativas.find((t) => t.notaManual !== null && t.notaManual !== undefined);
      let melhor: number | null = null;
      for (const t of tentativas) {
        if (t.status !== "finalizada" || !t.total) continue;
        const n = (t.acertos! / t.total!) * prova.valor;
        if (melhor === null || n > melhor) melhor = n;
      }
      const final = comManual ? comManual.notaManual! : (melhor !== null ? +melhor.toFixed(2) : null);
      nota.set(prova.id + ":" + alunoId, final);
    }
  }

  res.json({
    turmaNome: turma.nome,
    tdes: provas.map((p) => ({ id: p.id, titulo: p.titulo, valor: p.valor, grupoAvaliacao: p.grupoAvaliacao })),
    alunos: alunos.map((a) => ({
      matricula: a.matricula,
      nome: a.nome,
      notas: provas.map((p) => (nota.has(p.id + ":" + a.id) ? nota.get(p.id + ":" + a.id) : null)),
      acertosAV1: (a as any).acertosAV1 ?? null,
      notaAV2: (a as any).notaAV2 ?? null,
    })),
  });
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

// PUT /api/turmas/:id  { nome } -> renomeia a turma
turmasRouter.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ erro: "Informe o nome da turma." });
  }
  const turma = await prisma.turma.update({ where: { id }, data: { nome: String(nome).trim() } });
  res.json(turma);
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
