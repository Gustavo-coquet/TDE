import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../asyncHandler";
import { gerarProvaIndividual } from "../randomizacao";

export const provasRouter = Router();

// GET /api/provas-mestre?turmaId=xxx -> lista todas as provas-mestre (ou só de uma turma)
provasRouter.get("/", asyncHandler(async (req, res) => {
  const { turmaId } = req.query as { turmaId?: string };
  const provas = await prisma.provaMestre.findMany({
    where: turmaId ? { turmaId } : undefined,
    orderBy: { criadoEm: "desc" },
    include: {
      questoes: true,
      provasIndividuais: true,
      turma: true,
    },
  });

  res.json(
    provas.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      turmaId: p.turmaId,
      turmaNome: p.turma.nome,
      valor: p.valor,
      prazoFinal: p.prazoFinal,
      status: p.status,
      criadoEm: p.criadoEm,
      totalQuestoes: p.questoes.length,
      totalAlunos: new Set(p.provasIndividuais.map((pi) => pi.alunoId)).size,
    }))
  );
}));

// POST /api/provas-mestre  { titulo, turmaId, valor, prazoFinal, questaoIds: string[] }
// valor = quantos pontos o TDE vale (padrão 10); prazoFinal é opcional (ISO string).
provasRouter.post("/", asyncHandler(async (req, res) => {
  const { titulo, turmaId, valor, prazoFinal, questaoIds } = req.body;

  if (!titulo || !turmaId || !Array.isArray(questaoIds) || questaoIds.length === 0) {
    return res.status(400).json({ erro: "titulo, turmaId e questaoIds (não vazio) são obrigatórios." });
  }

  const provaMestre = await prisma.provaMestre.create({
    data: {
      titulo,
      turmaId,
      valor: valor !== undefined && valor !== null && valor !== "" ? Number(valor) : 10,
      prazoFinal: prazoFinal ? new Date(prazoFinal) : null,
      questoes: {
        create: questaoIds.map((questaoId: string, ordem: number) => ({ questaoId, ordem })),
      },
    },
    include: { questoes: true },
  });

  res.status(201).json(provaMestre);
}));

// POST /api/provas-mestre/:id/publicar   body: { alunoIds: string[] }
// Gera a 1ª tentativa (randomizada e parametrizada) para cada aluno escolhido.
// Esse é o passo que materializa a garantia de equivalência: mesmo conjunto de
// questões para todos, só ordem/valores/alternativas mudam.
provasRouter.post("/:id/publicar", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { alunoIds } = req.body as { alunoIds?: string[] };

  const provaMestre = await prisma.provaMestre.findUnique({
    where: { id },
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });
  if (!provaMestre) return res.status(404).json({ erro: "TDE não encontrado." });
  if (provaMestre.status === "publicada") return res.status(400).json({ erro: "Este TDE já foi publicado." });

  if (!Array.isArray(alunoIds) || alunoIds.length === 0) {
    return res.status(400).json({ erro: "Selecione ao menos um aluno para gerar as provas." });
  }

  const alunos = await prisma.aluno.findMany({ where: { id: { in: alunoIds } }, orderBy: { nome: "asc" } });
  const questoesBase = provaMestre.questoes.map((pmq) => ({
    id: pmq.questao.id,
    enunciado: pmq.questao.enunciado,
    variaveis: pmq.questao.variaveis as any,
    etapas: pmq.questao.etapas as any,
  }));

  const provasCriadas: { alunoId: string; alunoNome: string; qrToken: string }[] = [];

  for (const aluno of alunos) {
    const { seed, questoes } = gerarProvaIndividual(provaMestre.id, aluno.id, questoesBase);

    const provaIndividual = await prisma.provaIndividual.create({
      data: {
        provaMestreId: provaMestre.id,
        alunoId: aluno.id,
        tentativa: 1,
        seed,
        qrToken: aluno.matricula,
        questoes: {
          create: questoes.map((q) => ({
            questao: { connect: { id: q.questaoId } },
            ordem: q.ordem,
            parametrosGerados: q.parametrosGerados as any,
            enunciadoFinal: q.enunciadoFinal,
            alternativasFinal: q.alternativasFinal as any,
            respostaCorretaLetra: q.respostaCorretaLetra,
          })),
        },
      },
    });

    provasCriadas.push({ alunoId: aluno.id, alunoNome: aluno.nome, qrToken: provaIndividual.qrToken });
  }

  await prisma.provaMestre.update({ where: { id }, data: { status: "publicada" } });

  res.json({ provaMestreId: id, totalGeradas: provasCriadas.length, provas: provasCriadas });
}));

