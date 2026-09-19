import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../asyncHandler";
import { gerarProvaIndividual } from "../randomizacao";

export const alunoExamRouter = Router();

function mapQuestoes(questoes: any[]) {
  return questoes.map((q) => ({
    id: q.id,
    tema: `${q.questao.disciplina} — ${q.questao.assunto}`,
    enunciado: q.enunciadoFinal,
    imagem: q.questao.imagem,
    // grupo do bloco: as questões encadeadas compartilham UMA figura. Só a dona carrega o
    // base64; as outras vêm com imagem nula e o aluno.js acha a figura pelo grupo.
    grupo: q.questao.grupoVariaveis,
    formatoResposta: q.questao.formatoResposta,
    respostaAlunoLetra: q.respostaAlunoLetra,
    alternativas: (q.alternativasFinal as any[]).map((a) => ({ letra: a.letra, campos: a.campos })), // sem "correta"
  }));
}

function prazoEncerrado(provaMestre: { prazoFinal: Date | null }) {
  return !!provaMestre.prazoFinal && new Date() > provaMestre.prazoFinal;
}

// ---------------------------------------------------------------------------------------
// MODO PROFESSOR: na tela do aluno, em vez da matrícula, o professor digita o código mestre
// (PROFESSOR_CODIGO_TDE, ou, se ele não existir, a mesma senha do painel: PROFESSOR_SENHA).
// Funciona em QUALQUER TDE, de qualquer turma, como se o professor estivesse cadastrado.
// A prova de teste fica só na memória do servidor: nada é gravado no banco, não conta
// tentativa de ninguém e não aparece nos Resultados. Cada vez que é finalizada, a próxima
// entrada sorteia uma prova nova (outros valores).
// ---------------------------------------------------------------------------------------
function ehCodigoProfessor(token: string) {
  const codigo = process.env.PROFESSOR_CODIGO_TDE || process.env.PROFESSOR_SENHA;
  return !!codigo && token === codigo;
}

type QuestaoPrevia = {
  id: string;
  ordem: number;
  questao: any;
  enunciadoFinal: string;
  alternativasFinal: any;
  respostaCorretaLetra: string;
  respostaAlunoLetra: string | null;
  correta: boolean | null;
};
type Previa = { tentativa: number; finalizada: boolean; questoes: QuestaoPrevia[] };
const previas = new Map<string, Previa>();

async function gerarPrevia(provaMestreId: string, tentativa: number): Promise<Previa | null> {
  const provaMestre = await prisma.provaMestre.findUnique({
    where: { id: provaMestreId },
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });
  if (!provaMestre) return null;
  const questoesBase = provaMestre.questoes.map((pmq) => ({
    id: pmq.questao.id,
    enunciado: pmq.questao.enunciado,
    variaveis: pmq.questao.variaveis as any,
    etapas: pmq.questao.etapas as any,
    grupoVariaveis: pmq.questao.grupoVariaveis,
  }));
  const marca = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { questoes } = gerarProvaIndividual(`${provaMestreId}:professor:${marca}`, "professor", questoesBase, provaMestre.embaralharQuestoes);
  const porId = new Map<string, any>(provaMestre.questoes.map((pmq) => [pmq.questao.id, pmq.questao] as [string, any]));
  const previa: Previa = {
    tentativa,
    finalizada: false,
    questoes: [...questoes]
      .sort((a, b) => a.ordem - b.ordem)
      .map((q, i) => ({
        id: `professor-${marca}-${i}`,
        ordem: q.ordem,
        questao: porId.get(q.questaoId),
        enunciadoFinal: q.enunciadoFinal,
        alternativasFinal: q.alternativasFinal,
        respostaCorretaLetra: q.respostaCorretaLetra,
        respostaAlunoLetra: null,
        correta: null,
      })),
  };
  if (previas.size > 100) previas.clear(); // só por segurança: é memória, não banco
  previas.set(provaMestreId, previa);
  return previa;
}

