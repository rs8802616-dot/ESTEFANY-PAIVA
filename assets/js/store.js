/**
 * =====================================================================
 * PLATAFORMA DE AGENDAMENTO PARA MANICURE - MULTI-PORTAL & LGPD
 * STORE CENTRAL, SECDEVOPS, TOKENS CRIPTOGRÁFICOS E REGRAS DE NEGÓCIO
 * =====================================================================
 */

const STORAGE_KEYS = {
  SECURITY_TOKENS: 'epn_sec_tokens',
  SECURITY_LOGS: 'epn_sec_logs',
  TRAFFIC_ANALYTICS: 'epn_traffic_analytics',
  THEME_CONFIG: 'epn_theme_config',
  CAROUSEL_ITEMS: 'epn_carousel_items',
  CATEGORIES: 'epn_categories',
  SERVICES: 'epn_services_with_stories',
  APPOINTMENTS: 'epn_appointments_lgpd',
  SETTINGS: 'epn_salon_settings'
};

// ==========================================
// 1. CRIPTOGRAFIA & UTILITÁRIOS SEGUROS
// ==========================================
const CryptoUtils = {
  // Gera hash SHA-256 usando Web Crypto API
  async sha256(message) {
    if (window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback síncrono simples caso Web Crypto não esteja disponível
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  },

  // Gera token seguro aleatório via CSPRNG
  generateSecureToken(prefix = 'token') {
    const array = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < 16; i++) array[i] = Math.floor(Math.random() * 256);
    }
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${hex}`;
  },

  // Detecta tipo de dispositivo para auditoria
  detectDevice() {
    const ua = navigator.userAgent || '';
    if (/iPhone/i.test(ua)) return 'iPhone (iOS)';
    if (/iPad/i.test(ua)) return 'iPad (iPadOS)';
    if (/Android/i.test(ua)) return 'Celular Android';
    if (/Windows/i.test(ua)) return 'Computador Windows';
    if (/Macintosh/i.test(ua)) return 'Computador macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Dispositivo Web';
  },

  // Gera hash anônimo de sessão/IP simulado (LGPD)
  async getAnonymousSessionHash() {
    const seed = (navigator.userAgent || '') + (screen.width + 'x' + screen.height);
    const hash = await this.sha256(seed);
    return 'ses_' + hash.slice(0, 12);
  }
};

// ==========================================
// 2. WEB AUDIO & ALERTA SONORO PWA ("APITAR NO CELULAR")
// ==========================================
const AudioAlertEngine = {
  ctx: null,

  initAudio() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },

  // Toca um sinal sonoro claro e elegante de alta prioridade ("ding-dong" / "apito")
  playNotificationChime() {
    try {
      this.initAudio();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;

      // Primeiro tom (Mi - 659.25 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Segundo tom (Sol# - 830.61 Hz)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(830.61, now + 0.15);
      gain2.gain.setValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);

      // Terceiro tom de confirmação (Si - 987.77 Hz)
      const osc3 = this.ctx.createOscillator();
      const gain3 = this.ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(987.77, now + 0.3);
      gain3.gain.setValueAtTime(0.35, now + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc3.connect(gain3);
      gain3.connect(this.ctx.destination);
      osc3.start(now + 0.3);
      osc3.stop(now + 0.85);
    } catch (e) {
      console.warn('Alerta sonoro não pode ser executado sem interação prévia:', e);
    }
  },

  // Dispara notificação push com som
  async triggerNativePush(title, body) {
    this.playNotificationChime();

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: 'assets/images/perfil-julia.jpg',
          badge: 'assets/images/perfil-julia.jpg',
          vibrate: [200, 100, 200]
        });
      } else if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          new Notification(title, {
            body: body,
            icon: 'assets/images/perfil-julia.jpg'
          });
        }
      }
    }
  }
};

// ==========================================
// 3. DADOS INICIAIS PADRONIZADOS (SEED)
// ==========================================
const SEED_DATA = {
  // Tokens iniciais de fábrica (hashes SHA-256 serão calculados na inicialização)
  initialTokens: {
    adminToken: 'adm_sec_4c781d9e5b20',
    masterToken: 'mst_sec_8f93e2b10a47'
  },

  salonSettings: {
    salonName: 'ESTEFANY PAIVA NAILS',
    slogan: 'Mais que unhas, é autoestima.',
    welcomeText: 'Bem-vinda de volta ao seu momento de beleza e autocuidado.',
    ownerName: 'Estefany Paiva',
    phone: '(61) 98554-3452',
    instagram: '@estefanypaiva_nails',
    address: 'Brasília - DF',
    avatarImage: 'assets/images/trabalho-amendoada-ouro.png',
    promoBannerTitle: 'Cuidado, beleza e autoestima em cada detalhe ♡',
    promoBannerBtnText: 'Agendar agora',
    promoBannerImage: 'assets/images/trabalho-tons-terrosos.png',
    workHoursWeekdays: '09:00 às 19:30',
    workHoursSaturday: '08:30 às 18:00',
    workSundayOpen: false,
    workHoursSunday: 'Fechado',
    customSlots: ['09:00', '10:30', '13:00', '14:00', '15:30', '17:00', '18:30', '19:30'],
    payPix: true,
    payCredit: true,
    payDebit: true,
    payCash: true,
    pixKey: '(61) 98554-3452',
    depositPercent: 0,
    cancellationPolicy: 'Avisar com pelo menos 24h de antecedência.',
    bufferMinutes: 15,
    minNoticeHours: 2,
    maxFutureDays: 45,
    retentionDays: 90,
    // Controle de abertura da grade da agenda
    scheduleWindow: 'month', // 'week' (semana atual), 'month' (mês atual), 'year' (ano todo), '30days'
    workWeekdays: [1, 2, 3, 4, 5, 6], // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
    blockedDates: [], // Datas específicas bloqueadas pela administradora (ex: ['2026-11-20'])
    themeColors: {
      primaryColor: '#350B19',
      secondaryColor: '#D83F79',
      accentColor: '#8A2D4E',
      cardBgColor: '#FBECEF',
      pageBgColor: '#FAF4F5',
      textColor: '#350B19'
    }
  },

  theme: {
    primaryColor: '#E9A3B5',
    secondaryColor: '#D83F79',
    bgColor: '#F8F2ED',
    cardBgColor: '#FFFFFF',
    textColor: '#171719',
    accentColor: '#C59B6D',
    fontHeading: "'Playfair Display', serif",
    fontBody: "'Plus Jakarta Sans', sans-serif",
    borderStyle: 'rounded', // 'rounded', 'sharp', 'pill'
    isDarkMode: false,
    headerSubtitle: 'Autoestima & Nail Design de Alto Padrão'
  },

  // Carrossel Superior de Trabalhos Realizados (Portfólio Vivo com fotos reais)
  carouselItems: [
    {
      id: 'car_1',
      technique: 'Alongamento Coffin Gel em Tom Chocolate Glossy',
      category: 'Alongamento em Gel',
      image: 'assets/images/trabalho-alongamento-chocolate.png',
      serviceId: 'srv_alongamento',
      tag: 'Mais Pedido',
      active: true
    },
    {
      id: 'car_2',
      technique: 'Amendoada Milky White com Foil de Ouro Fluído',
      category: 'Nail Art & Encapsuladas',
      image: 'assets/images/trabalho-amendoada-ouro.png',
      serviceId: 'srv_nailart',
      tag: 'Exclusividade',
      active: true
    },
    {
      id: 'car_3',
      technique: 'Esmaltação em Gel Paleta Terrosa & Rosé Shimmer',
      category: 'Esmaltação em Gel',
      image: 'assets/images/trabalho-tons-terrosos.png',
      serviceId: 'srv_esmalte',
      tag: 'Tendência',
      active: true
    },
    {
      id: 'car_4',
      technique: 'Francesa Azul Marinho com Nail Art Celestial',
      category: 'Nail Art & Encapsuladas',
      image: 'assets/images/trabalho-francesa-estrela.png',
      serviceId: 'srv_francesa_celestial',
      tag: 'Alta Arte',
      active: true
    },
    {
      id: 'car_5',
      technique: 'Blindagem Diamante com Efeito Glazed Perolado',
      category: 'Spa & Blindagem',
      image: 'assets/images/trabalho-perolada-glaze.png',
      serviceId: 'srv_blindagem',
      tag: 'Brilho Chrome',
      active: true
    }
  ],

  // Categorias de Serviços
  categories: [
    { id: 'cat_alongamento', name: 'Alongamento em Gel', icon: 'fa-gem', order: 1 },
    { id: 'cat_esmalte', name: 'Esmaltação em Gel', icon: 'fa-wand-magic-sparkles', order: 2 },
    { id: 'cat_nailart', name: 'Nail Art & Encapsuladas', icon: 'fa-palette', order: 3 },
    { id: 'cat_blindagem', name: 'Spa & Blindagem', icon: 'fa-shield-halved', order: 4 },
    { id: 'cat_classica', name: 'Manicure & Pedicure Clássica', icon: 'fa-hand-sparkles', order: 5 }
  ],

  // Serviços com Stories (3 Vídeos/Slides reais por serviço)
  services: [
    {
      id: 'srv_alongamento',
      categoryId: 'cat_alongamento',
      name: 'Alongamento em Gel Formato Coffin',
      description: 'Estruturação impecável em formato Coffin/Bailarina longo com acabamento chocolate super brilhante. Máxima durabilidade e curvatura anatômica.',
      price: 150.00,
      duration: 120, // 2 horas
      image: 'assets/images/trabalho-alongamento-chocolate.png',
      active: true,
      storiesVideos: [
        {
          id: 'st_al_1',
          title: 'Alongamento Coffin em Gel',
          mediaUrl: 'assets/images/trabalho-alongamento-chocolate.png',
          caption: 'Estrutura longa com resistência reforçada e brilho profundo ✨',
          duration: 5
        },
        {
          id: 'st_al_2',
          title: 'Curvatura e Simetria',
          mediaUrl: 'assets/images/banner-nails-1.jpg',
          caption: 'Ponto de tensão nivelado milimetricamente para não quebrar 💎',
          duration: 5
        },
        {
          id: 'st_al_3',
          title: 'Top Coat Espelhado',
          mediaUrl: 'assets/images/trabalho-amendoada-glitter.jpg',
          caption: 'Acabamento vítreo chocolate que dura intacto até 30 dias! 💕',
          duration: 5
        }
      ]
    },
    {
      id: 'srv_nailart',
      categoryId: 'cat_nailart',
      name: 'Amendoada Milky White com Foil de Ouro',
      description: 'Unhas almond com base leitosa suave e ondas desenhadas à mão com folhas de ouro encapsuladas. Elegância sofisticada para qualquer ocasião.',
      price: 180.00,
      duration: 135,
      image: 'assets/images/trabalho-amendoada-ouro.png',
      active: true,
      storiesVideos: [
        {
          id: 'st_na_1',
          title: 'Base Milky White Suave',
          mediaUrl: 'assets/images/trabalho-amendoada-ouro.png',
          caption: 'Técnica leitosa translúcida ultra feminina e elegante 🌿✨',
          duration: 5
        },
        {
          id: 'st_na_2',
          title: 'Detalhes em Ouro Fluído',
          mediaUrl: 'assets/images/trabalho-verde-encapsulada.jpg',
          caption: 'Aplicação de foil de ouro 24k protegido sob a lâmina de gel 💎',
          duration: 5
        },
        {
          id: 'st_na_3',
          title: 'Design Feito à Mão',
          mediaUrl: 'assets/images/trabalho-amendoada-glitter.jpg',
          caption: 'Cada unha recebe um desenho artístico exclusivo e exclusivo 💕',
          duration: 5
        }
      ]
    },
    {
      id: 'srv_esmalte',
      categoryId: 'cat_esmalte',
      name: 'Esmaltação em Gel Tons Terrosos & Rosé',
      description: 'Combinação harmônica em degradê suave de nude, cappuccino e marrom aveludado com partícula de brilho rosé.',
      price: 75.00,
      duration: 60,
      image: 'assets/images/trabalho-tons-terrosos.png',
      active: true,
      storiesVideos: [
        {
          id: 'st_es_1',
          title: 'Paleta Mocha & Nude Quente',
          mediaUrl: 'assets/images/trabalho-tons-terrosos.png',
          caption: 'Harmonização de tons quentes com secagem na cabine LED 🌸',
          duration: 5
        },
        {
          id: 'st_es_2',
          title: 'Brilho Acetinado Rosé',
          mediaUrl: 'assets/images/trabalho-nude-classica.jpg',
          caption: 'Toque de shimmer delicado no anelar para iluminar o conjunto ✨',
          duration: 5
        },
        {
          id: 'st_es_3',
          title: 'Secagem Instantânea',
          mediaUrl: 'assets/images/hero-hand-nude.jpg',
          caption: 'Saia da sessão sem perigo de borrar ou perder o brilho! 💅',
          duration: 5
        }
      ]
    },
    {
      id: 'srv_francesa_celestial',
      categoryId: 'cat_nailart',
      name: 'Francesa Marinho & Nail Art Estrela Celestial',
      description: 'Francesinha moderna em azul marinho profundo combinada com aura nail art e estrela dourada desenhada no ponto focal.',
      price: 165.00,
      duration: 120,
      image: 'assets/images/trabalho-francesa-estrela.png',
      active: true,
      storiesVideos: [
        {
          id: 'st_fc_1',
          title: 'Francesinha Azul Marinho',
          mediaUrl: 'assets/images/trabalho-francesa-estrela.png',
          caption: 'Traço de precisão cirúrgica na ponta amendoada 🌌',
          duration: 5
        },
        {
          id: 'st_fc_2',
          title: 'Aura Violeta & Estrela Dourada',
          mediaUrl: 'assets/images/trabalho-amendoada-ouro.png',
          caption: 'Esfumado suave com estrela cósmica desenhada à mão livre ✨',
          duration: 5
        },
        {
          id: 'st_fc_3',
          title: 'Resultado Estiloso & Único',
          mediaUrl: 'assets/images/trabalho-alongamento-chocolate.png',
          caption: 'Aquele trabalho que rende centenas de curtidas e elogios! 💫',
          duration: 5
        }
      ]
    },
    {
      id: 'srv_blindagem',
      categoryId: 'cat_blindagem',
      name: 'Blindagem Diamante com Efeito Glazed Perolado',
      description: 'Tratamento de fortalecimento da lâmina natural finalizado com pó cromado perolado (efeito Hailey Bieber). Brilho acetinado de luxo.',
      price: 95.00,
      duration: 75,
      image: 'assets/images/trabalho-perolada-glaze.png',
      active: true,
      storiesVideos: [
        {
          id: 'st_bl_1',
          title: 'Efeito Glazed Donut Perolado',
          mediaUrl: 'assets/images/trabalho-perolada-glaze.png',
          caption: 'Pó de cromo micropulverizado para um reflexo branco acetinado 💎',
          duration: 5
        },
        {
          id: 'st_bl_2',
          title: 'Reforço Estrutural com Gel',
          mediaUrl: 'assets/images/service-banho.jpg',
          caption: 'Protege unhas finas e quebradiças contra lascas e quebras ✨',
          duration: 5
        },
        {
          id: 'st_bl_3',
          title: 'Aspecto Saudável & Limpo',
          mediaUrl: 'assets/images/trabalho-nude-classica.jpg',
          caption: 'Unhas impecáveis, com brilho limpo e sofisticado por semanas! 💅',
          duration: 5
        }
      ]
    },
    {
      id: 'srv_manicure_spa',
      categoryId: 'cat_classica',
      name: 'Spa Completo dos Pés e Mãos',
      description: 'Esfoliação revigorante, hidratação profunda com parafina térmica, massagem relaxante e cutilagem impecável.',
      price: 80.00,
      duration: 60,
      image: 'assets/images/service-manutencao.jpg',
      active: true,
      storiesVideos: [
        {
          id: 'st_sp_1',
          title: 'Esfoliação com Óleos Essenciais',
          mediaUrl: 'assets/images/service-manutencao.jpg',
          caption: 'Remoção suave de asperezas e células mortas 🌸',
          duration: 5
        },
        {
          id: 'st_sp_2',
          title: 'Massagem Relaxante Podal',
          mediaUrl: 'assets/images/trabalho-quadros.jpg',
          caption: 'Alívio da tensão do dia a dia e hidratação acetinada ✨',
          duration: 5
        },
        {
          id: 'st_sp_3',
          title: 'Cutilagem e Esmaltação Perfeita',
          mediaUrl: 'assets/images/hero-hand-nude.jpg',
          caption: 'Momento de cuidado e carinho que você merece 💕',
          duration: 5
        }
      ]
    }
  ],

  // Agendamentos Iniciais com estrita minimização LGPD (Apenas Nome + Celular)
  initialAppointments: [
    {
      id: 'EP-9021',
      clientName: 'Mariana Santos',
      clientPhone: '(61) 98455-1234',
      serviceId: 'srv_alongamento',
      serviceName: 'Alongamento em Gel Estruturado',
      categoryId: 'cat_alongamento',
      categoryName: 'Alongamento em Gel',
      servicePrice: 150.00,
      duration: 120,
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      status: 'Confirmado',
      createdAt: new Date().toISOString()
    },
    {
      id: 'EP-9022',
      clientName: 'Carla Mendes',
      clientPhone: '(61) 98888-2222',
      serviceId: 'srv_blindagem',
      serviceName: 'Banho de Gel & Blindagem Diamante',
      categoryId: 'cat_blindagem',
      categoryName: 'Spa & Blindagem',
      servicePrice: 90.00,
      duration: 75,
      date: new Date().toISOString().split('T')[0],
      time: '13:30',
      status: 'Confirmado',
      createdAt: new Date().toISOString()
    },
    {
      id: 'EP-9023',
      clientName: 'Beatriz Lima',
      clientPhone: '(61) 97777-3333',
      serviceId: 'srv_nailart',
      serviceName: 'Nail Art Luxo & Flores Encapsuladas',
      categoryId: 'cat_nailart',
      categoryName: 'Nail Art & Encapsuladas',
      servicePrice: 185.00,
      duration: 150,
      date: new Date().toISOString().split('T')[0],
      time: '16:00',
      status: 'Pendente',
      createdAt: new Date().toISOString()
    },
    {
      id: 'EP-9024',
      clientName: 'Amanda Oliveira',
      clientPhone: '(61) 96666-4444',
      serviceId: 'srv_esmalte',
      serviceName: 'Esmaltação em Gel Secagem UV/LED',
      categoryId: 'cat_esmalte',
      categoryName: 'Esmaltação em Gel',
      servicePrice: 70.00,
      duration: 60,
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: '10:00',
      status: 'Confirmado',
      createdAt: new Date().toISOString()
    }
  ]
};

// ==========================================
// 4. MOTOR DA STORE GLOBAL (WINDOW.EPStore)
// ==========================================
window.EPStore = {
  async init() {
    // 1. Configurações de Segurança e Tokens (hashes SHA-256)
    if (!localStorage.getItem(STORAGE_KEYS.SECURITY_TOKENS)) {
      const adminHash = await CryptoUtils.sha256(SEED_DATA.initialTokens.adminToken);
      const masterHash = await CryptoUtils.sha256(SEED_DATA.initialTokens.masterToken);

      const secData = {
        adminTokenHash: adminHash,
        masterTokenHash: masterHash,
        adminTokenActive: SEED_DATA.initialTokens.adminToken,
        masterTokenActive: SEED_DATA.initialTokens.masterToken,
        lastRotatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.SECURITY_TOKENS, JSON.stringify(secData));
    }

    // 2. Auditoria e Logs
    if (!localStorage.getItem(STORAGE_KEYS.SECURITY_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.SECURITY_LOGS, JSON.stringify([
        {
          id: 'log_init',
          timestamp: new Date().toISOString(),
          route: '/master',
          device: CryptoUtils.detectDevice(),
          sessionHash: 'ses_master_init',
          status: 'AUTORIZADO',
          notes: 'Inicialização segura dos tokens criptográficos'
        }
      ]));
    }

    // 3. Analytics e Funil de Tráfego
    if (!localStorage.getItem(STORAGE_KEYS.TRAFFIC_ANALYTICS)) {
      const hoursMap = {};
      for (let h = 0; h < 24; h++) hoursMap[h] = 0;
      // Picos típicos de manicure: 10h, 14h, 16h, 18h, 20h
      hoursMap[9] = 14; hoursMap[10] = 32; hoursMap[11] = 22;
      hoursMap[14] = 45; hoursMap[15] = 38; hoursMap[16] = 52;
      hoursMap[18] = 68; hoursMap[19] = 84; hoursMap[20] = 95;

      const weekdaysMap = { 0: 25, 1: 42, 2: 58, 3: 74, 4: 98, 5: 120, 6: 110 };

      localStorage.setItem(STORAGE_KEYS.TRAFFIC_ANALYTICS, JSON.stringify({
        hourlyVisits: hoursMap,
        weekdayVisits: weekdaysMap,
        funnel: {
          linkViews: 450,
          storiesViews: 285,
          bookingStarts: 130,
          bookingCompletions: 48
        }
      }));
    }

    // 4. White-Label & Tema
    if (!localStorage.getItem(STORAGE_KEYS.THEME_CONFIG)) {
      localStorage.setItem(STORAGE_KEYS.THEME_CONFIG, JSON.stringify(SEED_DATA.theme));
    }

    // 5. Portfólio Vivo (Carrossel Topo)
    const existingCarousel = localStorage.getItem(STORAGE_KEYS.CAROUSEL_ITEMS);
    if (!existingCarousel || !existingCarousel.includes('trabalho-alongamento-chocolate.png')) {
      localStorage.setItem(STORAGE_KEYS.CAROUSEL_ITEMS, JSON.stringify(SEED_DATA.carouselItems));
    }

    // 6. Categorias
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(SEED_DATA.categories));
    }

    // 7. Serviços com Stories
    const existingServices = localStorage.getItem(STORAGE_KEYS.SERVICES);
    if (!existingServices || !existingServices.includes('trabalho-alongamento-chocolate.png')) {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(SEED_DATA.services));
    }

    // 8. Agendamentos
    if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(SEED_DATA.initialAppointments));
    }

    // 9. Configurações do Salão
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SEED_DATA.salonSettings));
    }

    // Aplica o tema visual no documento em tempo real
    this.applyThemeToDocument();
    this.startRealtimeSync();
    await this.pullCloudEvents(false);
  },

  // ----------------------------------------------------
  // GESTÃO DE TOKENS & VALIDAÇÃO CRIPTOGRÁFICA (SHA-256)
  // ----------------------------------------------------
  async validateToken(tokenProvided, role = 'admin') {
    if (!tokenProvided) return false;
    const secTokens = JSON.parse(localStorage.getItem(STORAGE_KEYS.SECURITY_TOKENS) || '{}');
    const providedHash = await CryptoUtils.sha256(tokenProvided.trim());
    
    let isAuthorized = false;
    let expectedHash = '';

    if (role === 'admin') {
      expectedHash = secTokens.adminTokenHash;
      isAuthorized = (providedHash === expectedHash);
    } else if (role === 'master') {
      expectedHash = secTokens.masterTokenHash;
      isAuthorized = (providedHash === expectedHash);
    }

    // Log de auditoria imediato
    await this.logSecurityEvent({
      route: role === 'master' ? '/master' : '/admin',
      tokenProvided: tokenProvided.slice(0, 6) + '***',
      status: isAuthorized ? 'AUTORIZADO' : 'BLOQUEADO: Token Inválido',
      notes: isAuthorized ? `Sessão autenticada com sucesso como ${role}` : `Tentativa negada de acesso a ${role}`
    });

    return isAuthorized;
  },

  async logSecurityEvent(eventData) {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.SECURITY_LOGS) || '[]');
    const sessionHash = await CryptoUtils.getAnonymousSessionHash();

    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      route: eventData.route,
      device: CryptoUtils.detectDevice(),
      sessionHash: sessionHash,
      status: eventData.status,
      notes: eventData.notes || ''
    };

    logs.unshift(newLog);
    // Limite dos últimos 200 logs
    if (logs.length > 200) logs.pop();
    localStorage.setItem(STORAGE_KEYS.SECURITY_LOGS, JSON.stringify(logs));
  },

  getSecurityLogs() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SECURITY_LOGS) || '[]');
  },

  // Rotação Criptográfica de Token da Administradora
  async rotateAdminToken() {
    const newToken = CryptoUtils.generateSecureToken('adm');
    const newHash = await CryptoUtils.sha256(newToken);
    const secTokens = JSON.parse(localStorage.getItem(STORAGE_KEYS.SECURITY_TOKENS) || '{}');

    secTokens.adminTokenActive = newToken;
    secTokens.adminTokenHash = newHash;
    secTokens.lastRotatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.SECURITY_TOKENS, JSON.stringify(secTokens));

    await this.logSecurityEvent({
      route: '/master',
      status: 'AUTORIZADO',
      notes: 'ROTAÇÃO: Token da Administradora rotacionado com sucesso'
    });

    const fullUrl = `${window.location.origin}${window.location.pathname.replace(/[^\/]+$/, '')}admin.html?token=${newToken}`;
    return { token: newToken, fullUrl: fullUrl };
  },

  // Rotação Criptográfica de Token Mestre (Dono)
  async rotateMasterToken() {
    const newToken = CryptoUtils.generateSecureToken('mst');
    const newHash = await CryptoUtils.sha256(newToken);
    const secTokens = JSON.parse(localStorage.getItem(STORAGE_KEYS.SECURITY_TOKENS) || '{}');

    secTokens.masterTokenActive = newToken;
    secTokens.masterTokenHash = newHash;
    secTokens.lastRotatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.SECURITY_TOKENS, JSON.stringify(secTokens));

    await this.logSecurityEvent({
      route: '/master',
      status: 'AUTORIZADO',
      notes: 'ROTAÇÃO: Token Mestre do Proprietário rotacionado com sucesso'
    });

    const fullUrl = `${window.location.origin}${window.location.pathname.replace(/[^\/]+$/, '')}master.html?token=${newToken}`;
    return { token: newToken, fullUrl: fullUrl };
  },

  getActiveTokensUrls() {
    const sec = JSON.parse(localStorage.getItem(STORAGE_KEYS.SECURITY_TOKENS) || '{}');
    const basePath = window.location.origin + window.location.pathname.replace(/[^\/]+$/, '');
    return {
      adminUrl: `${basePath}admin.html?token=${sec.adminTokenActive || SEED_DATA.initialTokens.adminToken}`,
      masterUrl: `${basePath}master.html?token=${sec.masterTokenActive || SEED_DATA.initialTokens.masterToken}`,
      adminToken: sec.adminTokenActive || SEED_DATA.initialTokens.adminToken,
      masterToken: sec.masterTokenActive || SEED_DATA.initialTokens.masterToken,
      lastRotatedAt: sec.lastRotatedAt
    };
  },

  // ----------------------------------------------------
  // ANÁLISE DE TRÁFEGO, PICOS E FUNIL DE CONVERSÃO
  // ----------------------------------------------------
  recordPageVisit() {
    const analytics = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRAFFIC_ANALYTICS) || '{}');
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    if (!analytics.hourlyVisits) analytics.hourlyVisits = {};
    if (!analytics.weekdayVisits) analytics.weekdayVisits = {};
    if (!analytics.funnel) analytics.funnel = { linkViews: 0, storiesViews: 0, bookingStarts: 0, bookingCompletions: 0 };

    analytics.hourlyVisits[hour] = (analytics.hourlyVisits[hour] || 0) + 1;
    analytics.weekdayVisits[day] = (analytics.weekdayVisits[day] || 0) + 1;
    analytics.funnel.linkViews = (analytics.funnel.linkViews || 0) + 1;

    localStorage.setItem(STORAGE_KEYS.TRAFFIC_ANALYTICS, JSON.stringify(analytics));
  },

  recordStoriesView() {
    const analytics = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRAFFIC_ANALYTICS) || '{}');
    if (analytics.funnel) {
      analytics.funnel.storiesViews = (analytics.funnel.storiesViews || 0) + 1;
      localStorage.setItem(STORAGE_KEYS.TRAFFIC_ANALYTICS, JSON.stringify(analytics));
    }
  },

  recordBookingStart() {
    const analytics = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRAFFIC_ANALYTICS) || '{}');
    if (analytics.funnel) {
      analytics.funnel.bookingStarts = (analytics.funnel.bookingStarts || 0) + 1;
      localStorage.setItem(STORAGE_KEYS.TRAFFIC_ANALYTICS, JSON.stringify(analytics));
    }
  },

  recordBookingCompletion() {
    const analytics = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRAFFIC_ANALYTICS) || '{}');
    if (analytics.funnel) {
      analytics.funnel.bookingCompletions = (analytics.funnel.bookingCompletions || 0) + 1;
      localStorage.setItem(STORAGE_KEYS.TRAFFIC_ANALYTICS, JSON.stringify(analytics));
    }
  },

  getTrafficAnalytics() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRAFFIC_ANALYTICS) || '{}');
  },

  // ----------------------------------------------------
  // WHITE-LABEL: CUSTOMIZAÇÃO COMPLETA DA TELA DO CLIENTE
  // ----------------------------------------------------
  getTheme() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.THEME_CONFIG) || JSON.stringify(SEED_DATA.theme));
  },

  saveTheme(themeUpdates) {
    const current = this.getTheme();
    const updated = { ...current, ...themeUpdates };
    localStorage.setItem(STORAGE_KEYS.THEME_CONFIG, JSON.stringify(updated));
    this.applyThemeToDocument();
    this.publishCloudSync('UPDATE_THEME', updated);
    return updated;
  },

  // Utilitário de luminância relativa para contraste inteligente de letras e títulos
  getLuminance(hex) {
    const clean = String(hex || '#FFFFFF').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const r = parseInt(full.slice(0, 2) || 'ff', 16) / 255;
    const g = parseInt(full.slice(2, 4) || 'ff', 16) / 255;
    const b = parseInt(full.slice(4, 6) || 'ff', 16) / 255;
    const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  },

  applyThemeToDocument() {
    const theme = this.getTheme();
    const settings = this.getSalonSettings ? this.getSalonSettings() : {};
    const c = (settings && settings.themeColors) ? { ...theme, ...settings.themeColors } : theme;
    const root = document.documentElement;

    const prim = c.primaryColor || '#350B19';
    const sec = c.secondaryColor || '#D83F79';
    const cardBg = c.cardBgColor || '#FBECEF';
    const pageBg = c.pageBgColor || '#FAF4F5';

    // Calcula luminância para adaptar automaticamente as cores de todos os textos, nomes e ícones
    const lumPrim = this.getLuminance(prim);
    const lumCard = this.getLuminance(cardBg);
    const lumPage = this.getLuminance(pageBg);

    const isDarkCard = lumCard < 0.42;
    const isDarkPage = lumPage < 0.42;
    const isLightPrim = lumPrim > 0.52;

    // Se a usuária escolheu uma cor de texto manual e não ativou contraste automático, respeita; caso contrário, adapta automaticamente
    const autoContrast = c.autoContrast !== false;
    const textOnPrim = isLightPrim ? '#18181B' : '#FFFFFF';
    const subOnPrim = isLightPrim ? 'rgba(24, 24, 27, 0.78)' : 'rgba(255, 255, 255, 0.85)';

    const textOnCard = (!autoContrast && c.textColor) ? c.textColor : (isDarkCard ? '#FFFFFF' : (prim !== '#350B19' && lumPrim < 0.35 ? prim : '#27131A'));
    const subOnCard = isDarkCard ? 'rgba(255, 255, 255, 0.78)' : (prim !== '#350B19' && lumPrim < 0.35 ? sec : '#5C2235');
    const borderOnCard = isDarkCard ? 'rgba(255, 255, 255, 0.14)' : 'rgba(77, 19, 40, 0.12)';
    const innerSurfaceBg = isDarkCard ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF';

    const textOnPage = (!autoContrast && c.textColor) ? c.textColor : (isDarkPage ? '#FFFFFF' : (prim !== '#350B19' && lumPrim < 0.35 ? prim : '#350B19'));
    const subOnPage = isDarkPage ? 'rgba(255, 255, 255, 0.75)' : '#6A1D39';

    let dynStyle = document.getElementById('ep-dynamic-theme-overrides');
    if (!dynStyle) {
      dynStyle = document.createElement('style');
      dynStyle.id = 'ep-dynamic-theme-overrides';
      document.head.appendChild(dynStyle);
    }

    if (prim !== '#350B19' || sec !== '#D83F79' || cardBg !== '#FBECEF' || pageBg !== '#FAF4F5' || c.textColor) {
      dynStyle.textContent = `
        :root {
          --color-rose: ${prim} !important;
          --color-pink-accent: ${sec} !important;
          --theme-prim: ${prim};
          --theme-sec: ${sec};
          --theme-card-bg: ${cardBg};
          --theme-page-bg: ${pageBg};
          --theme-text-card: ${textOnCard};
          --theme-sub-card: ${subOnCard};
          --theme-text-page: ${textOnPage};
        }

        /* Fundo geral da página e textos externos */
        body,
        .site-wrapper-expansive,
        .client-site-wrapper-expansive,
        .admin-site-wrapper-expansive,
        .client-main-content-expansive,
        .admin-main-container {
          background-color: ${pageBg} !important;
          color: ${textOnPage} !important;
        }

        /* Títulos de seções na página */
        .section-head-row h3,
        .section-head-title-row h3,
        .section-head-title-row h4,
        .booking-card-header h3 {
          color: ${textOnPage} !important;
        }
        .section-head-row a,
        .section-head-title-row p,
        .booking-card-header p,
        .view-all-link {
          color: ${subOnPage} !important;
        }

        /* Cabeçalho superior e barras de navegação inferiores */
        .client-header-wine,
        .wine-header-curved-expansive,
        .admin-header-wine,
        .bottom-nav-wine-client,
        .bottom-nav-wine-admin {
          background: linear-gradient(145deg, ${prim} 0%, ${sec} 145%) !important;
          color: ${textOnPrim} !important;
        }
        .client-header-wine h1,
        .client-header-wine h2,
        .client-header-wine span,
        .client-header-wine p,
        .admin-header-wine h1,
        .admin-header-wine h2,
        .admin-header-wine span,
        .admin-header-wine p {
          color: ${textOnPrim} !important;
        }

        /* Botões principais e pílulas ativas com contraste automático */
        .btn-promo-wine-pill,
        .btn-confirm-booking-wine,
        .btn-admin-bottom-action,
        .category-tab-pill.active,
        .filter-pill.active,
        .slot-chip-btn.active,
        .cal-day-btn.selected,
        .cal-day-cell.selected,
        .nav-tab-btn.active,
        .admin-nav-tab-btn.active {
          background: ${prim} !important;
          color: ${textOnPrim} !important;
          border-color: ${sec} !important;
        }
        .btn-promo-wine-pill span,
        .btn-promo-wine-pill i,
        .btn-confirm-booking-wine i {
          color: ${textOnPrim} !important;
        }

        /* Superfície de todos os cards (Cliente e Admin) */
        .quick-action-card,
        .card-action-squircle,
        .promo-highlight-card,
        .next-booking-banner,
        .service-card-lux,
        .booking-unified-card,
        .card-list-item,
        .kpi-pink-card,
        .admin-sub-card,
        .admin-chart-card,
        .admin-action-btn-squircle,
        .client-modal-card,
        .admin-modal-card {
          background: ${cardBg} !important;
          color: ${textOnCard} !important;
          border-color: ${borderOnCard} !important;
        }

        /* Adaptação automática de TODOS os nomes, títulos e valores dentro dos cards */
        .quick-action-card span,
        .promo-text-side h3,
        .booking-banner-info h4,
        .service-details-box h4,
        .service-price-val,
        .selected-service-info h4,
        .calendar-month-header h4,
        .card-list-item h5,
        .card-list-item strong,
        .appointment-info-col h5,
        .kpi-pink-card .kpi-num,
        .admin-sub-card h4,
        .admin-chart-card h3,
        .admin-chart-card strong,
        .donut-legend-item strong,
        .admin-action-btn-squircle span,
        .client-modal-card h3,
        .client-modal-card h4,
        .admin-modal-card h3,
        .admin-modal-card h4,
        .admin-modal-card label {
          color: ${textOnCard} !important;
        }

        /* Adaptação automática de descrições, subtítulos e legendas nos cards */
        .booking-banner-info p,
        .service-desc-snippet,
        .selected-service-info p,
        .card-list-item p,
        .card-list-item span:not(.badge-status-pill),
        .appointment-info-col p,
        .kpi-pink-card .kpi-lbl,
        .admin-chart-card p,
        .donut-legend-item span,
        .calendar-weekdays-row span,
        .client-modal-card p,
        .admin-modal-card p {
          color: ${subOnCard} !important;
        }

        /* Ícones de destaque acompanham a cor secundária ou contraste */
        .quick-action-icon-circle i,
        .kpi-pink-card > i,
        .admin-action-btn-squircle i,
        .section-head-row h3 i,
        .section-head-title-row h3 i {
          color: ${isDarkCard ? sec : prim} !important;
        }

        /* Sub-caixas internas (calendário, inputs, resumos) */
        .calendar-box-container,
        .selected-service-summary-bar,
        .booking-date-badge,
        .search-input-box,
        .input-icon-field {
          background: ${innerSurfaceBg} !important;
          color: ${textOnCard} !important;
          border-color: ${borderOnCard} !important;
        }
        .booking-date-badge .day-num,
        .booking-date-badge .day-week,
        .booking-date-badge .day-month,
        .input-icon-field input,
        .search-input-box input {
          color: ${textOnCard} !important;
        }

        /* Botões secundários e pílulas não-ativas */
        .category-tab-pill:not(.active),
        .filter-pill:not(.active),
        .slot-chip-btn:not(.active),
        .btn-select-service-pill,
        .btn-details-soft-pill,
        .cal-day-btn:not(.selected),
        .cal-day-cell:not(.selected) {
          background: ${innerSurfaceBg} !important;
          color: ${textOnCard} !important;
          border-color: ${borderOnCard} !important;
        }
      `;
    } else {
      dynStyle.textContent = '';
    }

    root.style.setProperty('--color-rose', theme.primaryColor || '#E9A3B5');
    root.style.setProperty('--color-pink-accent', theme.secondaryColor || '#D83F79');
    root.style.setProperty('--color-pink-btn', theme.primaryColor || '#E9A3B5');
    root.style.setProperty('--color-creme', theme.isDarkMode ? '#171719' : (theme.bgColor || '#F8F2ED'));
    root.style.setProperty('--color-branco', theme.isDarkMode ? '#222022' : (theme.cardBgColor || '#FFFFFF'));
    root.style.setProperty('--color-preto', theme.isDarkMode ? '#FFFFFF' : (theme.textColor || '#171719'));
    root.style.setProperty('--font-serif', theme.fontHeading || "'Playfair Display', serif");
    root.style.setProperty('--font-sans', theme.fontBody || "'Plus Jakarta Sans', sans-serif");

    if (theme.borderStyle === 'sharp') {
      root.style.setProperty('--radius-sm', '0px');
      root.style.setProperty('--radius-md', '2px');
      root.style.setProperty('--radius-lg', '4px');
      root.style.setProperty('--radius-pill', '4px');
    } else if (theme.borderStyle === 'pill') {
      root.style.setProperty('--radius-sm', '16px');
      root.style.setProperty('--radius-md', '24px');
      root.style.setProperty('--radius-lg', '32px');
      root.style.setProperty('--radius-pill', '9999px');
    } else {
      root.style.setProperty('--radius-sm', '10px');
      root.style.setProperty('--radius-md', '16px');
      root.style.setProperty('--radius-lg', '24px');
      root.style.setProperty('--radius-pill', '9999px');
    }
  },

  getSalonSettings() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || JSON.stringify(SEED_DATA.salonSettings));
  },

  saveSalonSettings(newSettings) {
    const current = this.getSalonSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    this.publishCloudSync('UPDATE_SETTINGS', updated);
    return updated;
  },

  // ----------------------------------------------------
  // CARROSSEL DO TOPO (PORTFÓLIO VIVO)
  // ----------------------------------------------------
  getCarouselItems() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CAROUSEL_ITEMS) || '[]');
  },

  saveCarouselItem(item) {
    const list = this.getCarouselItems();
    if (!item.id) item.id = 'car_' + Date.now();
    const idx = list.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.push(item);
    }
    localStorage.setItem(STORAGE_KEYS.CAROUSEL_ITEMS, JSON.stringify(list));
    return list;
  },

  deleteCarouselItem(id) {
    let list = this.getCarouselItems();
    list = list.filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.CAROUSEL_ITEMS, JSON.stringify(list));
    return list;
  },

  // ----------------------------------------------------
  // CATEGORIAS & SERVIÇOS COM STORIES
  // ----------------------------------------------------
  // ----------------------------------------------------
  // GESTÃO AVANÇADA DE CATEGORIAS (CRUD + NUVEM)
  // ----------------------------------------------------
  getCategories() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || JSON.stringify(SEED_DATA.categories));
  },

  saveCategory(cat) {
    const list = this.getCategories();
    if (!cat.id) {
      cat.id = 'cat_' + Date.now();
    }
    const idx = list.findIndex(c => c.id === cat.id);
    let saved = cat;
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cat };
      saved = list[idx];
    } else {
      cat.order = list.length + 1;
      list.push(cat);
      saved = cat;
    }
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(list));
    this.publishCloudSync('UPSERT_CATEGORY', saved);
    return list;
  },

  deleteCategory(catId) {
    let list = this.getCategories();
    list = list.filter(c => c.id !== catId);
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(list));
    this.publishCloudSync('DELETE_CATEGORY', { id: catId });
    return list;
  },

  getServices(onlyActive = false) {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.SERVICES) || '[]');
    return onlyActive ? list.filter(s => s.active) : list;
  },

  getServiceById(id) {
    const list = this.getServices(false);
    return list.find(s => s.id === id) || null;
  },

  saveService(serviceData) {
    const list = this.getServices(false);
    if (!serviceData.id) serviceData.id = 'srv_' + Date.now();
    const idx = list.findIndex(s => s.id === serviceData.id);
    let savedItem = serviceData;
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...serviceData };
      savedItem = list[idx];
    } else {
      list.push(serviceData);
    }
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(list));
    this.publishCloudSync('UPSERT_SERVICE', savedItem);
    return list;
  },

  deleteService(id) {
    let list = this.getServices(false);
    list = list.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(list));
    this.publishCloudSync('DELETE_SERVICE', { id });
    return list;
  },

  // ----------------------------------------------------
  // GESTÃO DE AGENDAMENTOS (100% LGPD - MINIMIZAÇÃO DE DADOS)
  // ----------------------------------------------------
  getAppointments() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS) || '[]');
  },

  // Retorna todos os slots configurados pela administradora
  getConfiguredSlots() {
    const settings = this.getSalonSettings();
    if (Array.isArray(settings.customSlots) && settings.customSlots.length > 0) {
      return settings.customSlots;
    }
    return ['09:00', '10:30', '13:00', '14:00', '15:30', '17:00', '18:30', '19:30'];
  },

  // Retorna slots disponíveis para a data escolhida
  // ----------------------------------------------------
  // REGRAS DE GRADE DE AGENDA & DIAS DISPONÍVEIS
  // ----------------------------------------------------
  isDateAvailableForBooking(dateStr) {
    if (!dateStr) return false;
    const settings = this.getSalonSettings();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    targetDate.setHours(0, 0, 0, 0);

    // Não permite datas passadas
    if (targetDate < today) return false;

    // 1. Verifica se a data está na lista de bloqueios manuais
    const blocked = settings.blockedDates || [];
    if (blocked.includes(dateStr)) return false;

    // 2. Verifica se o dia da semana é atendido (0=Dom, 1=Seg, etc.)
    const weekday = targetDate.getDay();
    const allowedDays = settings.workWeekdays || [1, 2, 3, 4, 5, 6];
    if (!allowedDays.includes(weekday)) return false;

    // 2.5 Verifica se o mês específico está liberado pela administradora (0=Jan .. 11=Dez)
    const targetMonth = targetDate.getMonth();
    if (Array.isArray(settings.allowedMonths) && settings.allowedMonths.length > 0) {
      if (!settings.allowedMonths.includes(targetMonth)) return false;
    }

    // 3. Verifica a regra da janela de abertura da agenda
    const windowMode = settings.scheduleWindow || 'month';
    if (windowMode === 'week') {
      // Apenas a semana atual (até o próximo domingo; quando a semana acaba, avança automaticamente para a próxima)
      const currentDay = today.getDay();
      const daysUntilSunday = (7 - currentDay) % 7;
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
      endOfWeek.setHours(23, 59, 59, 999);
      if (targetDate > endOfWeek) return false;
    } else if (windowMode === 'month') {
      // Apenas o mês atual vigente (se faltar menos de 2 dias para acabar o mês, abre também o próximo mês automaticamente)
      const daysInCurrMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const isNearMonthEnd = (daysInCurrMonth - today.getDate()) <= 2;
      const sameMonth = (targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear());
      const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const isNextMonth = isNearMonthEnd && (targetDate.getMonth() === nextMonthDate.getMonth() && targetDate.getFullYear() === nextMonthDate.getFullYear());
      if (!sameMonth && !isNextMonth) {
        return false;
      }
    } else if (windowMode === '30days') {
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + 30);
      if (targetDate > maxDate) return false;
    } else if (windowMode === 'custom_months') {
      // Respeita estritamente os meses marcados em settings.allowedMonths
      const allowedM = settings.allowedMonths || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      if (!allowedM.includes(targetMonth)) return false;
    }
    // 'year' ou 'all' permite o ano todo (respeitando allowedMonths se configurado)
    return true;
  },

  toggleBlockedDate(dateStr) {
    const settings = this.getSalonSettings();
    let blocked = settings.blockedDates || [];
    if (blocked.includes(dateStr)) {
      blocked = blocked.filter(d => d !== dateStr);
    } else {
      blocked.push(dateStr);
    }
    return this.saveSalonSettings({ blockedDates: blocked });
  },

  updateScheduleSettings(scheduleData) {
    return this.saveSalonSettings(scheduleData);
  },

  getAvailableSlots(dateStr, durationMinutes = 60) {
    const appointments = this.getAppointments();
    const dayAppointments = appointments.filter(a => a.date === dateStr && a.status !== 'Cancelado');

    const defaultSlots = this.getConfiguredSlots();
    const takenTimes = new Set(dayAppointments.map(a => a.time));

    return defaultSlots.filter(slot => !takenTimes.has(slot));
  },

  // Criação de Agendamento Enxuto (Apenas Nome + Celular) - Persistência Garantida
  async createAppointment(bookingInput) {
    const storedService = this.getServiceById(bookingInput.serviceId);
    const service = storedService || {
      id: bookingInput.serviceId || ('srv_' + Date.now()),
      name: bookingInput.serviceName || 'Alongamento em Gel',
      categoryId: bookingInput.categoryId || 'cat_alongamento',
      price: parseFloat(bookingInput.servicePrice) || 150.00,
      duration: parseInt(bookingInput.duration, 10) || 90
    };

    const categories = this.getCategories();
    const cat = categories.find(c => c.id === service.categoryId);

    const newApp = {
      id: 'EP-' + Math.floor(1000 + Math.random() * 9000),
      clientName: (bookingInput.clientName || '').trim(),
      clientPhone: (bookingInput.clientPhone || '').trim(),
      serviceId: service.id,
      serviceName: bookingInput.serviceName || service.name,
      categoryId: service.categoryId || 'cat_alongamento',
      categoryName: cat ? cat.name : (bookingInput.categoryName || 'Alongamento em Gel'),
      servicePrice: parseFloat(bookingInput.servicePrice || service.price || 150),
      duration: parseInt(bookingInput.duration || service.duration || 90, 10),
      date: bookingInput.date || new Date().toISOString().split('T')[0],
      time: bookingInput.time || '14:00',
      status: bookingInput.status || 'Confirmado',
      notes: bookingInput.notes || '',
      createdAt: new Date().toISOString()
    };

    const list = this.getAppointments();
    list.unshift(newApp);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));

    // Salva também os dados da cliente para persistência após F5 / atualização da página
    if (newApp.clientName && newApp.clientPhone) {
      localStorage.setItem('epn_last_client_name', newApp.clientName);
      localStorage.setItem('epn_last_client_phone', newApp.clientPhone);
      localStorage.setItem('epn_last_appointment_id', newApp.id);
    }

    // Registra métrica de conversão e sincroniza em tempo real com o Painel Admin (Celular <-> PC)
    this.recordBookingCompletion();
    this.publishCloudSync('UPSERT_APPOINTMENT', newApp);

    // Dispara alerta sonoro e notificação push instantânea para a administradora
    try {
      AudioAlertEngine.triggerNativePush(
        '💅 Novo Agendamento Recebido!',
        `${newApp.clientName} agendou ${newApp.serviceName} para ${newApp.date} às ${newApp.time}h`
      );
    } catch (e) {
      console.warn('Push notification warning:', e);
    }

    return newApp;
  },

  updateAppointmentStatus(id, newStatus) {
    const list = this.getAppointments();
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Agendamento não encontrado');

    list[idx].status = newStatus;
    list[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
    this.publishCloudSync('UPDATE_APPOINTMENT_STATUS', { id, status: newStatus, updatedAt: list[idx].updatedAt });

    // Se cancelado ou confirmado, emite alerta
    if (newStatus === 'Cancelado') {
      AudioAlertEngine.triggerNativePush(
        '⚠️ Horário Liberado!',
        `O atendimento de ${list[idx].clientName} foi cancelado e a vaga está aberta.`
      );
    }
    return list[idx];
  },

  // ----------------------------------------------------
  // INTEGRAÇÃO COM AGENDAS (GOOGLE CALENDAR & .ICS)
  // ----------------------------------------------------
  getGoogleCalendarUrl(appointment) {
    const [year, month, day] = appointment.date.split('-');
    const [hour, min] = appointment.time.split(':');
    const startObj = new Date(year, month - 1, day, hour, min);
    const endObj = new Date(startObj.getTime() + (appointment.duration || 60) * 60000);

    const formatGDate = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

    const title = encodeURIComponent(`Manicure: ${appointment.serviceName} - Estefany Paiva Nails`);
    const details = encodeURIComponent(`Atendimento confirmado para ${appointment.clientName}.\nServiço: ${appointment.serviceName}\nValor: R$ ${appointment.servicePrice.toFixed(2)}\nLocal: Brasília - DF`);
    const location = encodeURIComponent('Estefany Paiva Nails - Brasília, DF');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGDate(startObj)}/${formatGDate(endObj)}&details=${details}&location=${location}`;
  },

  downloadIcsFile(appointment) {
    const [year, month, day] = appointment.date.split('-');
    const [hour, min] = appointment.time.split(':');
    const startObj = new Date(year, month - 1, day, hour, min);
    const endObj = new Date(startObj.getTime() + (appointment.duration || 60) * 60000);

    const formatIcs = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Estefany Paiva Nails//Agendamento//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${appointment.id}@estefanypaivanails.com`,
      `DTSTAMP:${formatIcs(new Date())}`,
      `DTSTART:${formatIcs(startObj)}`,
      `DTEND:${formatIcs(endObj)}`,
      `SUMMARY:Manicure: ${appointment.serviceName} - Estefany Paiva`,
      `DESCRIPTION:Atendimento de ${appointment.serviceName} para ${appointment.clientName}. Código: ${appointment.id}`,
      'LOCATION:Brasília - DF',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agendamento_${appointment.id}.ics`;
    link.click();
  },

  // ----------------------------------------------------
  // RELATÓRIOS E ANÁLISE POR CATEGORIA
  // ----------------------------------------------------
  getManagementReports() {
    const appointments = this.getAppointments();
    let totalRevenueConfirmed = 0;
    let totalRevenueForecasted = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    const categoryStats = {};

    appointments.forEach(a => {
      const cat = a.categoryName || 'Outros';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, revenue: 0 };
      }

      if (a.status !== 'Cancelado') {
        totalRevenueForecasted += a.servicePrice;
        categoryStats[cat].count += 1;
        categoryStats[cat].revenue += a.servicePrice;

        if (a.status === 'Confirmado' || a.status === 'Concluído') {
          totalRevenueConfirmed += a.servicePrice;
        }
        if (a.status === 'Concluído') completedCount += 1;
      } else {
        cancelledCount += 1;
      }
    });

    const activeCount = appointments.filter(a => a.status !== 'Cancelado').length;
    const ticketMedio = activeCount > 0 ? (totalRevenueForecasted / activeCount) : 0;
    const totalRequests = appointments.length;
    const attendanceRate = totalRequests > 0 ? (((totalRequests - cancelledCount) / totalRequests) * 100).toFixed(0) : 100;

    return {
      totalAppointments: activeCount,
      revenueConfirmed: totalRevenueConfirmed,
      revenueForecasted: totalRevenueForecasted,
      ticketMedio: ticketMedio,
      attendanceRate: attendanceRate,
      categoryStats: categoryStats
    };
  },

  // ----------------------------------------------------
  // CONFORMIDADE LGPD: EXPURGO & ANONIMIZAÇÃO AUTOMÁTICA
  // ----------------------------------------------------
  purgeExpiredClientData() {
    const settings = this.getSalonSettings();
    const days = settings.retentionDays || 90;
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const appointments = this.getAppointments();
    let purgedCount = 0;

    appointments.forEach(a => {
      const appDate = new Date(a.date);
      if (appDate < cutoffDate && a.clientPhone && !a.clientPhone.includes('*****')) {
        // Anonimiza o telefone conforme Art. 6º da LGPD
        a.clientPhone = a.clientPhone.slice(0, 5) + ' *****-' + a.clientPhone.slice(-4);
        a.isAnonymized = true;
        purgedCount++;
      }
    });

    if (purgedCount > 0) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
      this.logSecurityEvent({
        route: '/master',
        status: 'AUTORIZADO',
        notes: `LGPD: ${purgedCount} contatos de clientes antigos foram anonimizados conforme prazo de retenção de ${days} dias`
      });
    }

    return purgedCount;
  },

  // Auxiliar para testar alerta sonoro pelo painel
  testAudioChime() {
    AudioAlertEngine.playNotificationChime();
    AudioAlertEngine.triggerNativePush(
      '🔔 Teste de Notificação & Som',
      'O som e as notificações push estão funcionando perfeitamente no seu celular!'
    );
  },

  // ----------------------------------------------------
  // COMPRESSÃO DE IMAGEM DO CELULAR / GALERIA (ALTA NITIDEZ)
  // ----------------------------------------------------
  compressImageFile(file, maxWidth = 650, quality = 0.78) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Nenhum arquivo selecionado'));
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // ----------------------------------------------------
  // SINCRONIZAÇÃO EM TEMPO REAL ENTRE CELULAR E PC (CLOUD + LOCAL)
  // ----------------------------------------------------
  CLOUD_TOPIC: 'ep_nails_studio_sync_2026_paiva',
  _syncChannel: null,
  _sseSource: null,
  _processedSyncIds: new Set(),

  emitStoreUpdate(detail = {}) {
    try {
      window.dispatchEvent(new CustomEvent('epstore:updated', { detail }));
    } catch (e) {}
  },

  async publishCloudSync(action, payload) {
    const msgObj = {
      syncId: 'sync_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      action,
      payload,
      ts: Date.now()
    };
    this._processedSyncIds.add(msgObj.syncId);

    // 1. BroadcastChannel local (mesmo navegador / abas abertas)
    try {
      if (!this._syncChannel && 'BroadcastChannel' in window) {
        this._syncChannel = new BroadcastChannel('ep_nails_realtime_channel');
      }
      if (this._syncChannel) {
        this._syncChannel.postMessage(msgObj);
      }
    } catch (e) {}

    // 2. Nuvem (Sincroniza Celular <-> Computador / Tablet instantaneamente)
    try {
      const serialized = JSON.stringify(msgObj);
      if (serialized.length < 180000) {
        await fetch(`https://ntfy.sh/${this.CLOUD_TOPIC}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: serialized,
          cache: 'no-store'
        });
      }
    } catch (err) {
      console.warn('Aviso de sincronização em nuvem:', err);
    }

    this.emitStoreUpdate({ action, payload });
  },

  applyIncomingSyncEvent(msgObj, notifyIfNewBooking = false) {
    if (!msgObj || !msgObj.action) return false;
    if (msgObj.syncId && this._processedSyncIds.has(msgObj.syncId)) return false;
    if (msgObj.syncId) this._processedSyncIds.add(msgObj.syncId);

    let changed = false;
    const { action, payload } = msgObj;

    if (action === 'UPSERT_APPOINTMENT' && payload && payload.id) {
      const list = this.getAppointments();
      const idx = list.findIndex(a => a.id === payload.id);
      if (idx === -1) {
        list.unshift(payload);
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
        changed = true;
        if (notifyIfNewBooking) {
          try {
            AudioAlertEngine.triggerNativePush(
              '💅 Novo Agendamento Recebido!',
              `${payload.clientName} agendou ${payload.serviceName} para ${payload.date} às ${payload.time}`
            );
          } catch (e) {}
        }
      } else if (JSON.stringify(list[idx]) !== JSON.stringify(payload)) {
        list[idx] = { ...list[idx], ...payload };
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
        changed = true;
      }
    } else if (action === 'UPDATE_APPOINTMENT_STATUS' && payload && payload.id) {
      const list = this.getAppointments();
      const idx = list.findIndex(a => a.id === payload.id);
      if (idx >= 0 && list[idx].status !== payload.status) {
        list[idx].status = payload.status;
        list[idx].updatedAt = payload.updatedAt || new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
        changed = true;
      }
    } else if (action === 'DELETE_APPOINTMENT' && payload && payload.id) {
      const list = this.getAppointments();
      const filtered = list.filter(a => a.id !== payload.id);
      if (filtered.length !== list.length) {
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(filtered));
        changed = true;
      }
    } else if (action === 'UPSERT_SERVICE' && payload && payload.id) {
      const list = this.getServices(false);
      const idx = list.findIndex(s => s.id === payload.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...payload };
      } else {
        list.push(payload);
      }
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(list));
      changed = true;
    } else if (action === 'DELETE_SERVICE' && payload && payload.id) {
      const list = this.getServices(false).filter(s => s.id !== payload.id);
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(list));
      changed = true;
        } else if (action === 'UPSERT_CATEGORY' && payload && payload.id) {
      const list = this.getCategories();
      const idx = list.findIndex(c => c.id === payload.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...payload };
      } else {
        list.push(payload);
      }
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(list));
      changed = true;
    } else if (action === 'DELETE_CATEGORY' && payload && payload.id) {
      const list = this.getCategories().filter(c => c.id !== payload.id);
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(list));
      changed = true;
    } else if (action === 'UPDATE_THEME' && payload) {
      const current = this.getTheme();
      const updated = { ...current, ...payload };
      localStorage.setItem(STORAGE_KEYS.THEME_CONFIG, JSON.stringify(updated));
      this.applyThemeToDocument();
      changed = true;
    } else if (action === 'UPDATE_SETTINGS' && payload) {
      const current = this.getSalonSettings();
      const updated = { ...current, ...payload };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      changed = true;
    }

    if (changed) {
      this.emitStoreUpdate({ action, payload, fromRemote: true });
    }
    return changed;
  },

  async pullCloudEvents(notifyNew = false) {
    try {
      const resp = await fetch(`https://ntfy.sh/${this.CLOUD_TOPIC}/json?poll=1&since=48h&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!resp.ok) return false;
      const text = await resp.text();
      const lines = text.split('\n').filter(Boolean);
      let anyChanged = false;
      for (const line of lines) {
        try {
          const envelope = JSON.parse(line);
          if (envelope && envelope.event === 'message' && envelope.message) {
            const msgObj = JSON.parse(envelope.message);
            if (this.applyIncomingSyncEvent(msgObj, notifyNew)) {
              anyChanged = true;
            }
          }
        } catch (innerErr) {}
      }
      return anyChanged;
    } catch (e) {
      return false;
    }
  },

  startRealtimeSync() {
    if (this._realtimeStarted) return;
    this._realtimeStarted = true;

    // 1. Escuta mudanças entre abas no mesmo dispositivo
    window.addEventListener('storage', (ev) => {
      if (ev.key && Object.values(STORAGE_KEYS).includes(ev.key)) {
        this.emitStoreUpdate({ action: 'STORAGE_EVENT', key: ev.key });
      }
    });

    // 2. BroadcastChannel local
    try {
      if ('BroadcastChannel' in window) {
        this._syncChannel = new BroadcastChannel('ep_nails_realtime_channel');
        this._syncChannel.onmessage = (ev) => {
          if (ev.data) this.applyIncomingSyncEvent(ev.data, true);
        };
      }
    } catch (e) {}

    // 3. SSE em tempo real da nuvem (Celular <-> PC instantâneo)
    try {
      if ('EventSource' in window) {
        this._sseSource = new EventSource(`https://ntfy.sh/${this.CLOUD_TOPIC}/sse`);
        this._sseSource.onmessage = (ev) => {
          try {
            const envelope = JSON.parse(ev.data);
            if (envelope && envelope.message) {
              const msgObj = JSON.parse(envelope.message);
              this.applyIncomingSyncEvent(msgObj, true);
            }
          } catch (err) {}
        };
      }
    } catch (e) {}

    // 4. Polling de segurança a cada 6 segundos (caso a rede móvel bloqueie SSE)
    setInterval(() => {
      this.pullCloudEvents(true);
    }, 6000);
  },

  deleteAppointment(id) {
    let list = this.getAppointments();
    list = list.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
    this.publishCloudSync('DELETE_APPOINTMENT', { id });
    return list;
  },

  STORAGE_KEY: STORAGE_KEYS.APPOINTMENTS,

  getTodayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  formatDateLabel(dateStr) {
    if (!dateStr) return 'Hoje';
    const today = this.getTodayISO();
    if (dateStr === today) return 'Hoje';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  },

  getClients() {
    const apps = this.getAppointments() || [];
    const map = new Map();
    apps.forEach(a => {
      const key = a.clientPhone || a.clientName || a.id;
      if (!map.has(key)) {
        map.set(key, {
          name: a.clientName,
          phone: a.clientPhone,
          lastDate: a.date,
          service: a.serviceName
        });
      }
    });
    return Array.from(map.values());
  },

  addAppointment(data) {
    return this.createAppointment({
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      servicePrice: data.servicePrice || data.price || 150,
      date: data.date || this.getTodayISO(),
      time: data.time || '14:00',
      status: data.status || 'Confirmado'
    });
  },

  updateSalonSettings(newSettings) {
    return this.saveSalonSettings(newSettings);
  },

  async rotateTokens() {
    const adm = await this.rotateAdminToken();
    const mst = await this.rotateMasterToken();
    return { adm, mst };
  },

  getAnalytics() {
    const logs = this.getSecurityLogs().map(l => ({
      event: `${l.route || '/sistema'} • ${l.status || 'OK'} (${l.notes || l.device || ''})`,
      ts: l.timestamp || new Date().toISOString()
    }));
    return {
      ...this.getTrafficAnalytics(),
      securityLogs: logs
    };
  },

  saveState(parsedObj) {
    if (!parsedObj) return;
    if (Array.isArray(parsedObj)) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(parsedObj));
    } else {
      if (parsedObj.appointments) localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(parsedObj.appointments));
      if (parsedObj.services) localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(parsedObj.services));
      if (parsedObj.categories) localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(parsedObj.categories));
      if (parsedObj.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsedObj.settings));
    }
    this.emitStoreUpdate({ action: 'RESTORE_BACKUP' });
  },

  resetToDefault() {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(SEED_DATA.initialAppointments));
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(SEED_DATA.services));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(SEED_DATA.categories));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SEED_DATA.salonSettings));
    localStorage.setItem(STORAGE_KEYS.THEME_CONFIG, JSON.stringify(SEED_DATA.theme));
    this.applyThemeToDocument();
    this.emitStoreUpdate({ action: 'RESET_FACTORY' });
  }
};

// Inicialização automática
window.EPStore.init();
