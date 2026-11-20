# PRD — Estefany Paiva Nails (v36)
**Documento de Requisitos do Produto (Product Requirements Document)**  
**Versão:** 3.6 (Arquitetura Modular Nativa Mobile & Tablet + Firebase Ready)  
**Última Atualização:** 19/11/2026  
**Repositório:** `https://github.com/rs8802616-dot/ESTEFANY-PAIVA.git`  
**Hospedagem / Distribuição:** Vercel + PWA Instalável (iOS, Android, Tablet e Desktop)

---

## 1. Visão Geral do Produto
O **Estefany Paiva Nails** é um aplicativo web progressivo (**PWA**) de agendamento online e gestão completa para estúdio de nail design de alto padrão.

### 1.1 Problema Resolvido
- **Para a cliente:** elimina a demora em trocar dezenas de mensagens no WhatsApp apenas para consultar preços, duração e horários livres.
- **Para a profissional (administradora):** centraliza agenda, financeiro, catálogo de serviços, histórico de clientes, ficha técnica de unhas e lembretes em um único aplicativo rápido no celular ou tablet, evitando conflitos de horário e reduzindo faltas (*no-show*).

---

## 2. Perfis de Usuário (Personas)

| Perfil | Portal | Objetivo Principal |
| :--- | :--- | :--- |
| **Cliente Final** | `index.html` | Ver procedimentos, preços e durações; montar combo; agendar ou remarcar em segundos; copiar Pix e salvar na agenda do celular. |
| **Administradora (Nail Designer)** | `admin.html` | Controlar agenda do dia, bloquear folgas, cadastrar/editar serviços, consultar ficha técnica das clientes, chamar clientes para manutenção (21+ dias) e acompanhar faturamento real. |

---

## 3. Arquitetura Técnica & Organização de Arquivos

O sistema utiliza **HTML5 Semântico + CSS3 Design System (0 `!important`) + JavaScript ES Modules nativo**, sem etapas complexas de build, garantindo carregamento instantâneo em conexões móveis.

| Arquivo | Responsabilidade |
| :--- | :--- |
| `index.html` | Estrutura do Portal da Cliente (mobile-first, banner full-bleed, modais Bottom Sheet e barra inferior flutuante). |
| `admin.html` | Estrutura do Painel Administrativo (Login Gate seguro, Sidebar fixa estilo iPadOS em tablets `>= 768px` e barra flutuante no celular). |
| `assets/css/design-system.css` | Design System unificado (paleta Vinho `#350B19` / Rosé `#D83F79` / Cream `#F7F1F3`), zero `!important`, `safe-area-inset`, animações de Bottom Sheet e alvos de toque `>= 44px`. |
| `src/config.js` | Credenciais do **Firebase (`FIREBASE_CONFIG`)** e valores padrão iniciais do estúdio, categorias e serviços. |
| `src/utils.js` | Funções puras: formatação `R$`, datas ISO/BR, máscara de telefone, proteção contra XSS (`escapeHTML`), compressão de imagem, SHA-256, geração de links WhatsApp, Google Agenda e arquivo `.ics`. |
| `src/db.js` | Camada de Dados Unificada com adaptador duplo: **Firebase Modular Web SDK v11 (Cloud Firestore + Firebase Auth)** quando configurado, com **Fallback Local Seguro** (`localStorage`) automático enquanto sem chaves. |
| `src/client-app.js` | Lógica de estado, catálogo, combo, calendário, slots com bloqueio por duração, confirmação com Pix e remarcação da cliente. |
| `src/admin-app.js` | Lógica de autenticação, Dashboard 100% real, Agenda, mensagens prontas de WhatsApp, Clientes + Ficha Técnica + Retorno 21+ dias, Serviços, Relatórios (CSV/PDF) e Ajustes. |
| `manifest.json` e `sw.js` | Configuração PWA instalável (`display: standalone`, `theme_color: #350B19`, `orientation: any`) e cache inteligente (`estefany-nails-v36-native-mobile-tablet-app`). |

---

## 4. Funcionalidades Detalhadas & Fluxos

### 4.1 Portal da Cliente (`index.html`)

1. **Cabeçalho & Identidade do Estúdio**
   - Exibe logo/monograma, foto de perfil da profissional (hidratada sincronicamente para não piscar imagem antiga), nome do estúdio, bio e atalhos para **Meus Horários** e **WhatsApp**.
2. **Faixa de Próximo Agendamento**
   - Se a cliente já tiver um agendamento futuro vinculado ao seu WhatsApp salvo, exibe um card rápido no topo com serviço, data/hora e botão **Ver / Remarcar**.
