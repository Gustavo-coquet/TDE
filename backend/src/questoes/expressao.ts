// Avaliador de expressões (+ - * / ^, parênteses, funções, condições E TEXTO), sem usar eval().
// Aceita letras latinas e gregas nos nomes de variáveis (ex.: F/m, 2*ρ1*ρ2/(ρ1+ρ2), H^3).
// Funções trigonométricas trabalham em GRAUS (não radianos) — sin(30), cos(90-θ), etc.
//
// Funções de um argumento: sin, cos, tan, asin, acos, atan, sqrt, abs, ln, log
// Funções de dois argumentos: atan2(y; x) — ângulo já considerando o quadrante certo
//                              min(a; b), max(a; b)
// Condição: se(condicao; valor_se_verdadeiro; valor_se_falso) — igual o SE do Excel.
//   Os dois últimos argumentos podem ser NÚMEROS ou TEXTO entre aspas, ex.:
//   se(Rx>=0; se(Ry>=0; "1º quadrante"; "4º quadrante"); se(Ry>=0; "2º quadrante"; "3º quadrante"))
//   comparações aceitas: > < >= <= == !=  (== e != também funcionam comparando texto)
//   IMPORTANTE: os argumentos são separados por PONTO-E-VÍRGULA (;), não vírgula —
//   igual no Excel em português — porque a vírgula já é usada como separador decimal.
export type Valor = number | string;

function ehTexto(v: Valor): v is string {
  return typeof v === "string";
}

function paraNumero(v: Valor, contexto: string): number {
  if (ehTexto(v)) throw new Error(`Não é possível fazer contas com texto ("${v}") em: ${contexto}`);
  return v;
}

// converte um valor pra texto na hora de concatenar com "+" — número vira texto no padrão BR (vírgula decimal).
// arredonda pra 2 casas antes: sem isso, contas como 191,33+180 podem virar "371.33000000000004"
// por causa de como o computador guarda números decimais (ponto flutuante).
function paraTexto(v: Valor): string {
  if (ehTexto(v)) return v;
  const arredondado = Math.round(v * 100) / 100;
  return String(arredondado).replace(".", ",");
}

function chamarFuncao(nome: string, args: Valor[]): Valor {
  const key = nome.toLowerCase();
  if (key === "se") return args[0] !== 0 ? args[1] : args[2]; // se(condicao, valorSeVerdadeiro, valorSeFalso) — aceita texto
  // as demais funções são todas numéricas
  const n = args.map((a) => paraNumero(a, `função "${nome}"`));
  switch (key) {
    case "sin": return Math.sin((n[0] * Math.PI) / 180);
    case "cos": return Math.cos((n[0] * Math.PI) / 180);
    case "tan": return Math.tan((n[0] * Math.PI) / 180);
    case "asin": return (Math.asin(n[0]) * 180) / Math.PI;
    case "acos": return (Math.acos(n[0]) * 180) / Math.PI;
    case "atan": return (Math.atan(n[0]) * 180) / Math.PI;
    case "atan2": return (Math.atan2(n[0], n[1]) * 180) / Math.PI; // atan2(y, x) — já acerta o quadrante sozinho
    case "sqrt": return Math.sqrt(n[0]);
    case "abs": return Math.abs(n[0]);
    case "ln": return Math.log(n[0]);
    case "log": return Math.log10(n[0]);
    case "min": return Math.min(...n);
    case "max": return Math.max(...n);
    default:
      throw new Error(`Função desconhecida: "${nome}". Disponíveis: sin, cos, tan, asin, acos, atan, atan2, sqrt, abs, ln, log, min, max, se`);
  }
}

function removerEspacosForaDeAspas(txt: string): string {
  let out = "";
  let dentroDeAspas = false;
  for (let idx = 0; idx < txt.length; idx++) {
    const ch = txt[idx];
    if (ch === '"') dentroDeAspas = !dentroDeAspas;
    if (dentroDeAspas || !/\s/.test(ch)) out += ch;
  }
  return out;
}

