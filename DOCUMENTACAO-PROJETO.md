# DOCUMENTAÇÃO OFICIAL DO PROJETO: ESTEFANY PAIVA NAILS
**Data da Última Atualização:** 19/11/2026  
**Versão Atual:** **v37 (React 19 + TypeScript + Vite + Tailwind v4 + Firebase Firestore/Auth + PWA)**  
**Repositório:** `https://github.com/rs8802616-dot/ESTEFANY-PAIVA.git`  
**Branch:** `main`  
**Hospedagem:** Vercel (`paiva-nails.vercel.app`)

---

## 1. Arquitetura Atual (v37)
O projeto foi migrado para a arquitetura completa em **React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + Motion + Firebase 13 (Firestore + Google Auth) + VitePWA**, baseada no pacote oficial `estefany-paiva-nails.zip` gerado a partir do `PRD-ESTEFANY-PAIVA-NAILS.md`.

### Estrutura Principal
- **`src/App.tsx`**: Roteamento unificado entre **Portal da Cliente** (`/`) e **Painel Administrativo** (`#/admin`, `/admin` ou `/admin.html`), com hidratação síncrona de configurações para evitar piscar imagens antigas e sincronização em tempo real via Firestore `onSnapshot`.
- **`src/lib/firebase.ts` & `firebase-applet-config.json`**: Conexão ativa com o projeto Firebase (`adega-delivery-pdv`, banco Firestore `ai-studio-2b450244-1a2e-44b5-b80e-5608c17cd674`, login Google Auth com admin bootstrap `rs8802616@gmail.com`).
- **`src/lib/db.ts`**: Camada de dados em tempo real com Firestore (configurações do estúdio, categorias, serviços, agendamentos, bloqueios de disponibilidade e ficha técnica de clientes).
- **`src/components/client/`**:
  - `ClientPortal.tsx` — Portal da Cliente nativo mobile/tablet com catálogo, filtros, banner hero e acesso aos agendamentos.
  - `BookingSheet.tsx` — Bottom Sheet / tela cheia de agendamento com combo de serviços, calendário interativo, bloqueio por duração, Pix Copia e Cola, WhatsApp e Google Agenda/`.ics`.
  - `ClientAppointmentsSheet.tsx` — Consulta de horários e remarcação online respeitando regra de antecedência.
- **`src/components/admin/`**:
  - `AdminPanel.tsx` — Painel administrativo com autenticação Google Firebase e navegação responsiva (sidebar fixa em tablets/desktop + barra inferior mobile).
  - `AdminAgendaTab.tsx`, `AdminClientsTab.tsx`, `AdminCatalogTab.tsx`, `AdminReportsSettingsTabs.tsx` — Gestão completa de agenda, mensagens prontas de WhatsApp, clientes + ficha técnica + retorno 21+ dias, serviços/categorias, relatórios e configurações.
- **`firestore.rules` & `firestore.rules.test.ts`**: Regras de segurança de produção do Cloud Firestore.
- **`vite.config.ts` & `vercel.json`**: Build Vite + PWA (`vite-plugin-pwa`) com geração automática de Service Worker/Manifesto e rewrites SPA na Vercel.

---

## 2. Comandos Principais
- `npm install` — Instala as dependências.
- `npm run dev` — Inicia servidor local de desenvolvimento (`localhost:3000`).
- `npm run lint` — Validação de tipos TypeScript (`tsc --noEmit`).
- `npm run build` — Gera build de produção otimizado em `dist/`.

---

## 3. Histórico de Versões Recentes
- **v34**: Reconstrução modular sem `!important` e remoção de dados falsos/senhas expostas.
- **v35**: Preparação da camada de dados para Firebase Firestore + Auth.
- **v36**: Redesign para visual de aplicativo nativo mobile/tablet + criação do `PRD-ESTEFANY-PAIVA-NAILS.md`.
- **v37**: **Implantação Completa do App React 19 + TypeScript + Vite + Tailwind v4 + Firebase Firestore/Auth + VitePWA**:
  1. Migração integral do pacote `estefany-paiva-nails.zip` para o repositório oficial (`main`), removendo arquivos legados estáticos.
  2. Configuração de `vercel.json` com rewrites SPA para suportar `/`, `/admin`, `/admin.html` e `#/admin` sem erro 404 na Vercel.
  3. Ajuste em `src/App.tsx` para reconhecer tanto `#/admin` quanto `/admin` e `/admin.html` na URL inicial.
  4. Validação completa de TypeScript (`npm run lint`) e build de produção (`npm run build`).
- **v38**: **Isolamento Total da Área Administrativa em Rota Separada (`/admin`)**:
  1. Removidos todos os 4 botões/links de acesso ao Painel Admin que apareciam no Portal da Cliente (`src/components/client/ClientPortal.tsx`): menu superior, botão de cadeado mobile, aba "O Estúdio" e rodapé.
  2. Clientes acessando a raiz (`/`) veem exclusivamente o Portal de Agendamento, sem nenhuma referência à área administrativa.
  3. O Painel Administrativo é acessado exclusivamente pela rota dedicada **`/admin`** (também compatível com `/admin.html` e `#/admin`), e o botão de visualizar o site abre `/` em uma nova aba isolada.
