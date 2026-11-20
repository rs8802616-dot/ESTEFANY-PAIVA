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