export function avaliarExpressao(expr: string, vars: Record<string, Valor>): Valor {
  const s = removerEspacosForaDeAspas(expr);
  let i = 0;

  function peek() { return s[i]; }

  function parseNumber(): number {
    const start = i;
    while (i < s.length && /[0-9.,]/.test(s[i])) i++;
    const bruto = s.slice(start, i).replace(",", "."); // aceita vírgula como separador decimal (padrão BR)
    return parseFloat(bruto);
  }

  // texto entre aspas: "1º quadrante"
  function parseTexto(): string {
    i++; // consome a aspa de abertura
    const start = i;
    while (i < s.length && s[i] !== '"') i++;
    if (s[i] !== '"') throw new Error("Aspas não fechadas em torno de texto");
    const texto = s.slice(start, i);
    i++; // consome a aspa de fechamento
    return texto;
  }

  // lê um identificador (nome de variável OU de função) e decide qual é pelo que vem depois.
  // funções aceitam vários argumentos separados por ponto-e-vírgula: nome(arg1; arg2; ...)
  function parseIdentOuFuncao(): Valor {
    const start = i;
    while (i < s.length && /[A-Za-zΑ-Ωα-ω0-9_]/.test(s[i])) i++;
    const nome = s.slice(start, i);

    if (peek() === "(") {
      i++; // consome "("
      const args: Valor[] = [];
      if (peek() !== ")") {
        args.push(parseComparacao());
        while (peek() === ";") {
          i++;
          args.push(parseComparacao());
        }
      }
      if (peek() !== ")") throw new Error(`Parêntese não fechado na função "${nome}"`);
      i++;
      return chamarFuncao(nome, args);
    }

    if (!(nome in vars)) throw new Error(`Variável desconhecida: "${nome}"`);
    return vars[nome];
  }

  function parsePrimary(): Valor {
    if (peek() === "(") {
      i++;
      const v = parseComparacao();
      if (peek() !== ")") throw new Error("Parêntese não fechado");
      i++;
      return v;
    }
    if (peek() === '"') return parseTexto();
    if (/[0-9.]/.test(peek())) return parseNumber();
    if (/[A-Za-zΑ-Ωα-ω_]/.test(peek())) return parseIdentOuFuncao();
    throw new Error("Expressão inválida perto de: " + s.slice(i));
  }

  // unário: -X ou +X (tem precedência MENOR que potência, então -H^2 = -(H^2), igual na matemática normal)
  function parseUnary(): Valor {
    if (peek() === "-") { i++; return -paraNumero(parseUnary(), "sinal de menos"); }
    if (peek() === "+") { i++; return parseUnary(); }
    return parsePower();
  }

  // potência: H^3, com ^ associando da direita pra esquerda (2^3^2 = 2^(3^2))
  function parsePower(): Valor {
    const base = parsePrimary();
    if (peek() === "^") {
      i++;
      const expoente = parseUnary();
      return Math.pow(paraNumero(base, "potência"), paraNumero(expoente, "potência"));
    }
    return base;
  }

  function parseTerm(): Valor {
    let v = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = s[i]; i++;
      const r = parseUnary();
      const a = paraNumero(v, "multiplicação/divisão"), b = paraNumero(r, "multiplicação/divisão");
      v = op === "*" ? a * b : a / b;
    }
    return v;
  }

  function parseSoma(): Valor {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = s[i]; i++;
      const r = parseTerm();
      if (op === "+" && (ehTexto(v) || ehTexto(r))) {
        v = paraTexto(v) + paraTexto(r); // "+" com texto de qualquer lado vira concatenação, ex.: theta + "° (anti-horário)"
      } else {
        const a = paraNumero(v, "soma/subtração"), b = paraNumero(r, "soma/subtração");
        v = op === "+" ? a + b : a - b;
      }
    }
    return v;
  }

  // comparações (usadas dentro de se(...)): > < >= <= == != — resultam em 1 (verdadeiro) ou 0 (falso)
  // == e != também comparam texto (útil pra encadear condições)
  function parseComparacao(): Valor {
    const esquerda = parseSoma();
    const doisChars = s.slice(i, i + 2);
    if (doisChars === ">=" || doisChars === "<=" || doisChars === "==" || doisChars === "!=") {
      i += 2;
      const direita = parseSoma();
      if (doisChars === "==") return esquerda === direita ? 1 : 0;
      if (doisChars === "!=") return esquerda !== direita ? 1 : 0;
      const a = paraNumero(esquerda, "comparação"), b = paraNumero(direita, "comparação");
      return doisChars === ">=" ? (a >= b ? 1 : 0) : (a <= b ? 1 : 0);
    }
    const umChar = peek();
    if (umChar === ">" || umChar === "<") {
      i++;
      const direita = parseSoma();
      const a = paraNumero(esquerda, "comparação"), b = paraNumero(direita, "comparação");
      return umChar === ">" ? (a > b ? 1 : 0) : (a < b ? 1 : 0);
    }
    return esquerda;
  }

  if (s.length === 0) throw new Error("Fórmula vazia");
  const result = parseComparacao();
  if (i < s.length) throw new Error("Caracteres inesperados: " + s.slice(i));
  if (typeof result === "number" && !isFinite(result)) throw new Error("Resultado inválido (divisão por zero?)");
  return result;
}
