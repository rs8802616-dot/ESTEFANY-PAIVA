# ✨ Estefany Paiva Nails — Plataforma Multi-Portal, LGPD & Push PWA

Plataforma web progressiva (PWA) instalável, responsiva e expansiva desenvolvida para **Estefany Paiva Nails**, implementada em estrita conformidade com o **PRD & Prompt Mestre: Plataforma de Agendamento para Manicure (Multi-Portal, LGPD & Push PWA)**.

---

## 🏛️ Arquitetura de 3 Ambientes Isolados por Links e Tokens SHA-256

| Ambiente | Usuário Alvo | Link de Acesso | Mecanismo de Proteção e Governança |
| :--- | :--- | :--- | :--- |
| **Portal do Cliente** | Cliente final | `https://seudominio.com/` ou `index.html` | **100% Público, Rápido e Sem Login.** Coleta exclusivamente Nome e Celular/WhatsApp no fechamento do horário (LGPD estrita). |
| **Painel da Administradora** | Manicure / Nail Designer | `https://seudominio.com/admin.html?token=<TOKEN_ADMIN>` | Protegido por **Token Único da Administradora** validado via hash SHA-256. Gestão de agendamentos por categoria, relatórios e White-Label. |
| **Portal Mestre (Owner)** | Dono da Plataforma | `https://seudominio.com/master.html?token=<TOKEN_MASTER>` | Rota exclusiva do proprietário protegida por **Token Mestre**. Monitoramento de horários de pico, funil, rotação de tokens e auditoria. |

---

## 🔑 Tokens Padrão de Inicialização (Fábrica)

> [!IMPORTANT]
> Os tokens abaixo são gerados inicialmente para uso imediato em ambiente de desenvolvimento e testes. No **Portal Mestre**, você pode rotacionar ambos os tokens com um clique a qualquer momento:
> - **Token da Administradora:** `adm_sec_4c781d9e5b20`
> - **Token Mestre (Owner):** `mst_sec_8f93e2b10a47`

---

## 🚀 Funcionalidades Principais Implementadas

### 1. Portal do Cliente (`index.html`)
- **Portfólio Vivo Superior (Carrossel):** cards horizontais com rolagem suave automática e suporte a toque/arraste para exibir fotos de alta qualidade dos trabalhos recentes com atalho direto para agendar aquele estilo.
- **Catálogo de Serviços por Categorias:** abas de filtro rápido (*Alongamento em Gel*, *Esmaltação em Gel*, *Manicure & Pedicure Clássica*, *Nail Art & Encapsuladas*, *Spa & Blindagem*).
- **Player de Stories estilo Instagram:** ao clicar na foto da unha em qualquer card de serviço, abre modal em tela cheia com até **3 vídeos sequenciais**, 3 barras superiores animadas, toque na lateral esquerda/direita para navegar, pausar ao segurar o dedo e botão fixo *"Agendar esta unha agora"*.
- **Fluxo de Agendamento Enxuto (LGPD by Design):** solicita estritamente **Nome** e **WhatsApp** com máscara `(DD) 9XXXX-XXXX`. Previne bloqueio de horários duplicados e gera link do **Google Calendar** + download de arquivo `.ics`.
- **Área Meus Agendamentos:** consulta rápida por WhatsApp dos agendamentos futuros e histórico.

### 2. Painel da Administradora (`admin.html?token=adm_sec_4c781d9e5b20`)
- **Validação Criptográfica SHA-256:** acesso bloqueado sem o token válido na URL ou digitado no modal de autenticação.
- **Visão e Filtro por Categoria:** visualização dos agendamentos segmentada por categorias e status (*Pendente*, *Confirmado*, *Concluído*, *Cancelado*).
- **Alerta Sonoro com Web Audio API:** botão para testar a sineta sonora de alta frequência disparada automaticamente a cada novo agendamento, além de vibração PWA no celular.
- **Relatórios Gerenciais:** comparativo de faturamento previsto vs confirmado, ticket médio geral e gráficos de barras por categoria de procedimento.
- **Personalizador Total da Identidade Visual (White-Label):**
  - Seletor de cores primárias (Creme, Nude, Rosé, Rosa Choque).
  - Tipografia de títulos (Playfair Display, Cinzel, Montserrat, Plus Jakarta Sans).
  - Modo Claro vs Noturno de Luxo.
  - Edição do nome da marca e slogan.
  - Gestor do Portfólio Vivo (adicionar/remover fotos do carrossel).
  - Editor dos 3 vídeos de Stories para cada serviço cadastrado.
- **Ações Rápidas nos Agendamentos:** confirmação com 1 clique, conclusão, cancelamento e abertura direta de conversa no WhatsApp com mensagem personalizada preenchida.

### 3. Portal Mestre / Owner (`master.html?token=mst_sec_8f93e2b10a47`)
- **Monitoramento de Horários de Pico:** gráfico com a distribuição dos acessos nas 24 horas do dia (0h às 23h) com indicação do horário nobre (18h às 21h).
- **Funil de Conversão em Tempo Real:** métricas de Acessos ao Link → Visualizações de Stories → Aberturas de Calendário → Agendamentos Finalizados.
- **Gerenciador e Rotacionador de Tokens Criptográficos:** geração segura via CSPRNG de novos tokens administrativos ou mestre, com revogação imediata das credenciais antigas e links prontos para copiar.
- **Auditoria de Segurança:** tabela cronológica de acessos às rotas protegidas (Data/Hora, Rota, Dispositivo/OS, Hash anônimo de sessão e status `AUTORIZADO` ou `BLOQUEADO`).
- **Governança LGPD:** botão para expurgo automático de agendamentos e registros de contato com mais de 30 dias.

---

## 🔒 Política de Zero Dados Sensíveis no Repositório (Zero-Leak Git)

O projeto cumpre rigorosamente as normas de segurança para versionamento:
- Arquivo `.gitignore` pré-configurado bloqueando `.env*`, `*.db`, `*.sqlite`, uploads privados e logs.
- Arquivo `.env.example` sem nenhuma credencial sensível real.
- Assegurada a não inclusão de segredos ou tokens fixos no controle de versão.

---

## 💻 Como Executar Localmente

Você pode servir a aplicação através de qualquer servidor HTTP estático:

```bash
# Com Python 3
python -m http.server 8080

# Com Node.js (npx)
npx serve .
```

Acesse no navegador:
- **Cliente:** `http://localhost:8080/index.html`
- **Administradora:** `http://localhost:8080/admin.html?token=adm_sec_4c781d9e5b20`
- **Portal Mestre:** `http://localhost:8080/master.html?token=mst_sec_8f93e2b10a47`
