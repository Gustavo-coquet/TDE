// NOTA: o seed automático de questões agora acontece sozinho, sempre que o
// servidor liga (ver garantirDadosIniciais em src/index.ts) — necessário
// porque o Shell do Render (onde este script rodaria manualmente) só existe
// em planos pagos. Este arquivo fica apenas como referência/uso local.
import { PrismaClient } from "@prisma/client";
import { QUESTOES_PADRAO } from "../src/questoes/padrao";

const prisma = new PrismaClient();

async function main() {
  console.log("Cadastrando banco de questões padrão (se ainda não existir)...");
  const total = await prisma.questao.count();
  if (total === 0) {
    for (const q of QUESTOES_PADRAO) {
      await prisma.questao.create({
        data: {
          tema: q.tema,
          dificuldade: q.dificuldade,
          enunciado: q.enunciado,
          variaveis: q.variaveis as any,
          etapas: q.etapas as any,
        },
      });
    }
  }
  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