async function respostaPrevia(provaMestreId: string, previa: Previa) {
  const provaMestre = await prisma.provaMestre.findUnique({ where: { id: provaMestreId } });
  return {
    estado: "em_andamento",
    modoProfessor: true,
    tentativa: previa.tentativa,
    alunoNome: "Professor(a)",
    tituloProva: provaMestre?.titulo ?? "",
    prazoFinal: provaMestre?.prazoFinal ?? null,
    valor: provaMestre?.valor ?? 10,
    questoes: mapQuestoes(previa.questoes),
  };
}

// GET /api/prova/:provaMestreId/:token -> estado atual do aluno nesse TDE
// :token é a matrícula do aluno. Retorna um destes formatos:
//  { estado: "em_andamento", tentativa, questoes: [...] }               -> aluno está resolvendo (nova ou retomando)
//  { estado: "aguardando_decisao", melhorNota, tentativasFeitas, podeTentarDeNovo } -> já tem tentativa(s) finalizada(s)
alunoExamRouter.get("/:provaMestreId/:token", asyncHandler(async (req, res) => {
  const { provaMestreId, token } = req.params;

  if (ehCodigoProfessor(token)) {
    let previa = previas.get(provaMestreId);
    if (!previa || previa.finalizada) previa = (await gerarPrevia(provaMestreId, 1)) ?? undefined;
    if (!previa) return res.status(404).json({ erro: "TDE não encontrado." });
    return res.json(await respostaPrevia(provaMestreId, previa));
  }

  const provaMestre = await prisma.provaMestre.findUnique({ where: { id: provaMestreId } });
  if (!provaMestre) return res.status(404).json({ erro: "TDE não encontrado." });

  const aluno = await prisma.aluno.findFirst({ where: { turmaId: provaMestre.turmaId, matricula: token } });
  if (!aluno) return res.status(404).json({ erro: "Matrícula não encontrada para este TDE." });

  const tentativas = await prisma.provaIndividual.findMany({
    where: { provaMestreId, alunoId: aluno.id },
    orderBy: { tentativa: "asc" },
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });

  if (tentativas.length === 0) {
    return res.status(404).json({ erro: "Prova não encontrada para este aluno. Fale com o professor(a)." });
  }

  const ativa = tentativas.find((t) => t.status !== "finalizada");

  if (ativa) {
    if (prazoEncerrado(provaMestre) && ativa.status === "gerada") {
      return res.status(403).json({ erro: `O prazo para responder este TDE encerrou em ${provaMestre.prazoFinal!.toLocaleString("pt-BR")}.` });
    }
    if (ativa.status === "gerada") {
      await prisma.provaIndividual.update({ where: { id: ativa.id }, data: { status: "em_andamento", iniciadaEm: new Date() } });
    }
    return res.json({
      estado: "em_andamento",
      tentativa: ativa.tentativa,
      alunoNome: aluno.nome,
      tituloProva: provaMestre.titulo,
      prazoFinal: provaMestre.prazoFinal,
      valor: provaMestre.valor,
      questoes: mapQuestoes(ativa.questoes),
    });
  }

  // todas as tentativas existentes já foram finalizadas
  const notas = tentativas.map((t) => (t.total ? +((t.acertos! / t.total) * provaMestre.valor).toFixed(2) : 0));
  const melhorNota = Math.max(...notas);
  const podeTentarDeNovo = tentativas.length < 2 && !prazoEncerrado(provaMestre);

  res.json({
    estado: "aguardando_decisao",
    alunoNome: aluno.nome,
    tituloProva: provaMestre.titulo,
    tentativasFeitas: tentativas.length,
    valor: provaMestre.valor,
    melhorNota,
    podeTentarDeNovo,
  });
}));

