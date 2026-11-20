import type { Category, SalonSettings, Service } from '../types/salon';

export const STUDIO_IMAGES = {
  hero: '/src/assets/images/hero_nail_studio_1795135079713.jpg',
  ownerPortrait: '/src/assets/images/owner_estefany_portrait_1795137131182.jpg',
  alongamento: '/src/assets/images/svc_alongamento_gel_1795135078431.jpg',
  banho: '/src/assets/images/svc_banho_gel_1795135077776.jpg',
  esmaltacao: '/src/assets/images/svc_esmaltacao_gel_1795135078065.jpg',
  spa: '/src/assets/images/svc_spa_pes_1795135078852.jpg',
} as const;

export const STUDIO_IMAGE_PRESETS = [
  { label: 'Alongamento em Gel / Fibra', url: STUDIO_IMAGES.alongamento },
  { label: 'Banho de Gel / Blindagem', url: STUDIO_IMAGES.banho },
  { label: 'Esmaltação em Gel Marsala', url: STUDIO_IMAGES.esmaltacao },
  { label: 'Spa dos Pés e Pedicure', url: STUDIO_IMAGES.spa },
  { label: 'Atelier Estefany Paiva', url: STUDIO_IMAGES.hero },
];

export const DEFAULT_CONFIGURED_SLOTS: string[] = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
];

export const DEFAULT_SETTINGS: SalonSettings = {
  studioName: 'Estefany Paiva Nails',
  tagline: 'Nail Designer • Fibra de Vidro e Cuidado Natural',
  ownerName: 'Estefany Paiva',
  bio: 'Trabalho com fibra de vidro, banho de gel e acabamento fininho, sem agredir a sua unha natural.',
  avatarImage: STUDIO_IMAGES.ownerPortrait,
  heroTitle: 'Unhas bem feitas, leves e do jeito que você gosta.',
  heroSubtitle:
    'Escolha os serviços, veja os horários livres na hora e pague no Pix. Simples, sem esperar resposta no WhatsApp.',
  heroImageUrl: STUDIO_IMAGES.hero,
  whatsapp: '5561985543452',
  instagram: '@estefanypaivanails',
  address: 'Atendimento com hora marcada',
  pixKey: '(61) 98554-3452',
  pixName: 'ESTEFANY PAIVA NAILS',
  pixCity: 'BRASILIA',
  depositPercent: 30,
  rescheduleMinHours: 12,
  monthlyGoal: 8000,
  openTime: '09:00',
  closeTime: '19:00',
  slotIntervalMinutes: 30,
  configuredSlots: DEFAULT_CONFIGURED_SLOTS,
  workDays: [1, 2, 3, 4, 5, 6],
  blockedDates: [],
  closedMonths: [],
  returnAlertDays: 21,
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_alongamentos', name: 'Alongamentos', order: 1, active: true },
  { id: 'cat_blindagem', name: 'Banho de Gel', order: 2, active: true },
  { id: 'cat_esmaltacao', name: 'Esmaltação', order: 3, active: true },
  { id: 'cat_spa', name: 'Spa e Pés', order: 4, active: true },
];

export const DEFAULT_SERVICES: Service[] = [
  {
    id: 'svc_fibra_vidro',
    name: 'Alongamento em Fibra de Vidro',
    categoryId: 'cat_alongamentos',
    description:
      'Alongamento fininho e resistente com curvatura natural. Você escolhe entre gel leitoso ou baby boomer, já com cutilagem.',
    price: 195,
    durationMinutes: 150,
    imageUrl: STUDIO_IMAGES.alongamento,
    featured: true,
    active: true,
    order: 1,
  },
  {
    id: 'svc_manutencao_fibra',
    name: 'Manutenção de Alongamento',
    categoryId: 'cat_alongamentos',
    description:
      'Manutenção completa indicada entre 18 e 25 dias. A gente acerta o crescimento, alinha a ponta e renova o brilho.',
    price: 135,
    durationMinutes: 120,
    imageUrl: STUDIO_IMAGES.alongamento,
    featured: true,
    active: true,
    order: 2,
  },
  {
    id: 'svc_banho_gel',
    name: 'Banho de Gel e Blindagem',
    categoryId: 'cat_blindagem',
    description:
      'Camada protetora por cima da sua própria unha pra dar mais força, evitar quebras e manter o esmalte intacto por semanas.',
    price: 115,
    durationMinutes: 90,
    imageUrl: STUDIO_IMAGES.banho,
    featured: true,
    active: true,
    order: 3,
  },
  {
    id: 'svc_esmaltacao_gel',
    name: 'Esmaltação em Gel',
    categoryId: 'cat_esmaltacao',
    description:
      'Cutilagem caprichada com acabamento limpo e esmaltação em gel que já sai seca na hora e dura bem mais.',
    price: 85,
    durationMinutes: 60,
    imageUrl: STUDIO_IMAGES.esmaltacao,
    featured: false,
    active: true,
    order: 4,
  },
  {
    id: 'svc_spa_pes',
    name: 'Spa dos Pés e Pedicure em Gel',
    categoryId: 'cat_spa',
    description:
      'Esfoliação, hidratação caprichada nos pés, cutilagem completa e esmaltação em gel pra durar bastante.',
    price: 110,
    durationMinutes: 90,
    imageUrl: STUDIO_IMAGES.spa,
    featured: false,
    active: true,
    order: 5,
  },
  {
    id: 'svc_remocao_segura',
    name: 'Remoção Segura + Nutrição',
    categoryId: 'cat_blindagem',
    description:
      'Retirada do alongamento com cuidado pra não machucar a unha natural, seguida de polimento leve e base fortalecedora.',
    price: 65,
    durationMinutes: 60,
    imageUrl: STUDIO_IMAGES.banho,
    featured: false,
    active: true,
    order: 6,
  },
];