3. **Banner Destaque & Catálogo de Procedimentos**
   - Banner *full-bleed* com imagem e botão **Agendar Agora**.
   - Pílulas de filtro por categoria com rolagem horizontal suave (*swipe*).
   - Cards horizontais compactos no celular (foto + duração + título + descrição + preço + botão **Agendar**) que viram grade de 2 a 3 colunas no tablet/desktop.
4. **Fluxo de Agendamento em Tela Cheia (`#modalBooking`)**
   - **Combo (Múltiplos Serviços):** a cliente pode tocar em **+ Combo** e marcar procedimentos adicionais para o mesmo horário; o app soma automaticamente **preço total** e **duração total (min)**.
   - **Calendário 7 Colunas:** destaca dias disponíveis e bloqueia automaticamente datas passadas, dias fora da escala (`workingDays`) e folgas (`blockedDates`).
   - **Seleção de Horários com Bloqueio Inteligente:** mostra apenas horários livres levando em conta a **duração real** do procedimento/combo e os bloqueios pessoais da profissional.
   - **Identificação Enxuta (LGPD):** pede apenas **Nome Completo** e **WhatsApp com DDD**.
5. **Confirmação + Sinal via Pix (`#modalSuccess`)**
   - Exibe resumo completo do agendamento.
   - Se houver Chave Pix configurada, exibe caixa **Pix Copia e Cola** com cálculo automático do sinal (`depositPercent`) ou valor total, botão **Copiar** e botão **Confirmar / Enviar Comprovante no WhatsApp**.
   - Botões **Salvar no Google Agenda** e **Baixar `.ics`** para o calendário nativo do celular.
6. **Meus Horários & Remarcação Online (`#modalMyBookings`)**
   - Busca por WhatsApp listando agendamentos da cliente.
   - Botão **Remarcar** em horários futuros ativos, validando a regra de antecedência mínima (`rescheduleMinHours`, padrão 12h). Ao concluir a remarcação, o horário antigo é liberado automaticamente.

---

### 4.2 Painel Administrativo (`admin.html`)

1. **Acesso Seguro (Login Gate)**
   - **Modo Firebase:** autenticação real via e-mail e senha (`signInWithEmailAndPassword` do Firebase Auth).
   - **Modo Local:** no primeiro acesso, a administradora cria sua senha privada, armazenada apenas como hash `SHA-256` com salt (nenhuma senha existe em texto puro no código).
2. **Aba Início (Dashboard — 100% Dados Reais)**
   - 4 KPIs reais com ícones: **Agendamentos Ativos**, **Clientes Únicas**, **Faturamento do Mês** e **Ticket Médio**.
   - Barra de **Meta Mensal** calculada sobre o faturamento real do mês corrente.
   - Lista de **Próximos Atendimentos** com atalho para **+ Novo Horário**.
3. **Aba Agenda**
   - Filtro por data ou listagem completa ordenada.
   - Botão **Bloquear Horário** para registrar compromissos pessoais/folgas (que imediatamente somem dos horários livres da cliente).
   - Botão **Agendar** para lançamento manual de cliente.
   - **Modal de Detalhes do Atendimento:**
     - Alterar status: **Confirmar**, **Concluir** ou **Cancelar Horário**.
     - Enviar para **Google Agenda**.
     - **3 Mensagens Prontas de 1 Clique no WhatsApp:**
       - `🔔 Lembrete` (confirma data, hora e procedimento);
       - `💸 Enviar Pix` (envia chave Pix e valor do sinal/serviço);
       - `⭐ Pós-Atendimento` (agradece a visita e pede feedback).
4. **Aba Clientes & Retornos**
   - Lista automática consolidada pelo WhatsApp com contagem de atendimentos, valor total investido e última visita.
   - **Alerta de Retorno (21+ dias):** clientes cujo último atendimento foi há 21 dias ou mais recebem a etiqueta `⏰ Retorno (Xd)` e botão de 1 clique no WhatsApp convidando para manutenção.
   - **Ficha Técnica da Cliente:** ao tocar em uma cliente, abre seu histórico + formulário de **Formato Preferido**, **Cor / Gel Favorito**, **Alergias / Sensibilidades** e **Observações Técnicas**.
5. **Aba Serviços & Categorias**
   - Cadastro e edição de procedimentos (Nome, Preço, Duração em minutos, Categoria, Descrição e Foto comprimida automaticamente).
   - Gerenciador livre de categorias do catálogo.
