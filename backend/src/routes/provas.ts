DELETE FROM "Questao" WHERE enunciado = 'Uma cultura de bactérias tem, no instante inicial, N_{0} bactérias, e sua população dobra a cada T horas, segundo a função N(t) = N_{0}·2^{t/T}.

Quantas bactérias haverá após t horas?

Dados:
N_{0} = {N0},
T = {Td} (h) e
t = {tt} (h)';
DELETE FROM "Questao" WHERE enunciado = 'Uma população de bactérias cresce segundo N(t) = N_{0}·3^{t/k}, com t em horas.

Após quanto tempo a população atingirá N_{f} bactérias?

Dados:
N_{0} = {N0},
k = {k} (h) e
N_{f} = {Nf}';
DELETE FROM "Questao" WHERE enunciado = 'Um capital de C reais é aplicado a juros compostos à taxa de i% ao mês.

Qual será o montante após n meses?

Dados:
C = {C} (R$),
i = {i} (% ao mês) e
n = {n} (meses)';
DELETE FROM "Questao" WHERE enunciado = 'Um capital é aplicado a juros compostos à taxa de i% ao mês.

Em quantos meses o montante ficará multiplicado por k, isto é, será igual a k vezes o capital inicial?

Dados:
i = {i} (% ao mês) e
k = {k}';
DELETE FROM "Questao" WHERE enunciado = 'Um isótopo radioativo tem meia-vida de T anos, de modo que a massa restante é dada por m(t) = m_{0}·(1/2)^{t/T}.

Partindo de m_{0} gramas, qual será a massa restante após t anos?

Dados:
m_{0} = {m0} (g),
T = {Td} (anos) e
t = {tt} (anos)';
DELETE FROM "Questao" WHERE enunciado = 'Resolva a equação exponencial

{c}·{a}^{x} = {N}';
DELETE FROM "Questao" WHERE enunciado = 'Sabendo que log 2 = 0,301 e log 3 = 0,477, calcule

log(2^{{p}}·3^{{q}}/5)';
DELETE FROM "Questao" WHERE enunciado = 'O pH de uma solução é dado por pH = −log [H^{+}], com a concentração [H^{+}] em mol/L.

Qual é o pH de uma solução cuja concentração de íons H^{+} é [H^{+}] = {k} × 10^{−{n}} mol/L?';
DELETE FROM "Questao" WHERE enunciado = 'O nível de intensidade sonora, em decibéis, é β = 10·log(I/I_{0}), em que I_{0} = 10^{−12} W/m^{2} é a intensidade de referência.

Qual é o nível sonoro de uma fonte que produz intensidade I = {k} × 10^{−{n}} W/m^{2}?';
DELETE FROM "Questao" WHERE enunciado = 'Resolva a equação exponencial

4^{x} − {s}·2^{x} + {pp} = 0

Dê as duas raízes, da menor para a maior.';

INSERT INTO "Questao"
  (id, disciplina, assunto, dificuldade, enunciado, variaveis, etapas, "formatoResposta", "criadoEm")