- **v39**: **Segurança Bancária no Admin (Token Criptográfico SHA-256 na URL + Login E-mail/Senha Firebase) & Portal da Cliente Minimalista/Responsivo**:
  1. **Rota Secreta com Token Criptográfico (`src/lib/adminRoute.ts`)**: O acesso à tela de login administrativa agora exige token secreto na URL (`/painel?k=SEU_TOKEN`), validado por hash `SHA-256` (`VITE_ADMIN_TOKEN_HASH` configurado exclusivamente nas variáveis de ambiente da Vercel — zero segredos no Git). Sem o token válido, qualquer tentativa de acessar `/admin` ou `/painel` redireciona silenciosamente para o Portal da Cliente. Após validado, o token é imediatamente limpo da barra de endereços.
  2. **Login com E-mail e Senha (Criptografia Firebase Auth — `scrypt` + TLS 1.3)**: Substituído o login Google Popup em `AdminPanel.tsx` e `src/lib/firebase.ts` por formulário seguro de E-mail e Senha (`signInWithEmailAndPassword`), com botão de mostrar/ocultar senha, recuperação de senha por e-mail (`sendPasswordResetEmail`) e reenvio de confirmação de e-mail. Removido o e-mail hardcoded do código-fonte (`VITE_ADMIN_EMAIL`).
  3. **Portal da Cliente Limpo e Responsivo (`ClientPortal.tsx`)**: Eliminada a repetição excessiva de nomes/textos/descrições (removido o bloco duplicado de perfil, subtítulos longos e descrições extensas nos cards). Agora exibe barra compacta no celular, banner hero limpo e cards enxutos (**Foto + Nome + Duração + Preço + Combo + Agendar**) adaptados de forma fluida para celular, tablet e desktop.
- **v40**: **Bloqueio Total de `/admin` e `#/admin` + Validação Obrigatória de Hash SHA-256 Out-of-the-Box**:
  1. Em `src/lib/adminRoute.ts`, as rotas óbvias `/admin` e `#/admin` agora são **100% bloqueadas** e redirecionam imediatamente para `/` (Portal da Cliente).
  2. Removido o fallback que liberava a tela caso a variável de ambiente não estivesse preenchida na Vercel: a validação do hash irreversível `SHA-256` agora é **sempre exigida**, liberando a tela de login exclusivamente pelo link com token `/painel?k=<SEU_TOKEN>`.
  3. Cache do Workbox PWA elevado para `estefany-nails-v40-token-gate-locked`.


### v41 — Design System Luxury Nude, Biblioteca de Componentes e 33 Telas Obrigatórias (React / React Native / Expo + TypeScript)
- **Paleta Oficial Luxury Nude Aplicada em 100% do Sistema**:
  - Nude: `#E8D6CB`
  - Rosé: `#BE9293`
  - Dourado: `#C4A477`
  - Creme: `#FAF6F1`
  - Branco: `#FFFFFF`
  - Marrom: `#594943`
  - Texto secundário: `#95847C`
  - Fundo suave: `#F2EAE4`
- **Tipografia Oficial**: `Playfair Display` (títulos editoriais) e `Inter` (textos, botões, formulários e indicadores).
- **Arquitetura de Tokens & Componentes Reutilizáveis**:
  - `src/theme/luxuryNudeTheme.ts`: Tokens tipados (`LUXURY_NUDE_PALETTE`, `LUXURY_TYPOGRAPHY`, `MANDATORY_SCREENS_33`) prontos para Web e React Native / Expo + TypeScript.
  - `src/components/ui/LuxuryDesignSystem.tsx`: Componentes reutilizáveis (`LuxuryStateView` com estados de carregamento, sucesso, erro e ausência de dados; `LuxuryKpiCard`; `LuxuryBarChart`).
- **Menu Inferior Oficial de 5 Itens**: `Início`, `Agenda`, `Clientes`, `Financeiro` e `Perfil`.
- **33 Telas Obrigatórias Implementadas e Navegáveis**:
  - **1–6**: `1. Login`, `2. Abertura`, `3. Dashboard`, `4. Calendário`, `5. Novo agendamento`, `6. Detalhes do agendamento`.
  - **7–11 (Público)**: `7. Página pública`, `8. Escolha de serviços`, `9. Escolha de data e horário`, `10. Dados da cliente`, `11. Confirmação`.
  - **12–16 (Clientes & Serviços)**: `12. Lista de clientes`, `13. Cadastro de clientes`, `14. Perfil da cliente`, `15. Catálogo de serviços`, `16. Cadastro de serviços`.
  - **17–24 (Módulo Financeiro em `src/components/admin/AdminFinanceSuite.tsx`)**: `17. Resumo financeiro`, `18. Receitas`, `19. Despesas`, `20. Fluxo de caixa`, `21. Contas a pagar e receber`, `22. Fechamento mensal`, `23. Relatórios gerais`, `24. Relatórios de desempenho`.
  - **25–33 (Módulo Perfil, Galeria & Configurações em `src/components/admin/AdminProfileSuite.tsx`)**: `25. Galeria`, `26. Adicionar fotografia`, `27. Central de comunicação`, `28. Perfil`, `29. Horários de funcionamento`, `30. Configurações de agendamento`, `31. Personalização da página pública`, `32. Segurança`, `33. Ajuda e suporte` (com Mapa Interativo 1-clique para todas as 33 telas).


### v42 — Bloqueio Estrito da Rota sem Token + Cofre Criptográfico PBKDF2-HMAC-SHA256 (250.000 iterações) + Atualização Imediata do Service Worker
- **Por que o navegador ainda abria sem o token antes e como foi resolvido**:
  1. Na versão anterior, ao abrir `/painel?k=...` uma vez, o `sessionStorage` marcava a aba como desbloqueada mesmo antes do login, permitindo acessar `/painel` sem `?k=...` na mesma aba; além disso, o Service Worker antigo do PWA permanecia em estado `waiting` no Chrome até fechar todas as abas.
  2. Agora, em `src/lib/adminRoute.ts`, `/admin`, `#/admin` e `/painel` (sem `?k=<TOKEN>`) são **100% bloqueados e redirecionam imediatamente para `/`** sempre que a administradora não estiver autenticada com login e senha.
  3. Em `vite.config.ts` e `src/main.tsx`, foram ativados `skipWaiting: true`, `clientsClaim: true` e `cleanupOutdatedCaches: true` (`cacheId: 'estefany-nails-v42-strict-token-vault'`) para forçar a atualização imediata do PWA no navegador.
