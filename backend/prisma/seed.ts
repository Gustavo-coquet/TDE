import { PrismaClient } from "@prisma/client";
import { TEMPLATES } from "../src/questoes/templates";

const prisma = new PrismaClient();

async function main() {
  console.log("Limpando dados existentes...");
  await prisma.provaIndividualQuestao.deleteMany();
  await prisma.provaIndividual.deleteMany();
  await prisma.provaMestreQuestao.deleteMany();
  await prisma.provaMestre.deleteMany();
  await prisma.questao.deleteMany();
  await prisma.aluno.deleteMany();

  console.log("Cadastrando banco de questões...");
  for (const t of Object.values(TEMPLATES)) {
    await prisma.questao.create({
      data: { tema: t.tema, dificuldade: t.dificuldade, tipo: t.tipo, unidade: t.unidade },
    });
  }

  console.log("Cadastrando turma de alunos...");
  const nomes = [
    "Ana Beatriz Souza", "Bruno Carvalho", "Camila Ferreira", "Diego Martins",
    "Elisa Nogueira", "Felipe Ramos", "Gabriela Lopes", "Henrique Alves",
  ];
  for (const nome of nomes) {
    await prisma.aluno.create({ data: { nome } });
  }

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
