# ✨ Estefany Paiva Nails — PWA de Agendamento, Portfólio & Gestão

Aplicativo web progressivo (PWA) instalável, moderno, minimalista e feminino desenvolvido para **Estefany Paiva Nails**, implementado **estritamente de acordo com o PRD completo e os modelos visuais da imagem de referência**.

---

## 🎨 Paleta de Cores & Design (Fiel ao PRD)

- **Creme:** `#F8F2ED` (Fundo da área pública)
- **Nude:** `#E9D7CE` (Bordas e divisores delicados)
- **Rosé:** `#E9A3B5` (Detalhes e destaques)
- **Rosa de Destaque:** `#D83F79` / `#F1A7B7` (Botões de ação primários)
- **Preto:** `#171719` (Textos e fundo da área administrativa)
- **Cinza:** `#777176` (Textos secundários e ícones)
- **Branco:** `#FFFFFF` (Superfície dos cartões)
- **Verde Confirmado:** `#DDF2E1` (Texto `#226E3A`)
- **Amarelo Aguardando:** `#FFF0CE` (Texto `#8C5E00`)
- **Vermelho Cancelado:** `#FCE2E5` (Texto `#B02A37`)

---

## 📱 Estrutura das 10 Telas (Exatamente como na Imagem)

### Linha 1 — Área Pública da Cliente (`index.html`)

1. **Tela 1: Onboarding / Boas-Vindas (Splash)**
   - Header com coração + `ESTEFANY PAIVA NAILS`
   - Fotografia de destaque com mãos de unhas elegantes
   - Slogan: *"Mais que unhas, é autoestima."*
   - Botão rosa: `Agendar agora →`
   - Botão transparente: `Já tenho um agendamento`

2. **Tela 2: Vitrine Principal / Home**
   - Topbar compacta com ícone de menu, marca e sininho de agendamentos
   - **Banner carrossel dinâmico de fotos/vídeos** dos procedimentos
   - **Atalhos circulares (Stories):** *Clientes*, *Processo*, *Antes e Depois*, *Nails*
   - **Vitrine "Nossos serviços"** em grade 2x2: *Alongamento em gel (R$ 150)*, *Banho de gel (R$ 80)*, *Manutenção (R$ 70)*, *Esmaltação em gel (R$ 70)*
   - Barra de navegação inferior (Bottom Bar): Início, Serviços, Agendar (botão central de destaque), Meus agendamentos, Perfil

3. **Tela 3: Detalhes do Serviço**
   - Carrossel de fotos do procedimento com contador `1/5`
   - Título, preço (`R$ 150,00`), descrição
   - Badges: `Tempo aproximado: 2h` e `Ideal para: unhas curtas ou fracas`
   - Galeria de resultados reais
   - Botão fixo no rodapé: `Agendar este serviço →`

4. **Tela 4: Fluxo de Agendamento**
   - Barra de progresso: `(1) Serviço`, `(2) Data`, `(3) Horário`, `(4) Confirmação`
   - Card do serviço selecionado com miniatura, valor e duração
   - **Calendário mensal interativo** (`< Maio 2025 >`) com bloqueio de datas passadas e domingos
   - **Horários disponíveis calculados pelo backend** (`08:00`, `09:20`, `10:40`, `13:00`, `14:20`, `16:00`, `17:20`), com prevenção atômica contra duplicidade
   - Formulário de dados da cliente (Nome e WhatsApp com máscara)
   - Botão: `Próximo →`

5. **Tela 5: Meus Agendamentos**
   - Abas seletoras: `[ Próximos ]` e `[ Histórico ]`
   - Cards com data/hora (ex: *Qui, 22 de Maio · 10:40*), serviço, badge de status (*Confirmado* ou *Aguardando*)
   - Clique para consultar detalhes e solicitar cancelamento ou reagendamento no WhatsApp

---

### Linha 2 — Área Administrativa / Gestão (`admin.html`)

6. **Tela 6: Login Administrativo**
   - Identidade visual escura de luxo
   - Campos de Usuário e Senha com botão de visualização
   - Botão rosa: `Entrar` *(Senha padrão: `admin123`)*

7. **Tela 7: Dashboard & Agenda de Hoje**
   - Saudação: *"Olá, Estefany! Aqui está um resumo do seu dia."* com foto de perfil
   - 4 KPIs em grade 2x2:
     - `5` Agendamentos hoje
     - `R$ 640,00` Faturamento do dia
     - `12` Clientes ativas
     - `6` Serviços realizados
   - Seção **Agendamentos de hoje** com horários e status:
     - `08:00` Juliana Santos · Alongamento em gel [Confirmado >]
     - `09:20` Carla Mendes · Manutenção [Confirmado >]
     - `10:40` Beatriz Lima · Banho de gel [Pendente >]
     - `13:00` Amanda Oliveira · Esmaltação em gel [Confirmado >]
     - `14:20` Fernanda Costa · Alongamento em gel [Confirmado >]
   - Drawer de ações rápidas: Confirmar, Chamar no WhatsApp, Cancelar

8. **Tela 8: Gestão de Clientes**
   - Campo de busca em tempo real por nome ou WhatsApp
   - Botão `(+)` para cadastro manual
   - Lista completa de clientes (Juliana Santos, Carla Mendes, Beatriz Lima...) com histórico e atalho WhatsApp

9. **Tela 9: Gestão de Serviços**
   - Listagem com edição rápida de preço e exclusão/desativação
   - Botão `(+)` para novo procedimento

10. **Tela 10: Financeiro & Relatórios**
    - Seletor de mês `< Maio 2025 >`
    - 3 KPIs financeiros:
      - `R$ 3.480,00` Receita total
      - `R$ 640,00` Em andamento
      - `R$ 12.540,00` Mês anterior
    - Barras de progresso de **Vendas por serviço**:
      - Alongamento em gel (40%)
      - Manutenção (25%)
      - Banho de gel (20%)
      - Esmaltação em gel (15%)
    - Botão: `Ver relatório completo (CSV)` com download imediato para Excel

---

## 🚀 Como Executar

- **Cliente / PWA Público:** Dê dois cliques em [`index.html`](file:///c:/Users/paulo/Downloads/site-manicure/index.html)
- **Painel Administrativo:** Dê dois cliques em [`admin.html`](file:///c:/Users/paulo/Downloads/site-manicure/admin.html) *(Senha: `admin123`)*
- Funciona 100% no navegador e pode ser instalado no celular através do recurso "Adicionar à tela inicial" (PWA via `manifest.json` e `sw.js`).