- **Autenticação Bancária PBKDF2-HMAC-SHA256 (250.000 iterações)**:
  - Implementada em `src/lib/adminRoute.ts` via Web Crypto API (`crypto.subtle.deriveBits` com `PBKDF2`, `SHA-256`, `250000` iterações e salt criptográfico), funcionando imediatamente mesmo quando o provedor `PASSWORD_LOGIN_DISABLED` do Firebase Console ainda não foi habilitado, sem armazenar nenhum login, senha ou token em texto puro no código ou no Git.


### v43 — Aba Lateral Recolhível (Menu 2 Traços), Expansividade no Tablet Horizontal, Persistência da Sessão Admin no Tablet e Visualização da Cliente sem Sair do Painel
- **Aba Lateral Recolhível com Botão "Menu 2 Traços" (`src/components/admin/AdminPanel.tsx`)**:
  - A barra lateral marrom (`<aside>`) agora fica **recolhida por padrão** (`-translate-x-full`) para não roubar espaço da tela no tablet.
  - Adicionado botão **"Menu 2 Traços"** (ícone de duas barras horizontais) no topo esquerdo que abre e recolhe a aba lateral suavemente com backdrop.
- **Expansividade Total no Tablet Horizontal & Correção do Bug Visual da 2ª Imagem**:
  - O container principal foi expandido para `w-full max-w-[1600px]` (sem margem esquerda fixa `md:pl-64` e sem `max-w-2xl`/`max-w-3xl` nos formulários).
  - Removidas as barras de rolagem horizontais e verticais internas (`overflow-x-auto` / `max-h-72 overflow-y-auto`) que cortavam botões ao meio em `AdminProfileSuite.tsx` (Telas 25 a 33), `AdminFinanceSuite.tsx` (Telas 17 a 24) e no navegador rápido das 33 telas, substituindo por grids responsivos completos (`grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9`) e eliminando a duplicação do mapa na Tela 33.
- **Persistência da Sessão Admin ao Fechar e Reabrir o App no Tablet (`src/lib/adminRoute.ts`)**:
  - A sessão autenticada com token + login/senha agora é persistida no `localStorage` (`VAULT_PERSISTENT_MODE_KEY = 'admin'`). Ao fechar o app no tablet/celular e abrir novamente, ele abre direto no **Painel Admin (`/painel`)** em vez de voltar para a tela da cliente (só volta ao modo cliente quando a administradora clica em **"Sair do painel"**).
- **Visualização da Tela da Cliente sem Sair do Link do Admin (`src/App.tsx`)**:
  - Ao clicar em **"Ver Tela da Cliente"** (ou nas Telas 7 a 11), a administradora **não sai mais de `/painel`**: a tela da cliente é exibida dentro do próprio painel com uma barra superior fixa **"Modo Visualização (Telas 7 a 11) • ← Voltar ao Painel da Admin"** para retornar à gestão em 1 clique.


### v44 — Auditoria Multi-Agente (3 Agentes Simuladores) e Correção Integral de Todas as Funções e Fluxos
- **Motor Híbrido Reativo Cloud + Local (`src/lib/localClientStore.ts` e `src/lib/db.ts`)**:
  - Implementado barramento reativo em tempo real (`subscribeLocalStoreChanges` / `notifyLocalStoreChanges`) integrado a todas as coleções (`salon_settings`, `categories`, `services`, `appointments`, `availability_slots`, `personal_blocks`, `client_tech_notes`).
  - Todas as funções administrativas (**Novo Horário / Encaixe**, **Confirmar / Concluir / Cancelar / Excluir Agendamento**, **Marcar Pix Pago**, **Remarcar Horário**, **Criar / Excluir Bloqueio Pessoal**, **Criar / Editar / Excluir Serviços e Categorias**, **Criar / Editar Ficha Técnica de Clientes** e **Salvar Configurações**) agora atualizam a interface em **0ms** e persistem tanto localmente quanto no Cloud Firestore, sem falhar quando autenticadas via cofre PBKDF2-HMAC-SHA256.
- **Agenda Administrativa (`src/components/admin/AdminAgendaTab.tsx`)**:
  - Adicionado controle completo de **Remarcar Data e Horário** dentro da Tela 6 (Detalhes do Atendimento).
  - Corrigido o cadastro de encaixe administrativo (**Tela 5 — Novo Horário**) para formatar `clientUid` e status de forma compatível com as regras do Firestore e atualizar o calendário instantaneamente.
- **Módulo Financeiro (`src/components/admin/AdminFinanceSuite.tsx` — Telas 17 a 24)**:
  - Separadas **Receitas Realizadas** (`confirmed` | `completed`) de **Valores a Receber** (`pending`), eliminando dupla contagem.
  - Gráfico semanal (**Telas 17 e 20**) conectado aos valores reais por dia da semana (`Seg` a `Sáb`).
  - Adicionado botão de exclusão (`Trash2`) para receitas extras manuais na **Tela 18**.
  - Adicionados seletor de data, seletor `Pago` / `A pagar` e botão de alternância rápida (`Pago` <-> `A pagar`) na **Tela 19 (Despesas)**.
  - Adicionado botão **"Confirmar"** em **Valores a Receber (Tela 21)** para dar baixa em agendamentos pendentes com 1 clique.