// GET /api/provas-mestre/:id/resultados
// Cada aluno pode ter até 2 tentativas — o resultado mostrado é sempre a MAIOR nota entre elas.
provasRouter.get("/:id/resultados", asyncHandler(async (req, res) => {
  const { id } = req.params;

  const provaMestre = await prisma.provaMestre.findUnique({ where: { id } });
  if (!provaMestre) return res.status(404).json({ erro: "TDE não encontrado." });
  const valor = provaMestre.valor;

  const provasIndividuais = await prisma.provaIndividual.findMany({
    where: { provaMestreId: id },
    include: { aluno: true, questoes: { include: { questao: true } } },
    orderBy: { tentativa: "asc" },
  });

  const porAluno = new Map<string, typeof provasIndividuais>();
  for (const pi of provasIndividuais) {
    if (!porAluno.has(pi.alunoId)) porAluno.set(pi.alunoId, []);
    porAluno.get(pi.alunoId)!.push(pi);
  }

  const linhas = Array.from(porAluno.values()).map((tentativas) => {
    const primeira = tentativas[0];
    const finalizadas = tentativas.filter((t) => t.status === "finalizada" && t.total);

    let melhor: (typeof tentativas)[number] | null = null;
    let melhorNota = -1;
    for (const t of finalizadas) {
      const nota = (t.acertos! / t.total!) * valor;
      if (nota > melhorNota) { melhorNota = nota; melhor = t; }
    }

    const emAndamento = tentativas.some((t) => t.status !== "finalizada");
    const status = finalizadas.length > 0 ? "finalizada" : (emAndamento ? "em_andamento" : "gerada");
    const respondidas = tentativas.reduce((acc, t) => acc + t.questoes.filter((q) => q.respostaAlunoLetra !== null).length, 0);

    return {
      alunoId: primeira.alunoId,
      alunoNome: primeira.aluno.nome,
      matricula: primeira.aluno.matricula,
      status,
      acertos: melhor?.acertos ?? null,
      total: melhor?.total ?? null,
      nota: melhor ? +melhorNota.toFixed(2) : null,
      tentativasFeitas: finalizadas.length,
      respondidas,
    };
  });

  const finalizadas = linhas.filter((l) => l.nota !== null);
  const notas = finalizadas.map((l) => l.nota as number);

  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const sorted = [...notas].sort((a, b) => a - b);
  const mediana = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const desvio =
    notas.length && media !== null
      ? Math.sqrt(notas.reduce((acc, n) => acc + (n - media) ** 2, 0) / notas.length)
      : null;

  // ranking de questões com maior índice de erro (considera todas as tentativas respondidas)
  const erroPorQuestao: Record<string, { tema: string; erros: number; total: number }> = {};
  for (const pi of provasIndividuais) {
    for (const q of pi.questoes) {
      if (q.respostaAlunoLetra === null) continue;
      const key = q.questaoId;
      if (!erroPorQuestao[key]) erroPorQuestao[key] = { tema: `${q.questao.disciplina} — ${q.questao.assunto}`, erros: 0, total: 0 };
      erroPorQuestao[key].total++;
      if (q.correta === false) erroPorQuestao[key].erros++;
    }
  }
  const rankingErros = Object.values(erroPorQuestao)
    .map((e) => ({ tema: e.tema, percentualErro: e.total ? Math.round((e.erros / e.total) * 100) : 0 }))
    .sort((a, b) => b.percentualErro - a.percentualErro);

  res.json({
    valor,
    media: media !== null ? +media.toFixed(2) : null,
    mediana,
    desvioPadrao: desvio !== null ? +desvio.toFixed(2) : null,
    totalAlunos: linhas.length,
    totalFinalizadas: finalizadas.length,
    alunos: linhas,
    rankingErros,
  });
}));

// GET /api/provas-mestre/:id/links -> rever os links/matrículas dos alunos deste TDE
provasRouter.get("/:id/links", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const provas = await prisma.provaIndividual.findMany({
    where: { provaMestreId: id, tentativa: 1 },
    include: { aluno: true },
    orderBy: { aluno: { nome: "asc" } },
  });
  res.json(provas.map((p) => ({ alunoId: p.alunoId, alunoNome: p.aluno.nome, qrToken: p.qrToken, status: p.status })));
}));

