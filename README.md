# Prova-Mestre — MVP funcional

MVP real do sistema descrito na especificação: backend em Node.js/TypeScript + PostgreSQL,
com o algoritmo de **Prova-Mestre** (randomização de ordem, parametrização numérica e
correção automática) rodando de verdade. O frontend é HTML/CSS/JS puro (sem build step),
servido pelo próprio backend — então não precisa instalar nada além do Node.

O que este MVP já faz de verdade:
- Banco de questões parametrizadas (6 questões de exemplo: física, matemática, estatística).
- Criação de Prova-Mestre selecionando questões do banco.
- Publicação: gera 1 prova individual por aluno (8 alunos de exemplo), com ordem e valores
  numéricos diferentes, mas **as mesmas questões e a mesma dificuldade** para todos — cada
  prova tem um link único.
- Aluno resolve a prova pelo navegador (timer, navegação entre questões).
- Correção automática assim que a prova é finalizada.
- Painel de resultados: média, mediana, desvio padrão, ranking de questões com mais erro.

O que é simplificado em relação à arquitetura completa (para caber num MVP rodável):
sem autenticação/login, sem geração de questões por IA, sem exportação para Excel/PDF, e a
parametrização usa fórmulas already-escritas em código (`src/questoes/templates.ts`) em vez
de um motor simbólico (SymPy) que interpreta fórmulas dinamicamente.

---

## Pré-requisitos

- **Node.js 18 ou superior** — https://nodejs.org
- **Docker** (para rodar o PostgreSQL) — https://www.docker.com/products/docker-desktop
  - Alternativa: se já tiver um PostgreSQL rodando na sua máquina, não precisa do Docker —
    só ajuste a `DATABASE_URL` no passo 3.

---

## Como rodar (passo a passo)

### 1. Suba o banco de dados PostgreSQL

Na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe um Postgres em `localhost:5432` com usuário/senha `prova_mestre`/`prova_mestre`.

### 2. Instale as dependências do backend

```bash
cd backend
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

O `.env.example` já vem apontando para o Postgres do Docker Compose — não precisa editar
nada se você usou o passo 1.

### 4. Rode as migrations (cria as tabelas no banco)

```bash
npx prisma migrate dev --name init
```

### 5. Popule o banco com dados de exemplo (questões + turma de 8 alunos)

```bash
npm run seed
```

### 6. Inicie o servidor

```bash
npm run dev
```

Você verá:

```
Prova-Mestre backend rodando em http://localhost:3333
```

### 7. Abra no navegador

**Área do professor:** http://localhost:3333

1. Vá em **"Criar Prova-Mestre"**, selecione algumas questões e clique em publicar.
2. Isso gera uma prova individual para cada um dos 8 alunos, cada uma com um link único
   (`/aluno.html?token=...`).
3. Abra um desses links em outra aba — é exatamente o que o aluno veria — e resolva a prova.
4. Volte para **"Resultados"** no painel do professor para ver a nota, estatísticas da
   turma e o ranking de questões com mais erro.

---

## Estrutura do projeto

```
prova-mestre-mvp/
├── docker-compose.yml        # Postgres
└── backend/
    ├── prisma/
    │   ├── schema.prisma      # modelagem do banco (questões, provas, respostas)
    │   └── seed.ts            # popula banco de questões + alunos de exemplo
    ├── src/
    │   ├── rng.ts              # gerador determinístico (seed -> mesma sequência)
    │   ├── randomizacao.ts     # motor de geração da prova individual
    │   ├── questoes/
    │   │   └── templates.ts    # as questões parametrizadas (fórmulas + faixas de valores)
    │   ├── routes/
    │   │   ├── questoes.ts
    │   │   ├── provas.ts       # criar / publicar / resultados da Prova-Mestre
    │   │   └── alunoExam.ts    # acessar / responder / finalizar a prova do aluno
    │   ├── db.ts
    │   └── index.ts            # servidor Express (API + arquivos estáticos)
    └── public/                 # frontend (HTML/CSS/JS puro, sem build)
        ├── index.html + app.js     # área do professor
        └── aluno.html + aluno.js   # área do aluno
```

---

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npx prisma studio` | Abre uma interface visual para inspecionar o banco de dados |
| `npm run seed` | Reseta e repopula o banco com os dados de exemplo |
| `npx prisma migrate reset` | Apaga o banco e roda as migrations do zero |

---

## Próximos passos naturais

- Adicionar CRUD de questões pela interface (hoje o banco é populado só pelo seed).
- Trocar as fórmulas fixas em `templates.ts` por um motor de expressões dinâmico
  (ex.: mathjs no Node, ou um microsserviço em Python com SymPy) para permitir que o
  professor escreva questões parametrizadas sem editar código.
- Autenticação (professor/aluno) e turmas reais em vez da lista fixa de 8 alunos.
- Exportação de resultados em Excel/CSV/PDF.
- Deploy: backend em um serviço tipo Railway/Render, banco em Postgres gerenciado
  (Neon, Supabase, RDS).