- **Módulo Perfil, Galeria & Configurações (`src/components/admin/AdminProfileSuite.tsx` — Telas 25 a 33)**:
  - Sincronização automática via `useEffect` do formulário com `settings` e da lista de clientes na **Tela 27 (Central de Comunicação)**.
  - Adicionado filtro `'Spa'` na **Tela 25 (Galeria)** e validação do WhatsApp via `buildWhatsAppUrl` (evitando duplicação do prefixo `55`).
  - Adicionado botão **"Gerar do Expediente"** e proteção para manter ao menos 1 dia útil ativo na **Tela 29 (Horários)**.
  - Adicionados campo **Cidade do Pix (BACEN)** e gerenciador completo de **Dias de Folga & Feriados (`blockedDates`)** na **Tela 30 (Configurações de Agendamento)**.
- **Portal da Cliente & Agendamento (`src/components/client/ClientPortal.tsx`, `BookingSheet.tsx`, `CalendarPicker.tsx` e `src/lib/utils.ts` — Telas 7 a 11)**:
  - **Pix Copia e Cola Padrão BACEN**: `generatePixPayload` agora normaliza chaves de telefone formatadas (como `(61) 98554-3452`) para o padrão internacional E.164 (`+5561985543452`), CPF/CNPJ, e-mail e EVP.
  - **Seleção de Serviços Dentro do Modal (Tela 8)**: Ao clicar em `"Agendar Agora"` sem ter pré-selecionado um serviço no catálogo, o modal exibe a lista interativa de procedimentos para escolha imediata sem precisar fechar a janela.
  - **Validação Automática de Horário (`CalendarPicker.tsx`)**: Limpa automaticamente `selectedTime` caso a cliente altere a data ou adicione mais procedimentos cuja duração ultrapasse o expediente.


### v45 — Suíte de Inteligência Financeira (BI), Gráficos Interativos SVG e Novas Funções Analíticas (Telas 17 a 24)
- **Novos Componentes de Gráficos Interativos em SVG (`src/components/ui/LuxuryDesignSystem.tsx`)**:
  - `LuxuryBarChart` (Reformulado): Eixo Y com escala em Reais (`R$`), linhas de grade pontilhadas, barras largas com gradiente Luxury Nude, rótulos de valor no topo de cada barra, inspeção interativa ao clicar na coluna (exibindo `Receitas`, `Despesas` e `Saldo` do dia/período) e rodapé analítico (`Maior Pico`, `Média por Período` e `Resultado Líquido`).
  - `LuxuryAreaLineChart` (Novo): Gráfico de curva de área em SVG com preenchimento degradê dourado (`#C4A477`), linha de evolução do saldo acumulado (`#594943`), linha tracejada de saídas (`#BE9293`) e pontos clicáveis com valores.
  - `LuxuryDonutChart` (Novo): Gráfico de rosca (Donut SVG) interativo com seleção de fatias ao toque, valor central dinâmico e legenda com percentuais (`%`).
  - `LuxuryGaugeCard` (Novo): Velocímetro semicircular em SVG ("Termômetro da Meta & Ponto de Equilíbrio") que calcula automaticamente quantos atendimentos faltam para bater a meta mensal e quanto falta para cobrir 100% dos custos (Break-Even).
- **Novas Funções no Módulo Financeiro (`src/components/admin/AdminFinanceSuite.tsx` e `src/components/admin/AdminReportsSettingsTabs.tsx`)**:
  - **Seletor Dinâmico de Período dos Gráficos**: Alternância instantânea entre **`Seg–Sáb` (Visão Diária)**, **`Semanas` (Semana 1 a 4 do Mês)** e **`6 Meses` (Visão Semestral)**.
  - **Botões `"Carregar Exemplo"` e `"Zerar Manuais"`**: Carrega movimentação realista distribuída de Segunda a Sábado para visualização imediata de todos os gráficos ou limpa os lançamentos manuais com 1 clique.
  - **Tela 20 (`20. Fluxo de Caixa Consolidado`)**:
    - 4 KPIs (`Entradas Realizadas`, `Saídas Realizadas`, `Saldo em Caixa`, `Saldo Projetado c/ Pendentes`).
    - **Lançamento Rápido no Fluxo de Caixa**: Permite registrar uma `(+)` Entrada ou `(-)` Saída escolhendo o dia (`Seg` a `Sáb`) diretamente na Tela 20 e ver os gráficos subirem na hora.
    - **Seletor de Visualização**: `Barras + Curva`, `Só Barras` ou `Só Curva SVG`.
    - **Tabela Analítica de Extrato por Período** com `Entradas (+)`, `Saídas (-)`, `Resultado do Dia` e `Saldo Acumulado`.
  - **Tela 23 (`23. Relatórios Gerais`)**: Adicionados **Gráfico de Rosca por Forma de Pagamento (Pix Online vs Presencial)** e **Ranking Top Clientes VIP (Fidelidade & LTV)**.
  - **Tela 24 (`24. Desempenho`)**: Adicionados **Gráfico de Rosca de Share por Procedimento** e a **Calculadora de Lucratividade Real & Ganho por Hora Trabalhada** (calcula lucro líquido livre de insumos/taxas, ganho por hora de mesa `R$/h`, margem `%` e preço sugerido para 75% de margem).


### v46 — Sincronização em Tempo Real entre Dispositivos (Celular da Cliente → Painel Admin no PC/Tablet) e 4 Modelos de Gráficos Modernos (Estilo Nubank / Apple Health / Spline Bezier)
- **Por que os agendamentos feitos no celular não apareciam no Admin antes e como foi resolvido (`src/lib/db.ts`)**:
  - No Cloud Firestore (`adega-delivery-pdv`), a coleção privada `appointments` exige token de autenticação do Firebase (`request.auth != null`), enquanto o login administrativo via cofre PBKDF2-HMAC-SHA256 opera sem depender do `PASSWORD_LOGIN_DISABLED` do Firebase Auth. Por outro lado, a coleção pública `availability_slots` (`where('active', '==', true)`) é **100% sincronizada em tempo real entre todos os aparelhos** (celular, tablet e computador).
  - Agora, `createAppointmentAtomic` codifica os metadados do agendamento (telefone, valor, forma de pagamento, índices dos serviços e nome da cliente) diretamente no identificador compatível com `isGuestUid` (`guest_<phone>_<price>_<px|pr>_<svcIdx>_<nameSlug>`), e `subscribeAllAppointmentsAdmin` escuta `availability_slots` em tempo real via `onSnapshot`, decodificando tanto os novos agendamentos feitos no celular quanto os 3 agendamentos já realizados hoje (`09:00`, `12:00` e `14:00` com `(61) 98542-9584` / `(61) 98542-9585`)!