// POST /api/provas-mestre/:id/adicionar-alunos   body: { alunoIds: string[] }
// Gera a prova (tentativa 1) pra alunos que foram matriculados DEPOIS do TDE já ter sido publicado.
// Ignora silenciosamente quem já tinha prova gerada (não duplica).
provasRouter.post("/:id/adicionar-alunos", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { alunoIds } = req.body as { alunoIds?: string[] };

  const provaMestre = await prisma.provaMestre.findUnique({
    where: { id },
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });
  if (!provaMestre) return res.status(404).json({ erro: "TDE não encontrado." });
  if (provaMestre.status !== "publicada") return res.status(400).json({ erro: "Este TDE ainda não foi publicado." });
  if (!Array.isArray(alunoIds) || alunoIds.length === 0) {
    return res.status(400).json({ erro: "Selecione ao menos um aluno." });
  }

  const jaTem = await prisma.provaIndividual.findMany({
    where: { provaMestreId: id, alunoId: { in: alunoIds } },
    select: { alunoId: true },
  });
  const idsComProva = new Set(jaTem.map((j) => j.alunoId));
  const novosIds = alunoIds.filter((aid) => !idsComProva.has(aid));

  if (novosIds.length === 0) {
    return res.json({ adicionados: 0, provas: [] });
  }

  const alunos = await prisma.aluno.findMany({ where: { id: { in: novosIds } }, orderBy: { nome: "asc" } });
  const questoesBase = provaMestre.questoes.map((pmq) => ({
    id: pmq.questao.id,
    enunciado: pmq.questao.enunciado,
    variaveis: pmq.questao.variaveis as any,
    etapas: pmq.questao.etapas as any,
  }));

  const provasCriadas: { alunoId: string; alunoNome: string; qrToken: string }[] = [];
  for (const aluno of alunos) {
    const { seed, questoes } = gerarProvaIndividual(provaMestre.id, aluno.id, questoesBase);
    const provaIndividual = await prisma.provaIndividual.create({
      data: {
        provaMestreId: provaMestre.id,
        alunoId: aluno.id,
        tentativa: 1,
        seed,
        qrToken: aluno.matricula,
        questoes: {
          create: questoes.map((q) => ({
            questao: { connect: { id: q.questaoId } },
            ordem: q.ordem,
            parametrosGerados: q.parametrosGerados as any,
            enunciadoFinal: q.enunciadoFinal,
            alternativasFinal: q.alternativasFinal as any,
            respostaCorretaLetra: q.respostaCorretaLetra,
          })),
        },
      },
    });
    provasCriadas.push({ alunoId: aluno.id, alunoNome: aluno.nome, qrToken: provaIndividual.qrToken });
  }

  res.json({ adicionados: provasCriadas.length, provas: provasCriadas });
}));

// PUT /api/provas-mestre/:id/prazo   body: { prazoFinal: string | null }
// Edita só o prazo final de um TDE (mesmo já publicado, mesmo com alunos já respondendo).
// Não mexe nas provas individuais já geradas — só muda a data limite pra novas respostas.
provasRouter.put("/:id/prazo", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { prazoFinal } = req.body as { prazoFinal?: string | null };

  const provaMestre = await prisma.provaMestre.findUnique({ where: { id } });
  if (!provaMestre) return res.status(404).json({ erro: "TDE não encontrado." });

  const atualizado = await prisma.provaMestre.update({
    where: { id },
    data: { prazoFinal: prazoFinal ? new Date(prazoFinal) : null },
  });

  res.json({ id: atualizado.id, prazoFinal: atualizado.prazoFinal });
}));

// DELETE /api/provas-mestre/:id -> apaga o TDE e tudo que depende dele
// (provas individuais geradas, respostas dos alunos)
provasRouter.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.$transaction([
    prisma.provaIndividualQuestao.deleteMany({ where: { provaIndividual: { provaMestreId: id } } }),
    prisma.provaIndividual.deleteMany({ where: { provaMestreId: id } }),
    prisma.provaMestreQuestao.deleteMany({ where: { provaMestreId: id } }),
    prisma.provaMestre.delete({ where: { id } }),
  ]);

  res.json({ ok: true });
}));
