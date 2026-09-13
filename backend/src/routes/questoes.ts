import { Router } from "express";
import { prisma } from "../db";
import { Rng, hashSeed } from "../rng";
import { resolverEtapas, montarEnunciado, gerarAlternativasParaQuestao, VariavelDb, EtapaDb } from "../randomizacao";
import { asyncHandler } from "../asyncHandler";

export const questoesRouter = Router();

function preview(enunciadoTemplate: string, variaveis: VariavelDb[], etapas: EtapaDb[], seed: number) {
  const rng = new Rng(seed);
  const valores = resolverEtapas(variaveis, etapas, rng);
  const enunciado = montarEnunciado(enunciadoTemplate, valores);
  const saidas = etapas.filter((e) => e.saida).map((e) => ({ nome: e.nome, unidade: e.unidade, valor: valores[e.nome] }));
  const alternativas = gerarAlternativasParaQuestao(etapas, valores, rng);
  return { enunciado, saidas, alternativas };
}

// GET /api/questoes  -> banco de questões + um preview parametrizado (seed fixa, só para exibição)
questoesRouter.get("/", asyncHandler(async (_req, res) => {
  const questoes = await prisma.questao.findMany({ orderBy: { criadoEm: "asc" } });

  const comPreview = questoes.map((q) => {
    const variaveis = q.variaveis as unknown as VariavelDb[];
    const etapas = q.etapas as unknown as EtapaDb[];
    let p: any;
    try {
      p = { ...preview(q.enunciado, variaveis, etapas, hashSeed(q.id + ":preview")), erro: null };
    } catch (e: any) {
      p = { enunciado: q.enunciado, saidas: [], alternativas: [], erro: e.message };
    }
    return { ...q, preview: p };
  });

  res.json(comPreview);
}));

// POST /api/questoes/testar -> valida e gera um exemplo completo, SEM salvar no banco
// body: { enunciado, variaveis, etapas }
questoesRouter.post("/testar", asyncHandler(async (req, res) => {
  const { enunciado, variaveis, etapas } = req.body;
  if (!enunciado || !Array.isArray(variaveis) || variaveis.length === 0 || !Array.isArray(etapas) || etapas.length === 0) {
    return res.status(400).json({ erro: "Preencha enunciado, ao menos uma variável e ao menos uma etapa." });
  }
  if (!etapas.some((e: EtapaDb) => e.saida)) {
    return res.status(400).json({ erro: "Marque ao menos uma etapa como \"saída\" (resposta mostrada ao aluno)." });
  }
  try {
    const resultado = preview(enunciado, variaveis, etapas, Date.now() % 100000 + 1);
    res.json(resultado);
  } catch (e: any) {
    res.status(400).json({ erro: e.message });
  }
}));

// POST /api/questoes -> cadastrar nova questão parametrizada
// body: { disciplina, assunto, dificuldade, enunciado, variaveis: [{nome,min,max,decimais}], etapas: [{nome,formula,decimais,unidade,saida}] }
questoesRouter.post("/", asyncHandler(async (req, res) => {
  const { disciplina, assunto, dificuldade, enunciado, variaveis, etapas, imagem, formatoResposta, grupoVariaveis } = req.body;

  if (!disciplina || !assunto || !enunciado || !Array.isArray(variaveis) || variaveis.length === 0 || !Array.isArray(etapas) || etapas.length === 0) {
    return res.status(400).json({ erro: "disciplina, assunto, enunciado, ao menos uma variável e ao menos uma etapa são obrigatórios." });
  }
  if (!etapas.some((e: EtapaDb) => e.saida)) {
    return res.status(400).json({ erro: "Marque ao menos uma etapa como \"saída\" (resposta mostrada ao aluno)." });
  }

  // valida gerando um exemplo antes de salvar, para não deixar questão quebrada no banco
  try {
    preview(enunciado, variaveis, etapas, Date.now() % 100000 + 1);
  } catch (e: any) {
    return res.status(400).json({ erro: `Fórmulas ou variáveis inválidas: ${e.message}` });
  }

  const questao = await prisma.questao.create({
    data: {
      disciplina,
      assunto,
      dificuldade: Number(dificuldade) || 1,
      enunciado,
      variaveis,
      etapas,
      imagem: imagem || null,
      formatoResposta: formatoResposta || null,
      grupoVariaveis: grupoVariaveis || null,
    },
  });

  res.status(201).json(questao);
}));

// PUT /api/questoes/:id -> edita uma questão existente
// body: { disciplina, assunto, dificuldade, enunciado, variaveis, etapas }
questoesRouter.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { disciplina, assunto, dificuldade, enunciado, variaveis, etapas, imagem, formatoResposta, grupoVariaveis } = req.body;

  if (!disciplina || !assunto || !enunciado || !Array.isArray(variaveis) || variaveis.length === 0 || !Array.isArray(etapas) || etapas.length === 0) {
    return res.status(400).json({ erro: "disciplina, assunto, enunciado, ao menos uma variável e ao menos uma etapa são obrigatórios." });
  }
  if (!etapas.some((e: EtapaDb) => e.saida)) {
    return res.status(400).json({ erro: "Marque ao menos uma etapa como \"saída\" (resposta mostrada ao aluno)." });
  }

  try {
    preview(enunciado, variaveis, etapas, Date.now() % 100000 + 1);
  } catch (e: any) {
    return res.status(400).json({ erro: `Fórmulas ou variáveis inválidas: ${e.message}` });
  }

  const questao = await prisma.questao.update({
    where: { id },
    data: {
      disciplina,
      assunto,
      dificuldade: Number(dificuldade) || 1,
      enunciado,
      variaveis,
      etapas,
      imagem: imagem === undefined ? undefined : (imagem || null),
      formatoResposta: formatoResposta === undefined ? undefined : (formatoResposta || null),
      grupoVariaveis: grupoVariaveis === undefined ? undefined : (grupoVariaveis || null),
    },
  });

  // Um bloco (mesmo grupoVariaveis) e um unico exercicio dividido em varias perguntas:
  // disciplina e assunto valem para o bloco inteiro. Ao editar qualquer questao do bloco,
  // as irmas acompanham, senao o bloco aparece quebrado em assuntos diferentes na listagem.
  let irmasAtualizadas = 0;
  if (questao.grupoVariaveis) {
    const r = await prisma.questao.updateMany({
      where: { grupoVariaveis: questao.grupoVariaveis, id: { not: questao.id } },
      data: { disciplina: questao.disciplina, assunto: questao.assunto },
    });
    irmasAtualizadas = r.count;
  }

  res.json({ ...questao, irmasAtualizadas });
}));

// DELETE /api/questoes/:id
questoesRouter.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.questao.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ erro: "Não foi possível remover: essa questão já está em uso em algum TDE." });
  }
}));
