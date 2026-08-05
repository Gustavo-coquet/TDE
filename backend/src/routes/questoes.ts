import { Router } from "express";
import { prisma } from "../db";
import { TEMPLATES } from "../questoes/templates";
import { Rng, hashSeed } from "../rng";

export const questoesRouter = Router();

// GET /api/questoes  -> banco de questões + um preview parametrizado (seed fixa, só para exibição)
questoesRouter.get("/", async (_req, res) => {
  const questoes = await prisma.questao.findMany({ orderBy: { criadoEm: "asc" } });

  const comPreview = questoes.map((q) => {
    const template = TEMPLATES[q.tipo];
    const rng = new Rng(hashSeed(q.id + ":preview"));
    const params = template.gerar(rng);
    return {
      ...q,
      preview: {
        enunciado: template.enunciado(params),
        respostaCorreta: template.respostaCorreta(params),
      },
    };
  });

  res.json(comPreview);
});

// GET /api/questoes/tipos -> tipos de template disponíveis (útil para cadastrar novas questões)
questoesRouter.get("/tipos", async (_req, res) => {
  res.json(
    Object.values(TEMPLATES).map((t) => ({
      tipo: t.tipo,
      tema: t.tema,
      dificuldade: t.dificuldade,
      unidade: t.unidade,
    }))
  );
});
