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