- **4 Novos Modelos de Gráficos Modernos com Seletor em 1 Clique (`src/components/ui/LuxuryDesignSystem.tsx`)**:
  1. **Barras Horizontais Executivas (Estilo Nubank / Apple Health)**: Cards horizontais sem espaços vazios, com badge de recorde, trilhos duplos em degradê dourado/marrom (`Entradas`) e rosé (`Saídas`) e cálculo de saldo líquido ao lado.
  2. **Cápsulas Preenchidas (`Full-Track Capsules`)**: Colunas dentro de cápsulas completas com o valor em Reais e o saldo líquido integrados ao card.
  3. **Ondas Suaves Spline (`Smooth Cubic-Bezier Waves`)**: Curvas suaves contínuas com cálculo de pontos de controle Cubic Bezier (`C ...`), badges flutuantes e rótulos HTML nítidos.
  4. **Cards de Mapa de Calor (`Weekly Heatmap Cards`)**: Cards executivos por dia da semana com classificação automática de ritmo (`Alta Demanda`, `Bom Ritmo`, `Estável`).


### v47 — Gráficos Profissionais `Recharts` (mesmo padrão do App de Delivery) + Central Financeira Única Sem Duplicações
- **Biblioteca `Recharts` Integrada (`package.json`, `AdminFinanceSuite.tsx`)**:
  - Trazida do projeto `sistema-pizzaria` (`GraficosVendasPanel.tsx`) e adaptada para a paleta **Luxury Nude** (`#594943`, `#C4A477`, `#BE9293`, `#95847C`, `#FAF6F1`, `#E8D6CB`).
  - **Gráfico Principal Interativo (`AreaChart`, `BarChart` e `LineChart`)** com preenchimento degradê, linhas de grade, legenda, eixo Y em Reais e Tooltip flutuante ao passar o dedo/mouse.
  - **Ranking Horizontal de Procedimentos (`BarChart layout="vertical"`)** com alternador entre `R$ Faturamento` e `Qtd` (igual ao "Top Produtos Mais Vendidos" do delivery).
  - **Gráfico de Rosca (`PieChart` Donut)** com alternador único entre `Receitas` (por origem/pagamento) e `Despesas` (por categoria).
- **Central Financeira Unificada em Um Único Local (Zero Poluição e Zero Duplicação)**:
  - Removidas as 8 sub-abas repetidas (`17. Resumo` a `24. Desempenho`). Agora todas as áreas financeiras, gráficos, lançamento único (`(+) Receita` / `(-) Despesa`), contas a pagar/receber, fechamento DRE, calculadora de lucro por hora e extrato estão organizados de forma limpa em uma única tela contínua (mantendo o salto automático pelas âncoras caso o usuário clique no Mapa das 33 Telas).


### v48 — Fidelidade Total ao Painel de Relatórios do AtendeJá (`GraficosVendasPanel.tsx`) na Paleta Luxury Nude
- **Novos Blocos Fiéis ao `AtendeJá` (`src/components/admin/AdminFinanceSuite.tsx`)**:
  - **Botão "Copiar Resumo"** na barra superior: copia o resumo executivo formatado pronto para enviar no WhatsApp.
  - **Gráfico de Rosca (`PieChart`) com "Total Mix" centralizado + Legenda Detalhada** exibindo cada categoria com `%` e `R$`.
  - **Horários de Pico do Studio (`BarChart` 08h–18h)** com cores dinâmicas por volume de atendimentos e badge indicando o horário de pico.
  - **Receitas por Forma de Pagamento** com barras de progresso, ícones (`Pix`, `Cartão`, `Presencial/Dinheiro`), percentuais e valores exatos.
  - **Tabela Analítica de Performance de Serviços com Busca Instantânea**: medalhas de Rank (`1º`, `2º`, `3º`), Preço Médio, Qtd Vendida, Faturamento Total e `% do Total` com mini-barra de progresso.


### v49 — Controle de Meses Abertos/Fechados + Ciclo de Manutenção por Serviço + Lembretes 5 Dias Antes
- **Abrir / Fechar Meses da Agenda (`closedMonths` em `SalonSettings`, `AdminAgendaTab.tsx`, `CalendarPicker.tsx` e `utils.ts`)**:
  - Adicionado botão **"Abrir / Fechar Meses"** no topo da Agenda com os próximos 8 meses: a profissional escolhe com 1 clique quais meses ficam **Abertos** (cadeado aberto) ou **Fechados** (cadeado fechado) no calendário das clientes.
  - Quando um mês está fechado, o `CalendarPicker` bloqueia todos os dias desse mês para as clientes e exibe um aviso elegante informando que a agenda daquele mês ainda não foi aberta.
- **Ciclo de Manutenção por Procedimento (`maintenanceDays` em `Service` & `AdminCatalogTab.tsx`)**:
  - Cada procedimento agora possui o campo **"Prazo de Manutenção / Retorno (dias)"** (ex.: `21` dias para Unha em Gel / Fibra de Vidro).
