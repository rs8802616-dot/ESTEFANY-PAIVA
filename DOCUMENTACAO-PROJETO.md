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
- **v24**: Correção crítica de renderização da página da administradora (admin.html), blindagem do ciclo de inicialização DOMContentLoaded com tratamento de exceções resiliente e correção da navegação offline no Service Worker para nunca redirecionar o admin para a home do cliente.
- **v25**: Eliminação definitiva dos blocos brancos e cortes visuais na tela do celular:
  1. **Remoção de Camadas Fantasmas no Android/Chrome**: Modais administrativos (.admin-modal-overlay) e do cliente (.client-modal-overlay) agora utilizam 'display: none !important' e 'visibility: hidden !important' quando inativos, impedindo que o motor gráfico do navegador (Blink/GPU) desenhe superfícies brancas ou sobreponha iframes (#modalPortalClienteInApp) sobre as telas do app.
  2. **Renderização Sob Demanda e Isolada por Aba**: A função switchAdminTab() agora dispara a renderização segura da aba ativa (dashboard, agenda, clientes, serviços, relatórios), com scroll top instantâneo.
  3. **Tolerância a Falhas**: Todas as funções dentro de refreshAllAdminViews() foram isoladas em blocos try/catch independentes.
  4. **Estados Vazios Elegantes**: Fallbacks visuais adicionados para clientes e serviços quando a base de dados estiver vazia.
  5. **Purga Automática de Cache**: Versão do Service Worker elevada para 'estefany-nails-v25-fix-mobile-modal-overlay-cutoffs' para atualização imediata no celular do usuário.
- **v26**: Abertura do Agendamento em Tela Toda e Correção da Grade do Calendário no Celular:
  1. **Agendamento em Tela Toda (Full Screen)**: O modal de agendamento (#modalAgendamentoPopup) agora abre ocupando 100% da tela do celular (tela cheia), com barra superior elegante estilo app nativo (botão "Voltar", título com ícone e botão de fechar), proporcionando uma experiência de uso fluida sem sensação de caixa flutuante apertada.
  2. **Correção Definitiva do Calendário (Zero Vazamento)**: Ajustada a grade do calendário (.calendar-days-grid e .calendar-weekdays-row) com colunas fluidas repeat(7, minmax(0, 1fr)), eliminando a quebra e corte da coluna de sábado (Sáb) nas laterais dos celulares.
  3. **Trava de Rolagem de Fundo**: Ao abrir o agendamento em tela cheia, o scroll do corpo da página é bloqueado (overflow: hidden) e restaurado ao fechar.
  4. **Atualização do Cache PWA**: Versão do Service Worker elevada para 'estefany-nails-v26-fullscreen-booking-calendar-fix'.
- **v27**: Visualizador de Stories em Tela Toda (Padrão Oficial Instagram) e Fatiamento de Vídeos em 60s:
  1. **Visualizador de Stories Edge-to-Edge (100% da Tela)**: O modal de Stories (#modalStoryViewer) agora ocupa 100% da tela do celular sem bordas pretas externas, com imagens e vídeos em 'object-fit: cover', barras de progresso finas no topo e cabeçalho nativo com avatar, nome da profissional, selo verificado e tempo decorrido.
  2. **Rodapé Oficial Estilo Instagram**: Adicionada pílula de interação "Enviar mensagem / Agendar...", botão de curtir com coração flutuante animado e botão de WhatsApp direto para conversão.
  3. **Segurar para Pausar (Press & Hold)**: Ao pressionar e segurar na tela, o story pausa a reprodução do vídeo e do timer, ocultando os controles suavemente; ao soltar, a reprodução é retomada automaticamente.
  4. **Fatiamento Automático de Vídeos em Partes de até 1 Minuto (60s)**: Seguindo a regra do Instagram, vídeos com duração superior a 60 segundos são automaticamente fatiados em segmentos sucessivos de no máximo 60 segundos (Parte 1/2, Parte 2/2, etc.), cada um com sua barrinha independente no topo.
  5. **Purga Automática de Cache**: Versão do Service Worker elevada para 'estefany-nails-v27-instagram-stories-fullscreen-60s-split'.
- **v28**: Correção da foto de perfil que não atualizava nos outros aparelhos:
  1. **Causa**: `saveSalonSettings()` enviava para a nuvem (ntfy) o objeto de configurações INTEIRO, incluindo banners e imagens em Base64. O pacote ficava enorme (acima do limite de 180KB, sendo descartado sem aviso) ou gerava dezenas de partes, batendo no limite de requisições (erro 429). Resultado: a foto nova nunca chegava no celular da cliente, que continuava mostrando a imagem padrão.
  2. **Envio só do que mudou (delta)**: agora apenas os campos alterados são publicados, com um carimbo `settingsUpdatedAt`; a foto de perfil (pequena) chega em poucos pacotes.
  3. **Reenvio com nova tentativa**: `_postToCloud()` tenta de novo automaticamente em caso de erro 429/rede (até 4 tentativas).
  4. **Retrato do perfil (snapshot)**: ao abrir o painel admin, `publishProfileSnapshot()` reenvia foto + dados principais (no máximo a cada 4h), porque o histórico da nuvem expira em ~12h e aparelhos que abrem depois não recebiam nada.
  5. **Proteção contra eventos antigos**: um evento de configuração mais antigo não sobrescreve uma alteração mais nova.
  6. **Limitação conhecida**: sem banco de dados próprio, a sincronização depende do canal ntfy (histórico de ~12h). Para garantia total e permanente, o ideal é um backend (ex: Firebase/Supabase).
  7. Cache do Service Worker: `estefany-nails-v28-fix-profile-photo-sync`.
