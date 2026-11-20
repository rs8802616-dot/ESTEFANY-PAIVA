# DOCUMENTAÇÃO OFICIAL DO PROJETO: ESTEFANY PAIVA NAILS
**Data da Última Atualização:** 19/11/2026  
**Versão Atual:** **v34 (Reconstrução Arquitetural Profissional)**  
**Repositório:** `https://github.com/rs8802616-dot/ESTEFANY-PAIVA.git`  
**Branch:** `main`

---

## 1. Nova Arquitetura Modular (v34)
O projeto foi reconstruído do zero com arquitetura modular limpa em **ES Modules nativos** (sem frameworks pesados, deploy imediato na Vercel), eliminando os 579 `!important`, os 777 estilos inline, as senhas em texto puro, o canal público `ntfy.sh` e os dados fictícios chumbados no HTML.

### Estrutura de Arquivos
- **`index.html`** (269 linhas, 0 `style=""` inline): Portal da Cliente semântico e instantâneo.
- **`admin.html`** (437 linhas, 0 `style=""` inline): Painel Administrativo limpo com Login Gate seguro.
- **`assets/css/design-system.css`**: Design System único (Vinho/Marsala `#350B19`, Rosé `#D83F79`, Cream `#FAF4F5`), mobile-first e **zero `!important`**.
- **`src/config.js`**: Configurações padrão do estúdio e credenciais opcionais do **Supabase** (`SUPABASE_URL` e `SUPABASE_ANON_KEY`).
- **`src/utils.js`**: Utilitários puros (formatação BRL, datas, máscaras, escape XSS, compressão de imagem, SHA-256, WhatsApp, Google Agenda, `.ics` e Toast).
- **`src/db.js`**: Camada de Dados Unificada com adaptador duplo:
  - **Modo Nuvem (Supabase)**: Ativado automaticamente ao preencher `src/config.js`, utilizando PostgreSQL real, Row Level Security (RLS) e Supabase Auth.
  - **Modo Local Seguro**: Funciona imediatamente sem backend externo, sem vazar dados em canais públicos e com criação de senha privada (hash SHA-256) no primeiro acesso do Admin.
- **`src/client-app.js`**: Controlador do Portal da Cliente (catálogo, filtros, Combo de serviços, calendário 7 colunas, bloqueio inteligente por duração, Pix Copia e Cola e remarcação online).
- **`src/admin-app.js`**: Controlador do Painel Administrativo (100% dados reais, Dashboard, Agenda com mensagens prontas de 1 clique, Clientes com alerta de retorno 21+ dias e Ficha Técnica, Serviços/Categorias, Relatórios com CSV/PDF e Ajustes).
- **`supabase-schema.sql`**: Script SQL pronto para criar todas as tabelas, índices únicos de horário e políticas RLS no Supabase.
- **`sw.js`**: Service Worker atualizado (`estefany-nails-v34-professional-rebuild`).

---

## 2. Como Ativar o Banco de Dados Real na Nuvem (Supabase — Gratuito)
1. Crie uma conta gratuita em `https://supabase.com` e crie um novo projeto.
2. No menu **SQL Editor**, cole e execute o conteúdo de `supabase-schema.sql`.
3. Em **Authentication → Users**, crie seu usuário administrador (e-mail e senha).
4. Em **Settings → API**, copie a **Project URL** e a **anon public key** e cole em `src/config.js`.
5. Faça push para a branch `main` — o site passa a operar 100% em PostgreSQL real na nuvem.

---

## 3. Histórico de Versões Recentes
- **v31**: Remoção completa da funcionalidade de Stories.
- **v32**: Remoção do iframe embutido no admin e limpeza inicial de código morto.
- **v33**: Combo de serviços, bloqueio por duração, Pix Copia e Cola, remarcação online, mensagens prontas de 1 clique, Ficha Técnica e alerta de retorno (21+ dias).
- **v34**: **Reconstrução Arquitetural Profissional do Zero**:
  1. Redução de `index.html` de 1.661 para 269 linhas (0 inline styles) e `admin.html` de 3.583 para 437 linhas (0 inline styles).
  2. Novo `assets/css/design-system.css` com **zero `!important`** (eliminando os 579 `!important` antigos).
  3. Remoção definitiva de senhas em texto puro e do canal público `ntfy.sh` que expunha dados das clientes.
  4. Criação da camada de dados `src/db.js` pronta para **Supabase (PostgreSQL + Auth + RLS)** via `supabase-schema.sql`, com fallback local seguro.
  5. Eliminação total de números e avaliações falsas no painel administrativo (100% métricas reais).
  6. Cache do Service Worker atualizado para `estefany-nails-v34-professional-rebuild`.