- **Perguntar / Pré-Agendar Manutenção na Hora (`AdminAgendaTab.tsx`)**:
  - Nos detalhes de um atendimento confirmado ou concluído, aparece o painel **"Manutenção Recomendada (+21 dias)"** com 2 botões: **"Marcar Manutenção (+Xd)"** (abre o Novo Horário já preenchido com cliente, serviço e data futura) e **"Perguntar no WhatsApp"**.
- **Alerta Automático "5 Dias Antes" (`AdminPanel.tsx`, `AdminClientsTab.tsx` e `utils.ts`)**:
  - Quando faltam **5 dias ou menos** para vencer o ciclo de manutenção da cliente (e ela ainda não tem novo horário marcado), aparece automaticamente no Dashboard e na lista de Clientes com o selo **`Faltam Xd`** e botão **"Mandar Mensagem"** no WhatsApp com texto personalizado (`buildUpcomingMaintenanceWhatsAppUrl`).


### v50 — Skill `humanizar-textos-ia` + Humanização Completa dos Textos do Aplicativo e WhatsApp
- **Pesquisa & Criação da Skill `humanizar-textos-ia` (`.agents/skills/humanizar-textos-ia/SKILL.md` e `~/.gemini/config/skills/humanizar-textos-ia/SKILL.md`)**:
  - Mapeados os principais sinais de detecção de conteúdo gerado por IA documentados na Wikipédia (*Detecção de conteúdo gerado por inteligência artificial*) e na linguística computacional: **baixa perplexidade**, **baixo burstiness** (monotonia de ritmo), **repetição de n-grams / conectivos formais**, **neutralidade e polidez artificial (RLHF)** e **adjetivação vaga**.
- **Humanização dos Textos do App e Mensagens**:
  - `src/lib/defaults.ts`: Reescritos `tagline`, `bio`, `heroTitle`, `heroSubtitle` e todas as descrições dos 6 procedimentos padrão para linguagem natural, direta e acolhedora de estúdio real (sem clichês corporativos como *"assinatura editorial"*, *"com foco em"* ou *"impecável"*).
  - `src/lib/utils.ts` e `src/components/admin/AdminProfileSuite.tsx`: Reescritos os modelos de mensagens de WhatsApp (Lembrete, Pix, Pós-Atendimento, Retorno e Manutenção 5 dias antes) para soarem como conversa natural de WhatsApp da Estefany com suas clientes.
  - `src/components/admin/AdminPanel.tsx`, `AdminAgendaTab.tsx`, `AdminCatalogTab.tsx`, `AdminFinanceSuite.tsx`: Removidos jargões técnicos e bordões artificiais de interface, mantendo os textos curtos e naturais.
  - Cache do Workbox PWA elevado para `estefany-nails-v50-humanized-copy`.


### v51 — Tipografia Limpa (Sem Serifas de Template), Remoção do Ícone `Sparkles` (Ícone de IA) e Substituição de `&` por Linguagem Natural
- **Tipografia de App Real (`src/index.css` e `index.html`)**:
  - Alterado `h1, h2, h3, .font-editorial` para usar `Inter` (`var(--font-sans)`) com `letter-spacing: -0.015em`, eliminando a fonte serifada (`Playfair Display`) que dava aparência de template/IA nos títulos e nomes de procedimentos (como *"Spa dos Pés & Pedicure em Gel"*).
  - Título e metadados em `index.html` atualizados para `"Estefany Paiva Nails — Agendamento Online"` (removendo `"Luxury Nude Atelier"`).
- **Remoção Completa do Ícone `Sparkles` (associado a ferramentas de IA) e Emojis Decorativos**:
  - Substituídos todos os usos de `Sparkles` em `src/App.tsx`, `ClientPortal.tsx`, `AdminAgendaTab.tsx`, `AdminPanel.tsx`, `AdminProfileSuite.tsx` e `LuxuryDesignSystem.tsx` por ícones funcionais reais (`LayoutGrid`, `ShieldCheck`, `Calendar`, `Scissors`, `Layers`, `ChevronRight`, `TrendingUp`).
- **Títulos e Nomes Naturais sem `&` Comercial**:
  - Substituído `&` por `e` nos serviços e títulos principais (`Spa dos Pés e Pedicure em Gel`, `Banho de Gel e Blindagem`, `Seu Combo e Horário`, `Serviços e Categorias`, `Clientes e Ficha Técnica`, `Detalhes e WhatsApp`).
  - Cache do Workbox PWA elevado para `estefany-nails-v51-clean-typography-icons`.


### v52 — Atalhos Diretos para Editar Procedimentos, Preços e Fotos
- **Acesso Rápido no Início (Dashboard) e no Menu Lateral (`AdminPanel.tsx`)**:
  - Adicionados os botões **"Editar Procedimentos e Fotos"** e **"Foto de Capa e Perfil"** diretamente no topo do Dashboard (`Início`) e na barra lateral (`Menu 2 Traços`), eliminando a necessidade de procurar dentro da aba `Clientes` ou `Perfil`.
- **Prévia e Upload Simplificado (`AdminCatalogTab.tsx`)**:
  - Ao editar qualquer procedimento, agora aparece a prévia da foto atual selecionada e o botão **"Escolher foto do celular / PC"** em destaque.
  - Cache do Workbox PWA elevado para `estefany-nails-v52-easy-edit-services-photos`.


### v53 — Central Única de Configurações do Studio (Tudo em Um Só Lugar)
- **Unificação das Telas 28, 29, 30 e 31 (`AdminProfileSuite.tsx`)**:
  - Antes espalhadas em 4 abas e 4 formulários separados (`Perfil`, `Horários`, `Config. Agenda`, `Página Pública`), agora todas as configurações do aplicativo ficam em uma **única tela contínua** chamada **Configurações do Studio**.
  - Barra superior com atalhos internos (`1. Perfil e Foto`, `2. Horários`, `3. Pix, Sinal e Folgas`, `4. Capa e Textos do Site`) e **1 único botão "Salvar Tudo" / "Salvar Todas as Configurações"**.
  - Cache do Workbox PWA elevado para `estefany-nails-v53-unified-settings`.