// POST /api/prova/:provaMestreId/:token/nova-tentativa -> gera e inicia a 2ª tentativa
alunoExamRouter.post("/:provaMestreId/:token/nova-tentativa", asyncHandler(async (req, res) => {
  const { provaMestreId, token } = req.params;

  if (ehCodigoProfessor(token)) {
    const anterior = previas.get(provaMestreId);
    const previa = await gerarPrevia(provaMestreId, anterior ? Math.min(anterior.tentativa + 1, 2) : 1);
    if (!previa) return res.status(404).json({ erro: "TDE não encontrado." });
    return res.json(await respostaPrevia(provaMestreId, previa));
  }

  const provaMestre = await prisma.provaMestre.findUnique({
    where: { id: provaMestreId },
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });
  if (!provaMestre) return res.status(404).json({ erro: "TDE não encontrado." });
  if (prazoEncerrado(provaMestre)) {
    return res.status(403).json({ erro: `O prazo para responder este TDE encerrou em ${provaMestre.prazoFinal!.toLocaleString("pt-BR")}.` });
  }

  const aluno = await prisma.aluno.findFirst({ where: { turmaId: provaMestre.turmaId, matricula: token } });
  if (!aluno) return res.status(404).json({ erro: "Matrícula não encontrada." });

  const tentativasExistentes = await prisma.provaIndividual.findMany({ where: { provaMestreId, alunoId: aluno.id } });
  if (tentativasExistentes.length >= 2) return res.status(400).json({ erro: "Você já usou as duas tentativas permitidas para este TDE." });
  if (tentativasExistentes.some((t) => t.status !== "finalizada")) {
    return res.status(400).json({ erro: "Finalize a tentativa em andamento antes de iniciar outra." });
  }

  const proximaTentativa = tentativasExistentes.length + 1;
  const questoesBase = provaMestre.questoes.map((pmq) => ({
    id: pmq.questao.id,
    enunciado: pmq.questao.enunciado,
    variaveis: pmq.questao.variaveis as any,
    etapas: pmq.questao.etapas as any,
    grupoVariaveis: pmq.questao.grupoVariaveis,
  }));

  // seed diferente da 1ª tentativa, pra sortear outros valores — mas continua determinística/auditável
  const { seed, questoes } = gerarProvaIndividual(`${provaMestreId}:t${proximaTentativa}`, aluno.id, questoesBase, provaMestre.embaralharQuestoes);

  const novaProva = await prisma.provaIndividual.create({
    data: {
      provaMestreId,
      alunoId: aluno.id,
      tentativa: proximaTentativa,
      seed,
      qrToken: aluno.matricula,
      status: "em_andamento",
      iniciadaEm: new Date(),
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
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });

  res.json({
    estado: "em_andamento",
    tentativa: proximaTentativa,
    alunoNome: aluno.nome,
    tituloProva: provaMestre.titulo,
    prazoFinal: provaMestre.prazoFinal,
    valor: provaMestre.valor,
    questoes: mapQuestoes(novaProva.questoes),
  });
}));

// POST /api/prova/:provaMestreId/:token/responder  { provaIndividualQuestaoId, letra }
alunoExamRouter.post("/:provaMestreId/:token/responder", asyncHandler(async (req, res) => {
  const { provaMestreId, token } = req.params;
  const { provaIndividualQuestaoId, letra } = req.body;

  if (ehCodigoProfessor(token)) {
    const previa = previas.get(provaMestreId);
    const q = previa && !previa.finalizada ? previa.questoes.find((x) => x.id === provaIndividualQuestaoId) : undefined;
    if (!q) return res.status(400).json({ erro: "A prova de teste expirou (o servidor reiniciou). Recarregue a página." });
    q.respostaAlunoLetra = letra;
    q.correta = letra === q.respostaCorretaLetra;
    return res.json({ ok: true });
  }

  const provaMestre = await prisma.provaMestre.findUnique({ where: { id: provaMestreId } });
  if (!provaMestre) return res.status(404).json({ erro: "TDE não encontrado." });

  const aluno = await prisma.aluno.findFirst({ where: { turmaId: provaMestre.turmaId, matricula: token } });
  if (!aluno) return res.status(404).json({ erro: "Matrícula não encontrada." });

  const ativa = await prisma.provaIndividual.findFirst({ where: { provaMestreId, alunoId: aluno.id, status: { not: "finalizada" } } });
  if (!ativa) return res.status(400).json({ erro: "Nenhuma tentativa em andamento encontrada." });

  const questao = await prisma.provaIndividualQuestao.findUnique({ where: { id: provaIndividualQuestaoId } });
  if (!questao || questao.provaIndividualId !== ativa.id) {
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

  if (ehCodigoProfessor(token)) {
    const previa = previas.get(provaMestreId);
    if (!previa || previa.finalizada) return res.status(404).json({ erro: "A prova de teste expirou (o servidor reiniciou). Recarregue a página." });
    const pm = await prisma.provaMestre.findUnique({ where: { id: provaMestreId } });
    const valor = pm?.valor ?? 10;
    previa.finalizada = true;
    const acertos = previa.questoes.filter((q) => q.correta === true).length;
    const total = previa.questoes.length;
    return res.json({
      modoProfessor: true,
      tentativa: previa.tentativa,
      acertos,
      total,
      percentual: total ? Math.round((acertos / total) * 100) : 0,
      valor,
      notaPontos: total ? +((acertos / total) * valor).toFixed(2) : 0,
      prazoFinal: pm?.prazoFinal ?? null,
      podeTentarDeNovo: true,
      detalhe: previa.questoes.map((q) => ({
        tema: `${q.questao.disciplina} — ${q.questao.assunto}`,
        enunciado: q.enunciadoFinal,
        formatoResposta: q.questao.formatoResposta,
        alternativas: (q.alternativasFinal as any[]).map((a) => ({ letra: a.letra, campos: a.campos })),
        respostaAlunoLetra: q.respostaAlunoLetra,
        respostaCorretaLetra: q.respostaCorretaLetra,
        correta: q.correta,
      })),
    });
  }

  const provaMestre = await prisma.provaMestre.findUnique({ where: { id: provaMestreId } });
  if (!provaMestre) return res.status(404).json({ erro: "TDE não encontrado." });

  const aluno = await prisma.aluno.findFirst({ where: { turmaId: provaMestre.turmaId, matricula: token } });
  if (!aluno) return res.status(404).json({ erro: "Matrícula não encontrada." });

  const ativa = await prisma.provaIndividual.findFirst({
    where: { provaMestreId, alunoId: aluno.id, status: { not: "finalizada" } },
    include: { questoes: { include: { questao: true }, orderBy: { ordem: "asc" } } },
  });
  if (!ativa) return res.status(404).json({ erro: "Nenhuma tentativa em andamento encontrada." });

  const acertos = ativa.questoes.filter((q) => q.correta === true).length;
  const total = ativa.questoes.length;

  await prisma.provaIndividual.update({
    where: { id: ativa.id },
    data: { status: "finalizada", finalizadaEm: new Date(), acertos, total },
  });

  const totalTentativas = await prisma.provaIndividual.count({ where: { provaMestreId, alunoId: aluno.id } });
  const podeTentarDeNovo = ativa.tentativa < 2 && totalTentativas < 2 && !prazoEncerrado(provaMestre);
  const notaPontos = total ? +((acertos / total) * provaMestre.valor).toFixed(2) : 0;

  res.json({
    tentativa: ativa.tentativa,
    acertos,
    total,
    percentual: total ? Math.round((acertos / total) * 100) : 0,
    valor: provaMestre.valor,
    notaPontos,
    prazoFinal: provaMestre.prazoFinal,
    podeTentarDeNovo,
    detalhe: ativa.questoes.map((q) => ({
      tema: `${q.questao.disciplina} — ${q.questao.assunto}`,
      enunciado: q.enunciadoFinal,
      formatoResposta: q.questao.formatoResposta,
      alternativas: (q.alternativasFinal as any[]).map((a) => ({ letra: a.letra, campos: a.campos })),
      respostaAlunoLetra: q.respostaAlunoLetra,
      respostaCorretaLetra: q.respostaCorretaLetra,
      correta: q.correta,
    })),
  });
}));
