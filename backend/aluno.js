import { Router } from "express";
import { prisma } from "../db";
import { Rng, hashSeed } from "../rng";
import { avaliarExpressao } from "../questoes/expressao";
import { gerarValores, montarEnunciado, gerarAlternativas, VariavelDb } from "../randomizacao";
import { asyncHandler } from "../asyncHandler";

export const questoesRouter = Router();

// GET /api/questoes  -> banco de questões + um preview parametrizado (seed fixa, só para exibição)
questoesRouter.get("/", asyncHandler(async (_req, res) => {
  const questoes = await prisma.questao.findMany({ orderBy: { criadoEm: "asc" } });

  const comPreview = questoes.map((q) => {
    const variaveis = q.variaveis as unknown as VariavelDb[];
    const rng = new Rng(hashSeed(q.id + ":preview"));
    let preview: any;
    try {
      const valores = gerarValores(variaveis, rng);
      const respostaCorreta = Math.round(avaliarExpressao(q.formula, valores) * 100) / 100;
      preview = { enunciado: montarEnunciado(q.enunciado, valores), respostaCorreta, erro: null };
    } catch (e: any) {
      preview = { enunciado: q.enunciado, respostaCorreta: null, erro: e.message };
    }
    return { ...q, preview };
  });

  res.json(comPreview);
}));

// POST /api/questoes/testar -> valida e gera um exemplo, SEM salvar no banco
// body: { enunciado, variaveis, formula, unidade }
questoesRouter.post("/testar", asyncHandler(async (req, res) => {
  const { enunciado, variaveis, formula } = req.body;
  if (!enunciado || !formula || !Array.isArray(variaveis) || variaveis.length === 0) {
    return res.status(400).json({ erro: "Preencha enunciado, variáveis e fórmula." });
  }
  try {
    const rng = new Rng(Date.now() % 100000 + 1);
    const valores = gerarValores(variaveis, rng);
    const respostaCorreta = Math.round(avaliarExpressao(formula, valores) * 100) / 100;
    res.json({ enunciado: montarEnunciado(enunciado, valores), respostaCorreta });
  } catch (e: any) {
    res.status(400).json({ erro: e.message });
  }
}));

// POST /api/questoes -> cadastrar nova questão parametrizada
// body: { tema, dificuldade, unidade, enunciado, variaveis: [{nome,min,max,decimais}], formula }
questoesRouter.post("/", asyncHandler(async (req, res) => {
  const { tema, dificuldade, unidade, enunciado, variaveis, formula } = req.body;

  if (!tema || !unidade || !enunciado || !formula || !Array.isArray(variaveis) || variaveis.length === 0) {
    return res.status(400).json({ erro: "tema, unidade, enunciado, fórmula e ao menos uma variável são obrigatórios." });
  }

  // valida a fórmula gerando um exemplo antes de salvar, para não deixar questão quebrada no banco
  try {
    const rngTeste = new Rng(Date.now() % 100000 + 1);
    const valoresTeste = gerarValores(variaveis, rngTeste);
    avaliarExpressao(formula, valoresTeste);
  } catch (e: any) {
    return res.status(400).json({ erro: `Fórmula ou variáveis inválidas: ${e.message}` });
  }

  const questao = await prisma.questao.create({
    data: {
      tema,
      dificuldade: Number(dificuldade) || 1,
      unidade,
      enunciado,
      variaveis,
      formula,
    },
  });

  res.status(201).json(questao);
}));

// DELETE /api/questoes/:id
questoesRouter.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.questao.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ erro: "Não foi possível remover: essa questão já está em uso em alguma Prova-Mestre." });
  }
}));
