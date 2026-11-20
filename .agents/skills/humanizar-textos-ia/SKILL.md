---
name: humanizar-textos-ia
description: Guia prático e critérios linguísticos para humanizar textos em português (UI, WhatsApp, landing pages, bios e descrições), eliminando padrões detectáveis por ferramentas de detecção de IA (baixa perplexidade, baixo burstiness, clichês de RLHF, transições robóticas e homogeneidade lexical).
---

# Humanização de Textos Gerados por IA

Baseado nos padrões documentados em estudos linguísticos e no artigo *Detecção de conteúdo gerado por inteligência artificial* (Wikipédia), este guia orienta como transformar textos com cara de robô em escrita humana natural, direta e autêntica em português brasileiro.

---

## 1. Padrões que Detectores de IA Procuram

1. **Baixa Perplexidade (Previsibilidade Estatística)**:
   - Modelos de linguagem escolhem sempre as continuações mais prováveis estatisticamente.
   - **Sinal de IA**: frases "certinhas demais", sem gírias leves, sem quebras coloquiais ou escolhas de palavras pessoais.
2. **Baixo *Burstiness* (Monotonia de Ritmo)**:
   - IAs tendem a manter todas as frases com tamanho parecido (15 a 22 palavras) e mesma estrutura sintática (sujeito + verbo + complemento + adjunto explicativo).
   - **Sinal de IA**: parágrafos rítmicos onde nenhuma frase é curta de verdade nem quebrada por uma pausa natural.
3. **Repetição de N-grams e Homogeneidade Vocabular**:
   - Uso recorrente de conectivos e fórmulas prontas de 3–5 palavras: *"Além disso"*, *"É importante ressaltar"*, *"De forma prática"*, *"Com foco em"*, *"Para garantir que"*, *"Pensando nisso"*.
4. **Polidez e Neutralidade Artificial (Efeito RLHF)**:
   - Modelos treinados por reforço humano soam excessivamente educados, elogiosos e genéricos.
   - **Sinal de IA**: *"Seu feedback é super especial para mim!"*, *"Te espero com carinho!"*, *"Passando para lembrar com carinho"*, *"impecáveis"*, *"precisão, leveza e assinatura editorial"*.
5. **Adjetivação Vaga e "Marketing de Catálogo"**:
   - Acúmulo de substantivos abstratos ou trios de adjetivos: *"alta performance, sofisticação e excelência"*, *"cuidado, técnica e leveza"*, *"experiência única e personalizada"*.
6. **Limitações Conhecidas dos Detectores (segundo a Wikipédia)**:
   - Detectores como Turnitin e GPTZero apresentam taxas altas de **falsos positivos** (especialmente contra escrita formal linear, pessoas neurodivergentes/autistas e não nativos) e precisão abaixo de 80% em testes independentes (Weber-Wulff, 2023).
   - Paráfrases mecânicas reduzem a detecção (de 91,3% para 27,8% em estudo com GPT-4 no Originality.AI), mas podem piorar a clareza se não forem reescritas com voz real.
   - Marcas d'água estatísticas de texto (ex.: Kirchenbauer et al.) se quebram quando há inserção, exclusão ou troca natural de palavras e estrutura.

---

## 2. Regras Práticas para Humanizar Textos em PT-BR

### A. Corte o "Português Corporativo de IA"
| Evite (Cara de IA) | Prefira (Voz Humana Real) |
|---|---|
| *Com foco em saúde da lâmina natural* | *Sem agredir sua unha natural* |
| *Assinatura editorial / acabamento ultrafino* | *Acabamento fininho e natural* |
| *Te espero com carinho!* | *Te espero aqui!* / *Até lá!* |
| *Passando para lembrar com carinho que...* | *Oi! Só passando pra te lembrar que...* |
| *Seu feedback é super especial para mim!* | *Me conta depois se gostou!* |
| *Para manter suas unhas sempre impecáveis* | *Pra suas unhas continuarem bonitas e seguras* |
| *Atendimento personalizado / experiência única* | *Atendimento só pra você, no seu tempo* |
| *Sem precisar esperar no WhatsApp* | *Sem ficar esperando resposta no WhatsApp* |

### B. Varie o Ritmo (*Burstiness* Alto)
- Misture frases bem curtas com frases normais.
  - *Ruim (IA)*: "Monte seu combo, escolha seu horário livre em tempo real e finalize com Pix Copia e Cola sem precisar esperar no WhatsApp."
  - *Bom (Humano)*: "Escolha o que quer fazer nas unhas, veja os horários livres na hora e pague no Pix. Simples assim, sem esperar no WhatsApp."

### C. Fale Como a Pessoa Real Fala no WhatsApp
- Em mensagens de cliente (lembrete, Pix, retorno, manutenção):
  - Use contrações naturais do dia a dia quando o contexto for próximo (*"pra"*, *"tá"*, *"já deu os dias"*, *"quer que eu já deixe..."*), sem perder o respeito.
  - Evite exclamações em excesso (máximo 1 por mensagem curta).
  - Vá direto ao ponto: nome, horário, endereço/Pix e uma pergunta simples no final.

### D. Substitua Promessas Abstratas por Detalhes Concretos
- Em vez de *"técnica avançada de alongamento para durabilidade máxima"*, diga *"fibra de vidro bem fininha que dura até 30 dias sem levantar"*.
- Em vez de *"diagnóstico e cuidado completo"*, diga *"cutilagem, esmaltação e hidratação"*.

### E. Checklist Antes de Finalizar Qualquer Texto
1. Removi trios de substantivos/adjetivos vazios (*"precisão, leveza e elegância"*)?
2. Cortei expressões de transição típicas de LLM (*"com foco em"*, *"além disso"*, *"dessa forma"*)?
3. As frases têm tamanhos variados (curtas + médias)?
4. Se eu ler em voz alta, parece alguém falando comigo de verdade ou um panfleto?
5. Respeitei os limites técnicos do sistema (ex.: tamanho máximo de campos no banco/regras)?
