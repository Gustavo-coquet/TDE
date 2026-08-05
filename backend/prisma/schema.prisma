generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Aluno {
  id             String           @id @default(uuid())
  nome           String
  criadoEm       DateTime         @default(now())
  provasIndividuais ProvaIndividual[]
}

model Questao {
  id           String   @id @default(uuid())
  tema         String
  dificuldade  Int
  unidade      String
  enunciado    String                        // template com placeholders {NOME}
  variaveis    Json                           // [{ nome, min, max, decimais }]
  formula      String                         // expressão aritmética usando os nomes das variáveis
  criadoEm     DateTime @default(now())

  provaMestreQuestoes    ProvaMestreQuestao[]
  provaIndividualQuestoes ProvaIndividualQuestao[]
}

model ProvaMestre {
  id               String   @id @default(uuid())
  titulo           String
  turma            String
  duracaoMinutos   Int
  status           String   @default("rascunho") // rascunho | publicada
  criadoEm         DateTime @default(now())

  questoes         ProvaMestreQuestao[]
  provasIndividuais ProvaIndividual[]
}

model ProvaMestreQuestao {
  id            String      @id @default(uuid())
  provaMestre   ProvaMestre @relation(fields: [provaMestreId], references: [id])
  provaMestreId String
  questao       Questao     @relation(fields: [questaoId], references: [id])
  questaoId     String
  ordem         Int

  @@unique([provaMestreId, questaoId])
}

model ProvaIndividual {
  id            String      @id @default(uuid())
  provaMestre   ProvaMestre @relation(fields: [provaMestreId], references: [id])
  provaMestreId String
  aluno         Aluno       @relation(fields: [alunoId], references: [id])
  alunoId       String
  seed          String
  qrToken       String      @unique
  status        String      @default("gerada") // gerada | em_andamento | finalizada
  iniciadaEm    DateTime?
  finalizadaEm  DateTime?
  acertos       Int?
  total         Int?

  questoes      ProvaIndividualQuestao[]

  @@unique([provaMestreId, alunoId])
}

model ProvaIndividualQuestao {
  id                    String          @id @default(uuid())
  provaIndividual       ProvaIndividual @relation(fields: [provaIndividualId], references: [id])
  provaIndividualId     String
  questao               Questao         @relation(fields: [questaoId], references: [id])
  questaoId             String
  ordem                 Int
  parametrosGerados     Json
  enunciadoFinal        String
  alternativasFinal     Json            // [{letra, valor, correta}]
  respostaCorretaLetra  String
  respostaAlunoLetra    String?
  correta               Boolean?

  @@unique([provaIndividualId, questaoId])
}
