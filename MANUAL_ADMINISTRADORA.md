# Manual Completo da Administradora — Estefany Paiva Nails

Este guia explica passo a passo como funciona cada área do aplicativo, tanto o **Painel Administrativo** quanto a **Página Pública das Clientes**.

---

## 1. Primeiro Acesso, Segurança e Termo de Uso
1. Acesse o link exclusivo do seu Painel Administrativo.
2. Digite seu **e-mail** e **senha** de acesso.
3. No primeiro acesso, leia e aceite o **Termo de Uso, Privacidade (LGPD) e Segurança** (seu aceite fica registrado eletronicamente com data e hora).
4. **Proteção contra invasão:** por segurança, após **5 tentativas consecutivas com senha errada**, a tela é bloqueada automaticamente por **15 minutos**.
5. **Alterar Login e Senha:** dentro do painel, vá em **Perfil → Segurança da Conta** para trocar seu e-mail de login e senha a qualquer momento (criptografados com `PBKDF2-HMAC-SHA256`).

---

## 2. Aba Agenda (Seu Dia a Dia)
- **Visualizar atendimentos:** todos os agendamentos aparecem organizados por data e horário, com filtros por status (`Todos`, `Pendente`, `Confirmado`, `Concluído`, `Cancelado`) e filtro por data ou histórico.
- **Detalhes do atendimento:** toque em **Detalhes** em qualquer agendamento para:
  - Alterar o status (**Confirmar**, **Concluir** ou **Cancelar**).
  - **Remarcar** data ou horário manualmente.
  - **Enviar mensagem pronta no WhatsApp** com 1 clique (confirmação, lembrete ou agradecimento).
  - Visualizar ou editar notas técnicas da cliente.
- **Novo Horário:** cadastre um atendimento manual/encaixe diretamente pelo painel.
- **Bloquear Horário (Bloqueios Pessoais):** feche um horário específico ou o dia inteiro para compromissos pessoais, cursos ou almoço.
- **Abrir / Fechar Meses:** controle quais meses futuros ficam abertos ou fechados para agendamentos online.

---

## 3. Integração Automática com o Google Agenda
1. No topo do painel, clique no botão **Conectar Google Agenda**.
2. Selecione sua conta Google e avance na tela de autorização.
3. **Importante:** marque a **caixinha de permissão do Google Agenda** antes de clicar em **Continuar**.
4. Quando o botão ficar verde mostrando seu e-mail:
   - Todo **novo agendamento**, **remarcação**, **cancelamento** ou **bloqueio pessoal** sincroniza automaticamente com seu Google Agenda.
   - Clicando uma vez no botão verde com seu e-mail e apertando **OK**, você também pode enviar para o Google Agenda agendamentos futuros que já estavam salvos antes da conexão (ou desconectar sua conta quando desejar).

---

## 4. Aba Serviços e Categorias (Catálogo)
- Crie, edite, ative ou desative **categorias** e **procedimentos**.
- Para cada serviço, defina:
  - **Nome e descrição**
  - **Valor (R$)**
  - **Duração exata em minutos** (ex.: `60`, `90`, `120` — o sistema usa essa duração para calcular os horários livres sem encavalar clientes)
  - **Prazo recomendado de manutenção** (em dias)
  - **Foto real** enviada direto do celular ou computador.

---

## 5. Aba Clientes
- Consulte a lista completa de clientes cadastradas.
- Veja o histórico de atendimentos, quantidade de visitas e dias desde o último atendimento.
- Salve **anotações técnicas privadas** (ex.: formato preferido, cor de gel, sensibilidades/alergias) — visíveis apenas para você no painel.

---

## 6. Aba Financeiro e Relatórios
- Acompanhe o faturamento dos atendimentos concluídos, ticket médio e saldo do período.
- Registre **despesas do estúdio** (materiais, aluguel, insumos).
- Analise os recebimentos por forma de pagamento (**Pix**, **Dinheiro**, **Cartão**) e exporte relatórios em **CSV**.

---

## 7. Aba Perfil e Configurações Gerais
Em **Perfil → Configurações Gerais**, você personaliza todo o funcionamento do estúdio:
- **Dias de Atendimento:** marque quais dias da semana o estúdio abre.
- **Modelo de Horários na Agenda (2 modos):**
  - **Horários Corridos (Intervalo):** gera horários automaticamente entre abertura e fechamento (ex.: de 30 em 30 min).
  - **Horários Fixos Fechados:** você define exatamente os horários de início que aparecem (ex.: `08:30, 10:30, 13:30, 15:30, 17:30`).
- **Dias de Folga / Feriados:** bloqueie datas específicas do calendário.
- **Regras de Pix e Sinal:** configure sua chave Pix, nome do titular, cidade e percentual de sinal (quando aplicável).
- **Vitrine Online:** troque sua foto de perfil, imagem de capa, título, subtítulo e endereço do estúdio.
- **Ajuda & Manual:** dentro de **Perfil → Ajuda & Suporte**, você pode consultar este manual e o Termo de Uso a qualquer momento.

---

## 8. Como Funciona o Site Público para suas Clientes
1. Ao abrir o link principal, a cliente vê a vitrine do estúdio e o catálogo de procedimentos.
2. Ela escolhe um ou mais serviços e toca em **Agendar Horário**.
3. O calendário mostra os dias abertos e **exibe apenas os horários livres compatíveis com a duração total** dos serviços escolhidos (ocultando os horários ocupados ou incompatíveis).
4. Ela informa **Nome completo** e **WhatsApp com DDD**, escolhe a forma de pagamento e confirma.
5. Na aba **Meus Agendamentos**, a própria cliente pode acompanhar seu horário ou remarcar dentro das regras configuradas.