### v54 — Bloqueio de Fechamento Acidental no Agendamento e Destaque do Botão `+ Combo`
- **Proteção contra clique fora do modal (`BottomSheet.tsx` e `BookingSheet.tsx`)**:
  - Adicionada a propriedade `closeOnBackdrop` em `BottomSheet.tsx` e configurada como `false` em `BookingSheet.tsx`, impedindo que a cliente saia do agendamento sem querer ao tocar fora da janela (agora fecha somente no botão `X` ou ao concluir).
- **Destaque do botão de Combo (`BookingSheet.tsx`)**:
  - Substituído o texto apagado `+ + Combo (adicionar outro serviço)` por um botão destacado em `#F2EAE4` com borda dourada `#C4A477`, ícone em bloco escuro `#594943` e selo `+ Combo`.
  - Cache do Workbox PWA elevado para `estefany-nails-v54-booking-modal-lock-and-combo-highlight`.


### v55 — Correção Crítica: Proteção Contra Reversão de Fotos e Textos Salvos (`db.ts`, `localClientStore.ts` e `utils.ts`)
- **Por que as fotos voltavam para as fotos de teste ao salvar:**
  - `subscribeSalonSettings` e `subscribePublicServices` aplicavam `...(snap.data())` e `saveLocalServices(cloudList)` **por cima** dos dados recém-salvos localmente quando o Firestore estava em modo cofre local (sem token Firebase Auth) ou antes da confirmação na nuvem, sobrescrevendo imediatamente a foto escolhida pela administradora.
- **Solução Definitiva:**
  - Adicionado controle de alterações locais pendentes (`isSettingsDirtyLocal`, `getDirtyServiceIds`, `getDeletedServiceIds`) em `src/lib/localClientStore.ts` e `src/lib/db.ts`: snapshots antigos do Firestore **nunca** sobrescrevem fotos, textos ou serviços editados localmente até que a gravação na nuvem seja confirmada com sucesso.
  - Reforçada a compressão em `compressImageToDataUrl` (`src/lib/utils.ts`) com redução progressiva de escala e qualidade para garantir imagens sempre `<= 220.000` bytes (dentro do limite de `250.000` bytes do Firestore).
  - Cache do Workbox PWA elevado para `estefany-nails-v55-fix-photo-revert-dirty-guard`.


### v56 — Sincronização na Nuvem entre Aparelhos + Fim do Vazamento Lateral no Celular e Tablet
- **Sincronização em Todos os Aparelhos (`db.ts` e `AdminPanel.tsx`)**:
  - Criada a função `syncPendingLocalChangesToCloud()` em `src/lib/db.ts` para enviar automaticamente alterações locais pendentes (fotos de capa/perfil, configurações e procedimentos) para o Cloud Firestore assim que a sessão Firebase Auth estiver ativa.
  - Adicionado aviso claro no topo do Painel Admin quando a sessão está apenas no cofre local (sem token do Firebase Auth), com botão de 1 clique **"Conectar Google e Sincronizar"** (`signInWithGoogle()`), liberando imediatamente a gravação em nuvem para celulares de clientes e outros aparelhos.
- **Fim do Vazamento Horizontal no Tablet e Celular (`index.css`, `ClientPortal.tsx`, `AdminPanel.tsx`)**:
  - Adicionado `overflow-x: hidden; max-width: 100%;` global em `html, body` e nos containers principais do Portal da Cliente e do Painel Admin.
  - Ajustada a barra superior do Admin para `hidden xl:flex` (e barra inferior `xl:hidden`), impedindo que a barra de 5 abas estoure a largura em tablets horizontais (`1024px`).
  - Cache do Workbox PWA elevado para `estefany-nails-v56-cloud-sync-and-overflow-fix`.


### v57 — Feedback Transparente de Sincronização na Nuvem + Fallback `signInWithRedirect` para Popups Bloqueados
- **Retorno de Sincronização Real (`db.ts`, `AdminCatalogTab.tsx`, `AdminProfileSuite.tsx`)**:
  - `adminSaveSettings` e `adminSaveService` agora retornam `boolean` indicando se a gravação foi confirmada no Cloud Firestore (`true`) ou apenas salva localmente (`false`).
  - Quando a nuvem estiver desconectada, o toast informa claramente para clicar em **"Conectar Google e Sincronizar"** no topo do painel.
- **Fallback Automático no Login Google (`firebase.ts` e `AdminPanel.tsx`)**:
  - Se o navegador/tablet bloquear o popup do Google (`auth/popup-blocked`), `signInWithGoogle` usa automaticamente `signInWithRedirect`, além de exibir o código exato caso falte domínio autorizado (`auth/unauthorized-domain`).
  - Cache do Workbox PWA elevado para `estefany-nails-v57-sync-feedback-and-google-redirect`.


### v58 — Remoção do Banner de Login Google no Painel Admin
- **Interface Limpa sem Sincronização por E-mail/Google (`AdminPanel.tsx`, `AdminProfileSuite.tsx`, `AdminCatalogTab.tsx`)**:
  - Removido o banner `"Conectar Google e Sincronizar"` do topo do Painel Admin e os avisos pedindo conexão com conta Google ao salvar procedimentos e configurações, atendendo à solicitação de manter o painel direto e sem login de e-mail.
  - Mantida integralmente a proteção contra reversão de fotos/dados (`v55`) e o ajuste responsivo sem vazamento lateral (`v56`).
  - Cache do Workbox PWA elevado para `estefany-nails-v58-clean-no-google-prompt`.


