# DOCUMENTAÇÃO OFICIAL DO PROJETO: ESTEFANY PAIVA NAILS
**Data da Última Atualização:** 08/11/2026  
**Status do Projeto:** Ativo / Produção (Vercel & PWA)  
**Repositório:** `https://github.com/rs8802616-dot/ESTEFANY-PAIVA.git`  
**Branch:** `main`

---

## 1. Visão Geral da Arquitetura
O sistema é uma aplicação web progressiva (PWA) de luxo para salão de estética de unhas e nail designer, dividida em 3 portais independentes com isolamento criptográfico por tokens:
1. **Portal da Cliente (`index.html`)**: Catálogo de serviços com Stories padrão Instagram, banners expansivos em alta definição, agendamento interativo em modal popup sem rolagem de tela indesejada, notificações e sincronização em tempo real.
2. **Painel da Administradora (`admin.html`)**: Gestão de agenda, calendário interativo, controle de clientes, edição livre de categorias e serviços, precificação, métricas financeiras, acompanhamento de metas com indicadores visuais reais, integração com Google Agenda e visualizador seguro do Portal da Cliente embarcado sem deslogar da conta admin.
3. **Área do Dono / Master (`master.html`)**: Rotação criptográfica de chaves/tokens SHA-256, logs de segurança, estatísticas de acessos e monitoramento geral do estúdio.

---

## 2. Tecnologias e Camadas
- **Frontend Core**: HTML5 Semântico, CSS3 Moderno (Variáveis CSS, CSS Grid, Flexbox, Animações Suaves), JavaScript ES6+ Nativo sem dependência de frameworks pesados (desempenho instantâneo no celular).
- **Gerenciador de Estado Global (`assets/js/store.js`)**: `window.EPStore` encapsula armazenamento local (`localStorage`), sincronização entre abas (`BroadcastChannel` e eventos de `storage`), persistência na nuvem via SSE/ntfy e motor gráfico de alto contraste para temas claros e escuros.
- **Service Worker (`sw.js`)**: Cache inteligente offline-first, atualização rápida com versionamento de cache para evitar que celulares fiquem com versões antigas presas na memória.

---

## 3. Principais Funcionalidades e Regras de Negócio

### 3.1 Agendamentos & Modal Popup Direto
- Ao clicar em **"Agendar"** dentro dos Stories de um serviço ou na lista do catálogo, a aplicação abre **diretamente a área de agendamento em um modal popup** (`#modalAgendamentoPopup`), eliminando a rolagem brusca até o rodapé da página.
- Horários agendados por qualquer cliente são imediatamente travados e saem da grade de opções dos demais usuários em tempo real.
- Suporte para exportação direta para **Google Agenda** e download de arquivo `.ics` para adicionar ao calendário nativo do celular (iOS / Android).

### 3.2 Painel Administrativo & Dashboard
- **Layout Responsivo**: Fluido em smartphones e adaptado em grid de 2 a 4 colunas em tablets e PCs.
- **Eliminação de Loops de Renderização**: Observer de mutação estático para garantir estabilidade visual, impedindo piscamento de telas e sobreposição de abas.
- **Visualizador Embutido**: Permite que a administradora visualize o aplicativo exatamente como a cliente vê através de um modal com iframe isolado (`#modalPortalClienteInApp`), mantendo o token de administração intacto.

### 3.3 Temas e Motor Gráfico
- Paleta configurável pela administradora (Vinho/Marsala oficial `#350B19`, Dourado Rosé `#D83F79` e superfícies adaptativas).
- O motor gráfico ajusta o contraste de textos, títulos, valores e botões tanto para fundos claros quanto para fundos escuros/pretos, evitando textos ilegíveis.

---

## 4. Histórico Recente de Alterações
- **v21**: Sincronização em tempo real de fotos e dados entre aparelhos via SSE e chunks criptografados.
- **v22**: Abertura direta do agendamento em modal popup ao clicar em agendar nos Stories ou Catálogo.
- **v23**: Correção de piscamento no Painel Administrativo, estabilização dos recálculos do motor gráfico de cores e criação desta documentação mestra para guiar todas as próximas intervenções.