VALUES
  (gen_random_uuid()::text,
   'Matemática',
   'Função exponencial',
   2,
   'Uma cultura de bactérias tem, no instante inicial, N_{0} bactérias, e sua população dobra a cada T horas, segundo a função N(t) = N_{0}·2^{t/T}.

Quantas bactérias haverá após t horas?

Dados:
N_{0} = {N0},
T = {Td} (h) e
t = {tt} (h)',
   '[{"nome":"N0","min":200,"max":900,"decimais":0},{"nome":"Td","min":2,"max":5,"decimais":0},{"nome":"tt","min":7,"max":20,"decimais":0}]'::jsonb,
   '[{"nome":"N","formula":"N0*2^(tt/Td)","decimais":0,"unidade":"bactérias","saida":true,"notacaoCientifica":false,"distratores":["N0*2^(Td/tt)","N0*2*tt/Td","N0*2^(tt/Td-1)","N0*2^(tt/Td+1)","N0*2,718281828^(tt/Td)","N0*(tt/Td)^2","N0*3^(tt/Td)"]}]'::jsonb,
   'N = {N} bactérias',
   now() + 0 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Funções exponencial e logarítmica',
   3,
   'Uma população de bactérias cresce segundo N(t) = N_{0}·3^{t/k}, com t em horas.

Após quanto tempo a população atingirá N_{f} bactérias?

Dados:
N_{0} = {N0},
k = {k} (h) e
N_{f} = {Nf}',
   '[{"nome":"N0","min":100,"max":500,"decimais":0},{"nome":"k","min":2,"max":6,"decimais":0},{"nome":"Nf","min":20000,"max":90000,"decimais":0}]'::jsonb,
   '[{"nome":"t","formula":"k*ln(Nf/N0)/ln(3)","decimais":2,"unidade":"h","saida":true,"notacaoCientifica":false,"distratores":["k*ln(Nf/N0)/ln(2)","ln(Nf/N0)/ln(3)","k*log(Nf/N0)","k*ln(Nf-N0)/ln(3)","k*ln(Nf/N0)*ln(3)","k*Nf/(3*N0)/100","k*ln(Nf)/ln(3)"]}]'::jsonb,
   't = {t} h',
   now() + 1 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Função exponencial',
   2,
   'Um capital de C reais é aplicado a juros compostos à taxa de i% ao mês.

Qual será o montante após n meses?

Dados:
C = {C} (R$),
i = {i} (% ao mês) e
n = {n} (meses)',
   '[{"nome":"C","min":1000,"max":20000,"decimais":0},{"nome":"i","min":1,"max":4,"decimais":1},{"nome":"n","min":12,"max":48,"decimais":0}]'::jsonb,
   '[{"nome":"M","formula":"C*(1+i/100)^n","decimais":2,"unidade":"R$","saida":true,"notacaoCientifica":false,"distratores":["C*(1+i*n/100)","C*(1+i/100)^(n-1)","C*(1+i/100)^(n+1)","C*(1+i/100)^(n/12)","C*(1+i/1000)^n","C*(1+i/100)^n-C","C*(1+2*i/100)^n"]}]'::jsonb,
   'M = R$ {M}',
   now() + 2 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Funções exponencial e logarítmica',
   3,
   'Um capital é aplicado a juros compostos à taxa de i% ao mês.

Em quantos meses o montante ficará multiplicado por k, isto é, será igual a k vezes o capital inicial?

Dados:
i = {i} (% ao mês) e
k = {k}',
   '[{"nome":"i","min":2,"max":6,"decimais":1},{"nome":"k","min":1.5,"max":4,"decimais":1}]'::jsonb,
   '[{"nome":"n","formula":"ln(k)/ln(1+i/100)","decimais":2,"unidade":"meses","saida":true,"notacaoCientifica":false,"distratores":["(k-1)/(i/100)","ln(k)/ln(1+i)","log(k)/ln(1+i/100)","ln(k)/(i/100)","ln(k+1)/ln(1+i/100)","ln(k)/ln(1+i/100)/12","k/ln(1+i/100)/100"]}]'::jsonb,
   'n = {n} meses',
   now() + 3 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Função exponencial',
   2,
   'Um isótopo radioativo tem meia-vida de T anos, de modo que a massa restante é dada por m(t) = m_{0}·(1/2)^{t/T}.

Partindo de m_{0} gramas, qual será a massa restante após t anos?

Dados:
m_{0} = {m0} (g),
T = {Td} (anos) e
t = {tt} (anos)',
   '[{"nome":"m0","min":50,"max":500,"decimais":0},{"nome":"Td","min":10,"max":25,"decimais":0},{"nome":"tt","min":30,"max":70,"decimais":0}]'::jsonb,
   '[{"nome":"m","formula":"m0*(1/2)^(tt/Td)","decimais":3,"unidade":"g","saida":true,"notacaoCientifica":false,"distratores":["m0*(1/2)^(Td/tt)","m0*2^(tt/Td)","m0*(1/2)^(tt/Td-1)","m0*(1/2)^(tt/Td+1)","m0*(1/3)^(tt/Td)","m0*2,718281828^(0-tt/Td)","m0/(2*tt/Td)"]}]'::jsonb,
   'm = {m} g',
   now() + 4 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Funções exponencial e logarítmica',
   3,
   'Resolva a equação exponencial

{c}·{a}^{x} = {N}',
   '[{"nome":"c","min":2,"max":9,"decimais":0},{"nome":"a","min":3,"max":7,"decimais":0},{"nome":"N","min":50,"max":5000,"decimais":0}]'::jsonb,
   '[{"nome":"xs","formula":"ln(N/c)/ln(a)","decimais":3,"unidade":"","saida":true,"notacaoCientifica":false,"distratores":["ln(N)/(c*ln(a))","ln(N)/ln(a)-ln(c)","log(N/c)","ln(N*c)/ln(a)","ln(N/c)*ln(a)","ln(N-c)/ln(a)","ln(N/c)/ln(c*a)"]}]'::jsonb,
   'x = {xs}',
   now() + 5 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Função logarítmica',
   3,
   'Sabendo que log 2 = 0,301 e log 3 = 0,477, calcule

log(2^{{p}}·3^{{q}}/5)',
   '[{"nome":"p","min":2,"max":6,"decimais":0},{"nome":"q","min":1,"max":5,"decimais":0}]'::jsonb,
   '[{"nome":"L","formula":"0,301*p+0,477*q-(1-0,301)","decimais":3,"unidade":"","saida":true,"notacaoCientifica":false,"distratores":["0,301*p+0,477*q","0,301*p+0,477*q+0,699","0,301*p+0,477*q-1","0,301*0,477*p*q-0,699","0,477*p+0,301*q-0,699","(0,301*p+0,477*q)/0,699","(0,301*p+0,477*q)/5","0,301*p+0,477*q-0,5"]}]'::jsonb,
   'log(2^{{p}}·3^{{q}}/5) = {L}',
   now() + 6 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Função logarítmica',
   2,
   'O pH de uma solução é dado por pH = −log [H^{+}], com a concentração [H^{+}] em mol/L.

Qual é o pH de uma solução cuja concentração de íons H^{+} é [H^{+}] = {k} × 10^{−{n}} mol/L?',
   '[{"nome":"k","min":1.5,"max":9.9,"decimais":1},{"nome":"n","min":3,"max":11,"decimais":0}]'::jsonb,
   '[{"nome":"pH","formula":"n-log(k)","decimais":2,"unidade":"","saida":true,"notacaoCientifica":false,"distratores":["n+log(k)","n-ln(k)","n+1-log(k)","n-1-log(k)","(n-log(k))*ln(10)","log(k)","n"]}]'::jsonb,
   'pH = {pH}',
   now() + 7 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Função logarítmica',
   3,
   'O nível de intensidade sonora, em decibéis, é β = 10·log(I/I_{0}), em que I_{0} = 10^{−12} W/m^{2} é a intensidade de referência.

Qual é o nível sonoro de uma fonte que produz intensidade I = {k} × 10^{−{n}} W/m^{2}?',
   '[{"nome":"k","min":1.1,"max":9.9,"decimais":1},{"nome":"n","min":3,"max":9,"decimais":0}]'::jsonb,
   '[{"nome":"beta","formula":"10*(12-n+log(k))","decimais":2,"unidade":"dB","saida":true,"notacaoCientifica":false,"distratores":["12-n+log(k)","10*(12-n-log(k))","10*(ln(k)+(12-n)*ln(10))","20*(12-n+log(k))","10*(12-n)+log(k)","10*(n+log(k))","10*(12+log(k))"]}]'::jsonb,
   'β = {beta} dB',
   now() + 8 * interval '1 millisecond'),
  (gen_random_uuid()::text,
   'Matemática',
   'Funções exponencial e logarítmica',
   5,
   'Resolva a equação exponencial

4^{x} − {s}·2^{x} + {pp} = 0

Dê as duas raízes, da menor para a maior.',
   '[{"nome":"r1","min":2,"max":5,"decimais":0},{"nome":"r2","min":6,"max":12,"decimais":0}]'::jsonb,
   '[{"nome":"s","formula":"r1+r2","decimais":0,"unidade":"","saida":false,"notacaoCientifica":false},{"nome":"pp","formula":"r1*r2","decimais":0,"unidade":"","saida":false,"notacaoCientifica":false},{"nome":"x1","formula":"ln(r1)/ln(2)","decimais":3,"unidade":"","saida":true,"notacaoCientifica":false,"distratores":["r1","log(r1)","ln(r1)","ln(r1)/ln(4)","sqrt(r1)","ln(r1+r2)/ln(2)","r1/2"]},{"nome":"x2","formula":"ln(r2)/ln(2)","decimais":3,"unidade":"","saida":true,"notacaoCientifica":false,"distratores":["r2","log(r2)","ln(r2)","ln(r2)/ln(4)","sqrt(r2)","ln(r1*r2)/ln(2)","r2/2"]}]'::jsonb,
   'x_{1} = {x1} · x_{2} = {x2}',
   now() + 9 * interval '1 millisecond');