### v59 — Migração Oficial para o Firebase `Studio de beleza` (`studio-de-beleza-8045a`)
- **Configuração Firebase Oficial (`firebase-applet-config.json`)**:
  - Conectado o aplicativo ao projeto Firebase da proprietária (`studio-de-beleza-8045a`, banco `(default)`), com provedor **E-mail/senha** ativado e domínio `estefany-paiva-nails.vercel.app` autorizado no Console do Firebase.
- **Autenticação & Sincronização Automática (`firebase.ts`, `db.ts`, `AdminPanel.tsx`)**:
  - Ao entrar no `/painel`, `ensureEmailUserSignedIn` autentica (ou cria automaticamente no primeiro acesso) a conta administrativa no `studio-de-beleza-8045a`.
  - Ao abrir o painel, `syncPendingLocalChangesToCloud()` envia automaticamente todas as fotos de capa, perfil e procedimentos já salvos localmente para o Firestore na nuvem, atualizando a tela das clientes em todos os aparelhos.
  - Cache do Workbox PWA elevado para `estefany-nails-v59-studio-de-beleza-firebase`.


### v60 — Correção do Erro `Cannot read properties of undefined (reading 'includes')` ao Ler Documentos Antigos do Firestore
- **Normalização Segura de Documentos (`db.ts`)**:
  - Criada a função `normalizeAppointmentDoc` para garantir que agendamentos antigos já existentes no banco `studio-de-beleza-8045a` sempre tenham `serviceIds`, `serviceNames`, `clientName`, `clientPhone` e demais campos inicializados como arrays/strings válidos.
  - Garantido em `subscribeSalonSettings` que `workDays`, `configuredSlots`, `blockedDates` e `closedMonths` sempre sejam arrays válidos.
- **Proteções Defensivas (`AdminPanel.tsx`, `AdminAgendaTab.tsx`, `CalendarPicker.tsx`, `utils.ts`)**:
  - Protegidas todas as chamadas `.includes(...)` em listas de serviços e dias úteis contra valores `undefined`.
  - Cache do Workbox PWA elevado para `estefany-nails-v60-fix-undefined-includes-crash`.


### v61 — Correção do Erro `Cannot read properties of undefined (reading 'join')`
- **Normalização no `localClientStore.ts` e `db.ts`**:
  - `loadLocalBookings()` e `normalizeAppointmentDoc()` garantem que `serviceIds`, `serviceNames` e `lastServices` sempre sejam arrays válidos (incluindo fallback para campo legado `serviceName` de documentos antigos no `studio-de-beleza-8045a`).
- **Proteções Defensivas em `.join()`**:
  - Adicionado `(array || []).join(...)` em `AdminPanel.tsx`, `AdminAgendaTab.tsx`, `AdminClientsTab.tsx` e `AdminFinanceSuite.tsx`.
  - Cache do Workbox PWA elevado para `estefany-nails-v61-fix-undefined-join-crash`.


### v62 — Revisão Geral de Produção (Verificação de Dados, Remoção de Textos de Protótipo, Agenda Compacta, Financeiro Limpo e Melhorias na Cliente)
- **Dados Reais e Fallbacks (`db.ts`, `AdminPanel.tsx`, `AdminAgendaTab.tsx`)**:
  - `subscribeSalonSettings` agora restaura automaticamente `heroTitle`, `heroSubtitle`, `bio`, `tagline` e `whatsapp` real (`5561985543452`) caso o documento do Firestore venha com campos vazios ou número de exemplo (`5511999999999`).
  - Adicionado botão **"Apagar testes (R$ 0,00)"** na Agenda para limpar registros de teste antigos em 1 clique.
  - E-mail na tela Segurança alinhado para `rs8802616@gmail.com`.
- **Painel Admin Limpo (`AdminPanel.tsx`, `AdminAgendaTab.tsx`, `AdminClientsTab.tsx`, `AdminFinanceSuite.tsx`, `AdminProfileSuite.tsx`)**:
  - Removidos todos os textos de protótipo (`TELA 3 •`, `2. Tela de Abertura (Splash)`, `33 Telas`, `Mapa das 33 Telas`, `Métricas 100% reais`, jargões de criptografia em Segurança) e removida a barra duplicada no topo.
  - **Agenda** redesenhada com linhas compactas, selo colorido de status e filtro padrão mostrando **Hoje e Próximos dias** (com botão `"Ver histórico"`).
  - **Clientes** com WhatsApp como botão principal, botão `"Ficha Técnica"` leve e selo de retorno legível; **Lembretes** no Início limitados aos 5 mais recentes (separando inativas > 60 dias).
  - **Financeiro** sem o botão `"Exemplo"` e ocultando gráficos vazios quando não há lançamentos.
  - **Galeria** sem fotos genéricas de banco de imagem (usando imagens do estúdio e exibindo **"Trabalhos Recentes"** também no site da cliente) e tela **Adicionar Foto** sem espaço vazio.
- **Portal da Cliente (`ClientPortal.tsx`)**:
  - Botão de combo alterado para **`+ Combo`** / **`No Combo`** com texto claro; rótulos de categoria com contraste alto; rodapé completo com links de **WhatsApp**, **Instagram** e **Endereço**; barra fixa inferior no celular mostrando o total e botão **`Continuar →`** quando há serviços selecionados.
  - Cache do Workbox PWA elevado para `estefany-nails-v62-full-audit-cleanup`.


### v63 — Correção do Título Espremido no Tablet/Celular (`AdminPanel.tsx`)
- Alterado o cabeçalho do **Início** para `flex-col xl:flex-row` (sem `shrink-0` no grupo de 3 botões), impedindo que os botões espremam `"Visão Geral do Estúdio"` em uma coluna estreita no celular e tablet.
- Cache do Workbox PWA elevado para `estefany-nails-v63-fix-heading-squeeze`.
