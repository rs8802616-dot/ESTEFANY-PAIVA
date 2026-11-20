/**
 * =====================================================================
 * DESIGN SYSTEM OFICIAL — LUXURY NUDE (WEB + REACT NATIVE / EXPO READY)
 * Tokens tipados em TypeScript compatíveis com Tailwind CSS e StyleSheet.create()
 * =====================================================================
 */

export const LUXURY_NUDE_PALETTE = {
  nude: '#E8D6CB',
  rose: '#BE9293',
  dourado: '#C4A477',
  creme: '#FAF6F1',
  branco: '#FFFFFF',
  marrom: '#594943',
  textoSecundario: '#95847C',
  fundoSuave: '#F2EAE4',
} as const;

export const LUXURY_TYPOGRAPHY = {
  headingFont: 'Playfair Display',
  bodyFont: 'Inter',
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 34,
  },
} as const;

export type MainBottomTabId = 'inicio' | 'agenda' | 'clientes' | 'financeiro' | 'perfil';

export interface MandatoryScreenSpec {
  number: number;
  id: string;
  title: string;
  tab: MainBottomTabId | 'publico' | 'acesso';
  description: string;
}

/**
 * Mapa oficial das 33 Telas Obrigatórias do Aplicativo Luxury Nude
 */
export const MANDATORY_SCREENS_33: MandatoryScreenSpec[] = [
  { number: 1, id: 'login', title: '1. Login', tab: 'acesso', description: 'Autenticação criptografada com e-mail e senha.' },
  { number: 2, id: 'abertura', title: '2. Abertura', tab: 'inicio', description: 'Tela de boas-vindas Luxury Nude e resumo rápido do atelier.' },
  { number: 3, id: 'dashboard', title: '3. Dashboard', tab: 'inicio', description: 'Visão executiva do dia, indicadores e próximos atendimentos.' },
  { number: 4, id: 'calendario', title: '4. Calendário', tab: 'agenda', description: 'Grade mensal e diária de agendamentos e bloqueios.' },
  { number: 5, id: 'novo_agendamento', title: '5. Novo agendamento', tab: 'agenda', description: 'Cadastro rápido de atendimento ou encaixe.' },
  { number: 6, id: 'detalhes_agendamento', title: '6. Detalhes do agendamento', tab: 'agenda', description: 'Ficha completa do horário, status, Pix e WhatsApp.' },
  { number: 7, id: 'pagina_publica', title: '7. Página pública', tab: 'publico', description: 'Vitrine online Luxury Nude do atelier para clientes.' },
  { number: 8, id: 'escolha_servicos', title: '8. Escolha de serviços', tab: 'publico', description: 'Seleção de procedimentos individuais ou combo.' },
  { number: 9, id: 'escolha_data_horario', title: '9. Escolha de data e horário', tab: 'publico', description: 'Calendário inteligente com bloqueio por duração.' },
  { number: 10, id: 'dados_cliente', title: '10. Dados da cliente', tab: 'publico', description: 'Identificação rápida com nome, WhatsApp e pagamento.' },
  { number: 11, id: 'confirmacao', title: '11. Confirmação', tab: 'publico', description: 'Comprovante com Pix Copia e Cola e Google Agenda.' },
  { number: 12, id: 'lista_clientes', title: '12. Lista de clientes', tab: 'clientes', description: 'Base de clientes com busca e alerta de retorno 21+ dias.' },
  { number: 13, id: 'cadastro_clientes', title: '13. Cadastro de clientes', tab: 'clientes', description: 'Inclusão de nova cliente e preferências iniciais.' },
  { number: 14, id: 'perfil_cliente', title: '14. Perfil da cliente', tab: 'clientes', description: 'Histórico de visitas, total investido e ficha técnica.' },
  { number: 15, id: 'catalogo_servicos', title: '15. Catálogo de serviços', tab: 'clientes', description: 'Procedimentos ativos, preços, durações e categorias.' },
  { number: 16, id: 'cadastro_servicos', title: '16. Cadastro de serviços', tab: 'clientes', description: 'Criação e edição de procedimento com fotografia.' },
  { number: 17, id: 'resumo_financeiro', title: '17. Resumo financeiro', tab: 'financeiro', description: 'Visão geral de receitas, despesas, saldo e meta.' },
  { number: 18, id: 'receitas', title: '18. Receitas', tab: 'financeiro', description: 'Entradas de atendimentos e lançamentos extras.' },
  { number: 19, id: 'despesas', title: '19. Despesas', tab: 'financeiro', description: 'Controle de insumos, géis, descartáveis e custos fixos.' },
  { number: 20, id: 'fluxo_caixa', title: '20. Fluxo de caixa', tab: 'financeiro', description: 'Gráfico comparativo de entradas, saídas e evolução.' },
  { number: 21, id: 'contas_pagar_receber', title: '21. Contas a pagar e receber', tab: 'financeiro', description: 'Gestão de pendências, sinais Pix e fornecedores.' },
  { number: 22, id: 'fechamento_mensal', title: '22. Fechamento mensal', tab: 'financeiro', description: 'Balanço consolidado do mês, margem e exportação.' },
  { number: 23, id: 'relatorios_gerais', title: '23. Relatórios gerais', tab: 'financeiro', description: 'Análise financeira por período e forma de pagamento.' },
  { number: 24, id: 'relatorios_desempenho', title: '24. Relatórios de desempenho', tab: 'financeiro', description: 'Ranking de serviços, ticket médio e taxa de retorno.' },
  { number: 25, id: 'galeria', title: '25. Galeria', tab: 'perfil', description: 'Portfólio fotográfico Luxury Nude dos trabalhos.' },
  { number: 26, id: 'adicionar_fotografia', title: '26. Adicionar fotografia', tab: 'perfil', description: 'Publicação de nova foto no portfólio com técnica.' },
  { number: 27, id: 'central_comunicacao', title: '27. Central de comunicação', tab: 'perfil', description: 'Mensagens prontas de confirmação, lembrete, Pix e pós-venda.' },
  { number: 28, id: 'perfil', title: '28. Perfil', tab: 'perfil', description: 'Dados da profissional, bio, foto e assinatura do atelier.' },
  { number: 29, id: 'horarios_funcionamento', title: '29. Horários de funcionamento', tab: 'perfil', description: 'Dias úteis, abertura, fechamento e grade de horários.' },
  { number: 30, id: 'config_agendamento', title: '30. Configurações de agendamento', tab: 'perfil', description: 'Sinal Pix %, antecedência de remarcação e folgas.' },
  { number: 31, id: 'personalizacao_publica', title: '31. Personalização da página pública', tab: 'perfil', description: 'Capa, título hero, endereço e redes sociais.' },
  { number: 32, id: 'seguranca', title: '32. Segurança', tab: 'perfil', description: 'Token criptográfico SHA-256, sessão e recuperação de senha.' },
  { number: 33, id: 'ajuda_suporte', title: '33. Ajuda e suporte', tab: 'perfil', description: 'Guia das 33 telas, diagnóstico PWA e arquitetura React Native/Expo.' },
];
