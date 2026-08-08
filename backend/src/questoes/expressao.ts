// Avaliador de expressões aritméticas (+ - * / ^, parênteses, funções e condições), sem usar eval().
// Aceita letras latinas e gregas nos nomes de variáveis (ex.: F/m, 2*ρ1*ρ2/(ρ1+ρ2), H^3).
// Funções trigonométricas trabalham em GRAUS (não radianos) — sin(30), cos(90-θ), etc.
//
// Funções de um argumento: sin, cos, tan, asin, acos, atan, sqrt, abs, ln, log
// Funções de dois argumentos: atan2(y; x) — ângulo já considerando o quadrante certo
//                              min(a; b), max(a; b)
// Condição: se(condicao; valor_se_verdadeiro; valor_se_falso)
//   ex.: se(x>0; x; -x)   |   comparações aceitas: > < >= <= == !=
//   IMPORTANTE: os argumentos são separados por PONTO-E-VÍRGULA (;), não vírgula —
//   igual no Excel em português — porque a vírgula já é usada como separador decimal.
function chamarFuncao(nome: string, args: number[]): number {
  const key = nome.toLowerCase();
  switch (key) {
    case "sin": return Math.sin((args[0] * Math.PI) / 180);
    case "cos": return Math.cos((args[0] * Math.PI) / 180);
    case "tan": return Math.tan((args[0] * Math.PI) / 180);
    case "asin": return (Math.asin(args[0]) * 180) / Math.PI;
    case "acos": return (Math.acos(args[0]) * 180) / Math.PI;
    case "atan": return (Math.atan(args[0]) * 180) / Math.PI;
    case "atan2": return (Math.atan2(args[0], args[1]) * 180) / Math.PI; // atan2(y, x) — já acerta o quadrante sozinho
    case "sqrt": return Math.sqrt(args[0]);
    case "abs": return Math.abs(args[0]);
    case "ln": return Math.log(args[0]);
    case "log": return Math.log10(args[0]);
    case "min": return Math.min(...args);
    case "max": return Math.max(...args);
    case "se": return args[0] !== 0 ? args[1] : args[2]; // se(condicao, valorSeVerdadeiro, valorSeFalso)
    default:
      throw new Error(`Função desconhecida: "${nome}". Disponíveis: sin, cos, tan, asin, acos, atan, atan2, sqrt, abs, ln, log, min, max, se`);
  }
}

export function avaliarExpressao(expr: string, vars: Record<string, number>): number {
  const s = expr.replace(/\s+/g, "");
  let i = 0;

  function peek() { return s[i]; }

  function parseNumber(): number {
    const start = i;
    while (i < s.length && /[0-9.,]/.test(s[i])) i++;
    const bruto = s.slice(start, i).replace(",", "."); // aceita vírgula como separador decimal (padrão BR)
    return parseFloat(bruto);
  }

  // lê um identificador (nome de variável OU de função) e decide qual é pelo que vem depois.
  // funções agora aceitam vários argumentos separados por vírgula: nome(arg1, arg2, ...)
  function parseIdentOuFuncao(): number {
    const start = i;
    while (i < s.length && /[A-Za-zΑ-Ωα-ω0-9_]/.test(s[i])) i++;
    const nome = s.slice(start, i);

    if (peek() === "(") {
      i++; // consome "("
      const args: number[] = [];
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

  function parsePrimary(): number {
    if (peek() === "(") {
      i++;
      const v = parseComparacao();
      if (peek() !== ")") throw new Error("Parêntese não fechado");
      i++;
      return v;
    }
    if (/[0-9.]/.test(peek())) return parseNumber();
    if (/[A-Za-zΑ-Ωα-ω_]/.test(peek())) return parseIdentOuFuncao();
    throw new Error("Expressão inválida perto de: " + s.slice(i));
  }

  // unário: -X ou +X (tem precedência MENOR que potência, então -H^2 = -(H^2), igual na matemática normal)
  function parseUnary(): number {
    if (peek() === "-") { i++; return -parseUnary(); }
    if (peek() === "+") { i++; return parseUnary(); }
    return parsePower();
  }

  // potência: H^3, com ^ associando da direita pra esquerda (2^3^2 = 2^(3^2))
  function parsePower(): number {
    const base = parsePrimary();
    if (peek() === "^") {
      i++;
      const expoente = parseUnary();
      return Math.pow(base, expoente);
    }
    return base;
  }

  function parseTerm(): number {
    let v = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = s[i]; i++;
      const r = parseUnary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }

  function parseSoma(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = s[i]; i++;
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  // comparações (usadas dentro de se(...)): > < >= <= == != — resultam em 1 (verdadeiro) ou 0 (falso)
  function parseComparacao(): number {
    const esquerda = parseSoma();
    const doisChars = s.slice(i, i + 2);
    if (doisChars === ">=" || doisChars === "<=" || doisChars === "==" || doisChars === "!=") {
      i += 2;
      const direita = parseSoma();
      if (doisChars === ">=") return esquerda >= direita ? 1 : 0;
      if (doisChars === "<=") return esquerda <= direita ? 1 : 0;
      if (doisChars === "==") return esquerda === direita ? 1 : 0;
      return esquerda !== direita ? 1 : 0; // !=
    }
    const umChar = peek();
    if (umChar === ">" || umChar === "<") {
      i++;
      const direita = parseSoma();
      return umChar === ">" ? (esquerda > direita ? 1 : 0) : (esquerda < direita ? 1 : 0);
    }
    return esquerda;
  }

  if (s.length === 0) throw new Error("Fórmula vazia");
  const result = parseComparacao();
  if (i < s.length) throw new Error("Caracteres inesperados: " + s.slice(i));
  if (!isFinite(result)) throw new Error("Resultado inválido (divisão por zero?)");
  return result;
}
