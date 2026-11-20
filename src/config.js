/**
 * Configuração central — Estefany Paiva Nails
 *
 * Para conectar ao seu banco de dados no Console do Firebase:
 * 1. Abra o Firebase Console -> Configurações do Projeto -> Seus aplicativos (Web)
 * 2. Copie os dados de `firebaseConfig` e cole abaixo
 * 3. Publique as regras do arquivo `firestore.rules` no Firestore Database -> Regras
 * 4. Em Authentication -> Users, crie o e-mail e senha da Administradora
 */
export const APP_CONFIG = {
  FIREBASE_CONFIG: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },

  DEFAULT_SALON: {
    salonName: 'Estefany Paiva',
    salonSubtitle: 'NAIL DESIGNER',
    ownerName: 'Estefany Paiva',
    phone: '(61) 98554-3452',
    bio: 'Especialista em alongamento em gel, banho de gel e nail art de luxo.',
    avatarImage: 'assets/images/trabalho-amendoada-ouro.png',
    promoBannerTitle: 'Realce a beleza das suas mãos',
    promoBannerSubtitle: 'Horários exclusivos com atendimento personalizado',
    promoBannerImage: 'assets/images/trabalho-alongamento-chocolate.png',
    pixKey: '(61) 98554-3452',
    depositPercent: 0,
    rescheduleMinHours: 12,
    cancellationPolicy: 'Avisar com pelo menos 12h de antecedência.',
    monthlyGoal: 5000,
    configuredSlots: ['09:00', '10:30', '13:00', '14:30', '16:00', '17:30', '19:00'],
    workingDays: [1, 2, 3, 4, 5, 6],
    blockedDates: []
  },

  DEFAULT_CATEGORIES: [
    { id: 'cat_alongamento', name: 'Alongamento' },
    { id: 'cat_manutencao', name: 'Manutenção' },
    { id: 'cat_blindagem', name: 'Banho & Blindagem' },
    { id: 'cat_nailart', name: 'Nail Art' }
  ],

  DEFAULT_SERVICES: [
    {
      id: 'srv_alongamento_gel',
      name: 'Alongamento em Gel',
      categoryId: 'cat_alongamento',
      price: 180,
      duration: 120,
      description: 'Alongamento resistente com curvatura natural e acabamento de alto brilho.',
      image: 'assets/images/trabalho-alongamento-chocolate.png',
      active: true
    },
    {
      id: 'srv_manutencao_gel',
      name: 'Manutenção em Gel',
      categoryId: 'cat_manutencao',
      price: 120,
      duration: 90,
      description: 'Renovação completa da estrutura, nivelamento e esmaltação impecável.',
      image: 'assets/images/trabalho-amendoada-ouro.png',
      active: true
    },
    {
      id: 'srv_banho_gel',
      name: 'Banho de Gel',
      categoryId: 'cat_blindagem',
      price: 110,
      duration: 75,
      description: 'Fortalecimento da unha natural com camada protetora de gel cristalino.',
      image: 'assets/images/trabalho-perolada-glaze.png',
      active: true
    },
    {
      id: 'srv_francesa_luxo',
      name: 'Francesa Encapsulada',
      categoryId: 'cat_nailart',
      price: 195,
      duration: 120,
      description: 'Arte encapsulada com brilho delicado e durabilidade prolongada.',
      image: 'assets/images/trabalho-francesa-estrela.png',
      active: true
    }
  ]
};