6. **Aba Relatórios Financeiros**
   - Filtros de período: **7 dias**, **30 dias**, **6 meses** e **Todo o período**.
   - Totais reais: Faturamento, Atendimentos, Ticket Médio, Cancelados e ranking por procedimento.
   - Exportação em **Planilha CSV** e impressão/salvamento em **PDF**.
7. **Aba Ajustes**
   - Edição de Nome do Estúdio, Nome da Profissional, WhatsApp, Chave Pix, Bio, Percentual de Sinal (%), Antecedência Mínima para Remarcação (h), Meta Mensal (R$), Grade de Horários, Foto de Perfil e Foto do Banner.

---

## 5. Modelo de Dados (Firestore / LocalStorage)

| Coleção / Chave | Documento / Campos Principais |
| :--- | :--- |
| `salon_settings` (`main`) | `salonName`, `salonSubtitle`, `ownerName`, `phone`, `bio`, `avatarImage`, `promoBannerTitle`, `promoBannerSubtitle`, `promoBannerImage`, `pixKey`, `depositPercent`, `rescheduleMinHours`, `monthlyGoal`, `configuredSlots[]`, `workingDays[]`, `blockedDates[]` |
| `categories` (`{id}`) | `id`, `name` |
| `services` (`{id}`) | `id`, `name`, `categoryId`, `price`, `duration`, `description`, `image`, `active` |
| `appointments` (`{id}`) | `id`, `clientName`, `clientPhone`, `serviceId`, `serviceName`, `servicePrice`, `duration`, `date` (`YYYY-MM-DD`), `time` (`HH:MM`), `status` (`Confirmado` / `Concluído` / `Cancelado`), `createdAt`, `updatedAt` |
| `personal_blocks` (`{id}`) | `id`, `title`, `date`, `startTime`, `endTime`, `allDay` |
| `client_tech_notes` (`{phoneKey}`) | `phoneKey`, `nailShape`, `favoriteColor`, `allergies`, `notes`, `updatedAt` |

---

## 6. Regras de Negócio Críticas
1. **Bloqueio por Sobreposição de Duração:** um horário candidato `[sStart, sStart + duraçãoSolicitada)` só é exibido como livre se não sobrepuser nenhum agendamento ativo `[aStart, aStart + duraçãoAgendada)` nem nenhum bloqueio pessoal `[bStart, bEnd)` naquela data.
2. **Regra de Remarcação:** a cliente só pode remarcar online se `horasRestantes >= rescheduleMinHours` (padrão 12h) e o status não for `Cancelado` nem `Concluído`.
3. **Sinal via Pix:** se `depositPercent > 0`, o valor exibido no Pix é `servicePrice * (depositPercent / 100)`; se `0`, exibe o valor integral do atendimento.
4. **Alerta de Manutenção:** disparado automaticamente na aba Clientes quando `(hoje - ultimaVisita) >= 21 dias`.
5. **Segurança & Privacidade:** todo texto dinâmico renderizado em HTML passa por `escapeHTML()` contra XSS; senhas não existem em texto puro no código-fonte; a Ficha Técnica é de acesso exclusivo da administradora.

---

## 7. Experiência Visual (Mobile & Tablet)
- **Celular (`< 768px`):**
  - Barra inferior flutuante glassmórfica com respeito à `safe-area-inset-bottom`.
  - Modais estilo *Bottom Sheet* com alça superior (*drag handle*).
  - Cards de serviço horizontais compactos e botões com altura mínima de `44px`.
- **Tablet (`>= 768px`) & Desktop:**
  - Painel Admin com barra lateral fixa (`236px`) estilo iPadOS.
  - Catálogo da cliente em grade de 2 a 3 colunas e modais centralizados.

---

## 8. Ativação do Banco de Dados no Firebase & Roadmap
### Ativação Imediata (Firebase Console)
1. Colar `FIREBASE_CONFIG` em `src/config.js`.
2. Criar usuário administrador (e-mail e senha) em **Firebase Authentication**.
3. Publicar as regras de segurança (`firestore.rules`) no **Cloud Firestore**.

### Próximos Passos Sugeridos (Roadmap v37+)
- **Firebase Storage** para hospedar fotos de procedimentos e perfil em URLs CDN leves (em vez de Base64 nos documentos).
- **Cloud Functions + WhatsApp API** para envio automático de lembrete 24h antes do atendimento sem depender de clique manual.
- **Avaliações reais pós-atendimento** com link único enviado à cliente após o status mudar para `Concluído`.
