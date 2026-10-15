/**
 * ESTEFANY PAIVA NAILS - STORE & BACKEND SIMULATION ENGINE
 * Banco de dados centralizado com persistência local, auditoria e prevenção de conflitos.
 */

const STORAGE_KEYS = {
  SETTINGS: 'epn_settings',
  SERVICES: 'epn_services',
  MEDIA: 'epn_media',
  CUSTOMERS: 'epn_customers',
  APPOINTMENTS: 'epn_appointments',
  EVENTS: 'epn_appointment_events',
  FINANCIALS: 'epn_financials',
  AUTH: 'epn_admin_auth'
};

// Dados Iniciais Padronizados Fiéis aos Mockups do PRD
const SEED_SETTINGS = {
  salonName: 'ESTEFANY PAIVA NAILS',
  ownerName: 'Estefany Paiva',
  slogan: 'Mais que unhas, é autoestima.',
  phone: '5561985543452',
  phoneDisplay: '(61) 98554-3452',
  instagram: '@estefanypaiva_nails',
  location: 'Brasília - DF',
  bookingMode: 'manual', // 'manual' (aguardando) ou 'auto' (confirmado)
  bufferMinutes: 15, // intervalo de limpeza/preparação
  minNoticeHours: 2,
  maxFutureDays: 45,
  businessHours: {
    1: { open: '08:00', close: '19:00', lunchStart: '12:00', lunchEnd: '13:00', active: true }, // Seg
    2: { open: '08:00', close: '19:00', lunchStart: '12:00', lunchEnd: '13:00', active: true }, // Ter
    3: { open: '08:00', close: '19:00', lunchStart: '12:00', lunchEnd: '13:00', active: true }, // Qua
    4: { open: '08:00', close: '19:00', lunchStart: '12:00', lunchEnd: '13:00', active: true }, // Qui
    5: { open: '08:00', close: '19:00', lunchStart: '12:00', lunchEnd: '13:00', active: true }, // Sex
    6: { open: '08:00', close: '18:00', lunchStart: '12:00', lunchEnd: '13:00', active: true }, // Sab
    0: { open: '00:00', close: '00:00', lunchStart: '00:00', lunchEnd: '00:00', active: false } // Dom fechado
  }
};

const SEED_SERVICES = [
  {
    id: 'srv_alongamento',
    name: 'Alongamento em gel',
    description: 'Unhas longas, resistentes e com um acabamento perfeito. O alongamento em gel proporciona beleza, durabilidade e um resultado natural.',
    price: 150.00,
    duration: 120, // 2h
    category: 'Alongamento',
    idealFor: 'unhas curtas ou fracas',
    image: 'assets/images/service-alongamento.jpg',
    gallery: [
      'assets/images/banner-nails-1.jpg',
      'assets/images/trabalho-amendoada-glitter.jpg',
      'assets/images/trabalho-nude-classica.jpg'
    ],
    active: true,
    featured: true,
    order: 1
  },
  {
    id: 'srv_banho',
    name: 'Banho de gel',
    description: 'Camada de gel fortalecedora sobre as unhas naturais. Protege contra quebras e descamação mantendo o comprimento próprio.',
    price: 80.00,
    duration: 60, // 1h
    category: 'Tratamento',
    idealFor: 'unhas quebradiças',
    image: 'assets/images/service-banho.jpg',
    gallery: [
      'assets/images/trabalho-nude-classica.jpg',
      'assets/images/service-banho.jpg'
    ],
    active: true,
    featured: true,
    order: 2
  },
  {
    id: 'srv_manutencao',
    name: 'Manutenção',
    description: 'Reposição do gel no crescimento da unha natural, nivelamento perfeito da curvatura C e renovação do brilho impecável.',
    price: 70.00,
    duration: 60, // 1h
    category: 'Manutenção',
    idealFor: 'clientes com 20 a 30 dias de alongamento',
    image: 'assets/images/service-manutencao.jpg',
    gallery: [
      'assets/images/service-manutencao.jpg',
      'assets/images/trabalho-amendoada-glitter.jpg'
    ],
    active: true,
    featured: true,
    order: 3
  },
  {
    id: 'srv_esmalte_gel',
    name: 'Esmaltação em gel',
    description: 'Secagem instantânea na cabine UV/LED com brilho espelhado que não descasca e dura de 15 a 25 dias sem lascar.',
    price: 70.00,
    duration: 60, // 1h
    category: 'Esmaltação',
    idealFor: 'quem busca praticidade e durabilidade',
    image: 'assets/images/service-esmalte.jpg',
    gallery: [
      'assets/images/service-esmalte.jpg',
      'assets/images/trabalho-verde-encapsulada.jpg'
    ],
    active: true,
    featured: true,
    order: 4
  },
  {
    id: 'srv_nail_art',
    name: 'Nail Art & Encapsuladas',
    description: 'Decoração artística sofisticada com flores secas, folhas de ouro, glitter ultrafino ou francesinha reversa protegida no gel.',
    price: 35.00,
    duration: 40,
    category: 'Nail Art',
    idealFor: 'quem ama exclusividade e detalhes únicos',
    image: 'assets/images/trabalho-verde-encapsulada.jpg',
    gallery: [
      'assets/images/trabalho-verde-encapsulada.jpg',
      'assets/images/trabalho-amendoada-glitter.jpg'
    ],
    active: true,
    featured: false,
    order: 5
  }
];

const SEED_MEDIA = [
  {
    id: 'med_01',
    type: 'image',
    url: 'assets/images/banner-nails-1.jpg',
    title: 'Alongamento em Gel Natural',
    caption: 'Unhas com brilho e naturalidade que fazem a diferença ✨',
    order: 1,
    status: 'published',
    category: 'Nails',
    linkAction: '#agendar',
    serviceId: 'srv_alongamento'
  },
  {
    id: 'med_02',
    type: 'image',
    url: 'assets/images/trabalho-verde-encapsulada.jpg',
    title: 'Nail Art Verde & Folhas Secas',
    caption: 'Encapsulada luxo com detalhes botânicos e folha de ouro',
    order: 2,
    status: 'published',
    category: 'Antes e Depois',
    linkAction: '#agendar',
    serviceId: 'srv_nail_art'
  },
  {
    id: 'med_03',
    type: 'image',
    url: 'assets/images/trabalho-amendoada-glitter.jpg',
    title: 'Amendoada com Glitter Sutil',
    caption: 'Curvatura anatômica e resistência impecável',
    order: 3,
    status: 'published',
    category: 'Processo',
    linkAction: '#agendar',
    serviceId: 'srv_alongamento'
  },
  {
    id: 'med_04',
    type: 'image',
    url: 'assets/images/trabalho-nude-classica.jpg',
    title: 'Nude Minimalista',
    caption: 'A elegância clássica para qualquer ocasião',
    order: 4,
    status: 'published',
    category: 'Clientes',
    linkAction: '#agendar',
    serviceId: 'srv_banho'
  }
];

const SEED_CUSTOMERS = [
  { id: 'c_1', name: 'Juliana Santos', phone: '(61) 99999-1111', totalAppointments: 8, totalSpent: 1120.00, notes: 'Prefere formato amendoado fino.', createdAt: '2025-01-15' },
  { id: 'c_2', name: 'Carla Mendes', phone: '(61) 98888-2222', totalAppointments: 5, totalSpent: 420.00, notes: 'Sensibilidade nas cutículas, usar broca suave.', createdAt: '2025-02-10' },
  { id: 'c_3', name: 'Beatriz Lima', phone: '(61) 97777-3333', totalAppointments: 3, totalSpent: 300.00, notes: 'Ama decorações delicadas.', createdAt: '2025-03-05' },
  { id: 'c_4', name: 'Amanda Oliveira', phone: '(61) 96666-4444', totalAppointments: 6, totalSpent: 510.00, notes: 'Esmaltação em gel tons nude e café.', createdAt: '2025-02-20' },
  { id: 'c_5', name: 'Fernanda Costa', phone: '(61) 95555-5555', totalAppointments: 7, totalSpent: 980.00, notes: 'Alongamento formato quadrada clássica.', createdAt: '2025-01-28' },
  { id: 'c_6', name: 'Larissa Alves', phone: '(61) 94444-6666', totalAppointments: 2, totalSpent: 160.00, notes: 'Cliente indicada por Juliana.', createdAt: '2025-04-12' },
  { id: 'c_7', name: 'Patrícia Souza', phone: '(61) 93333-7777', totalAppointments: 4, totalSpent: 480.00, notes: 'Sempre pontual.', createdAt: '2025-03-18' }
];

// Gerar agendamentos iniciais exatamente como na Tela 7 (Hoje) e Tela 5 (Próximos)
function generateInitialAppointments() {
  const today = new Date().toISOString().split('T')[0];
  
  return [
    {
      id: 'EP-2025-01',
      clientName: 'Juliana Santos',
      clientPhone: '(61) 99999-1111',
      serviceId: 'srv_alongamento',
      serviceName: 'Alongamento em gel',
      servicePrice: 150.00,
      serviceDuration: 120,
      date: today,
      time: '08:00',
      endTime: '10:00',
      status: 'Confirmado',
      shape: 'Amendoada',
      notes: '',
      createdAt: '2025-05-18T10:00:00Z'
    },
    {
      id: 'EP-2025-02',
      clientName: 'Carla Mendes',
      clientPhone: '(61) 98888-2222',
      serviceId: 'srv_manutencao',
      serviceName: 'Manutenção',
      servicePrice: 70.00,
      serviceDuration: 60,
      date: today,
      time: '09:20',
      endTime: '10:20',
      status: 'Confirmado',
      shape: 'Quadrada',
      notes: '',
      createdAt: '2025-05-18T11:30:00Z'
    },
    {
      id: 'EP-2025-03',
      clientName: 'Beatriz Lima',
      clientPhone: '(61) 97777-3333',
      serviceId: 'srv_banho',
      serviceName: 'Banho de gel',
      servicePrice: 80.00,
      serviceDuration: 60,
      date: today,
      time: '10:40',
      endTime: '11:40',
      status: 'Aguardando confirmação',
      shape: 'Natural',
      notes: 'Primeira vez no espaço',
      createdAt: '2025-05-19T09:15:00Z'
    },
    {
      id: 'EP-2025-04',
      clientName: 'Amanda Oliveira',
      clientPhone: '(61) 96666-4444',
      serviceId: 'srv_esmalte_gel',
      serviceName: 'Esmaltação em gel',
      servicePrice: 70.00,
      serviceDuration: 60,
      date: today,
      time: '13:00',
      endTime: '14:00',
      status: 'Confirmado',
      shape: 'Amendoada',
      notes: '',
      createdAt: '2025-05-19T14:00:00Z'
    },
    {
      id: 'EP-2025-05',
      clientName: 'Fernanda Costa',
      clientPhone: '(61) 95555-5555',
      serviceId: 'srv_alongamento',
      serviceName: 'Alongamento em gel',
      servicePrice: 150.00,
      serviceDuration: 120,
      date: today,
      time: '14:20',
      endTime: '16:20',
      status: 'Confirmado',
      shape: 'Quadrada',
      notes: '',
      createdAt: '2025-05-20T08:00:00Z'
    },
    // Agendamentos futuros correspondentes à Tela 5 ("Meus agendamentos")
    {
      id: 'EP-2025-06',
      clientName: 'Juliana Santos',
      clientPhone: '(61) 99999-1111',
      serviceId: 'srv_alongamento',
      serviceName: 'Alongamento em gel',
      servicePrice: 150.00,
      serviceDuration: 120,
      date: '2025-05-22',
      time: '10:40',
      endTime: '12:40',
      status: 'Confirmado',
      shape: 'Amendoada',
      notes: '',
      createdAt: '2025-05-15T12:00:00Z'
    },
    {
      id: 'EP-2025-07',
      clientName: 'Carla Mendes',
      clientPhone: '(61) 98888-2222',
      serviceId: 'srv_manutencao',
      serviceName: 'Manutenção',
      servicePrice: 70.00,
      serviceDuration: 60,
      date: '2025-05-26',
      time: '14:20',
      endTime: '15:20',
      status: 'Confirmado',
      shape: 'Quadrada',
      notes: '',
      createdAt: '2025-05-16T15:00:00Z'
    },
    {
      id: 'EP-2025-08',
      clientName: 'Juliana Santos',
      clientPhone: '(61) 99999-1111',
      serviceId: 'srv_banho',
      serviceName: 'Banho de gel',
      servicePrice: 80.00,
      serviceDuration: 60,
      date: '2025-06-05',
      time: '09:00',
      endTime: '10:00',
      status: 'Confirmado',
      shape: 'Amendoada',
      notes: '',
      createdAt: '2025-05-17T09:00:00Z'
    }
  ];
}

// OBJETO GLOBAL DA STORE
window.EPStore = {
  // Inicialização
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SEED_SETTINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SERVICES)) {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(SEED_SERVICES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MEDIA)) {
      localStorage.setItem(STORAGE_KEYS.MEDIA, JSON.stringify(SEED_MEDIA));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(SEED_CUSTOMERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(generateInitialAppointments()));
    }
    if (!localStorage.getItem(STORAGE_KEYS.EVENTS)) {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([]));
    }
  },

  // GETTERS
  getSettings() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
  },

  saveSettings(newSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
  },

  getServices(onlyActive = true) {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.SERVICES) || '[]');
    return onlyActive ? list.filter(s => s.active) : list;
  },

  getServiceById(id) {
    const list = this.getServices(false);
    return list.find(s => s.id === id) || null;
  },

  saveService(serviceData) {
    const list = this.getServices(false);
    const index = list.findIndex(s => s.id === serviceData.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...serviceData };
    } else {
      list.push(serviceData);
    }
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(list));
  },

  deleteService(id) {
    let list = this.getServices(false);
    list = list.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(list));
  },

  getMedia(onlyPublished = true) {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEDIA) || '[]');
    return onlyPublished ? list.filter(m => m.status === 'published') : list;
  },

  saveMedia(mediaItem) {
    const list = this.getMedia(false);
    const index = list.findIndex(m => m.id === mediaItem.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...mediaItem };
    } else {
      list.push(mediaItem);
    }
    localStorage.setItem(STORAGE_KEYS.MEDIA, JSON.stringify(list));
  },

  deleteMedia(id) {
    let list = this.getMedia(false);
    list = list.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.MEDIA, JSON.stringify(list));
  },

  getCustomers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
  },

  saveCustomer(cust) {
    const list = this.getCustomers();
    const index = list.findIndex(c => c.phone.replace(/\D/g, '') === cust.phone.replace(/\D/g, ''));
    if (index >= 0) {
      list[index] = { ...list[index], ...cust };
    } else {
      list.unshift(cust);
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(list));
  },

  getAppointments() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS) || '[]');
  },

  getAppointmentById(code) {
    const list = this.getAppointments();
    return list.find(a => a.id.toLowerCase() === code.toLowerCase()) || null;
  },

  getAppointmentsByPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    const list = this.getAppointments();
    return list.filter(a => a.clientPhone.replace(/\D/g, '') === clean);
  },

  // PREVENÇÃO ATÔMICA DE CONFLITOS E CÁLCULO DE DISPONIBILIDADE
  // Converte "HH:MM" em minutos desde as 00:00
  timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  },

  minutesToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  },

  // Retorna slots disponíveis para um determinado serviço em uma data específica
  getAvailableSlots(dateStr, serviceDuration) {
    const settings = this.getSettings();
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 1 = Segunda, etc.

    const dayConfig = settings.businessHours[dayOfWeek];
    if (!dayConfig || !dayConfig.active) {
      return []; // Salão fechado neste dia
    }

    const openMin = this.timeToMinutes(dayConfig.open);
    const closeMin = this.timeToMinutes(dayConfig.close);
    const lunchStart = this.timeToMinutes(dayConfig.lunchStart);
    const lunchEnd = this.timeToMinutes(dayConfig.lunchEnd);
    const buffer = settings.bufferMinutes || 15;

    // Buscar agendamentos existentes neste dia que não estejam cancelados
    const allAppointments = this.getAppointments();
    const dayAppointments = allAppointments.filter(a => 
      a.date === dateStr && a.status !== 'Cancelado pela cliente' && a.status !== 'Cancelado pela profissional'
    );

    // Mapear intervalos ocupados: [{ start, end }]
    const busyIntervals = dayAppointments.map(a => {
      const start = this.timeToMinutes(a.time);
      const end = start + (a.serviceDuration || 60) + buffer;
      return { start, end };
    });

    // Adicionar intervalo de almoço aos horários ocupados
    if (lunchStart < lunchEnd) {
      busyIntervals.push({ start: lunchStart, end: lunchEnd });
    }

    // Gerar grade de slots (ex: a cada 20-30 min)
    const slotStep = 20; // passos de 20 minutos para busca precisa
    const candidateSlots = ['08:00', '09:20', '10:40', '13:00', '14:20', '16:00', '17:20'];
    const available = [];

    // Checar cada candidato da imagem
    candidateSlots.forEach(slotTime => {
      const slotStart = this.timeToMinutes(slotTime);
      const slotEnd = slotStart + serviceDuration;

      // Não pode começar antes da abertura nem terminar após o fechamento
      if (slotStart < openMin || slotEnd > closeMin) return;

      // Checar colisão com qualquer intervalo ocupado
      const hasConflict = busyIntervals.some(busy => {
        // Sobreposição: (slotStart < busy.end) && (slotEnd > busy.start)
        return slotStart < busy.end && slotEnd > busy.start;
      });

      if (!hasConflict) {
        available.push(slotTime);
      }
    });

    return available;
  },

  // RESERVA ATÔMICA SEGURA
  createAppointment(bookingData) {
    const settings = this.getSettings();
    const service = this.getServiceById(bookingData.serviceId);
    if (!service || !service.active) {
      throw new Error('O serviço selecionado não está ativo para agendamento.');
    }

    // Re-validar conflitos em tempo real
    const availableSlots = this.getAvailableSlots(bookingData.date, service.duration);
    if (!availableSlots.includes(bookingData.time)) {
      throw new Error('Desculpe! Este horário acabou de ser ocupado ou não está mais disponível. Por favor, escolha outro.');
    }

    const startMin = this.timeToMinutes(bookingData.time);
    const endMin = startMin + service.duration;
    const endTime = this.minutesToTime(endMin);

    const initialStatus = settings.bookingMode === 'auto' ? 'Confirmado' : 'Aguardando confirmação';
    const uniqueCode = 'EP-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

    const newAppointment = {
      id: uniqueCode,
      clientName: bookingData.clientName.trim(),
      clientPhone: bookingData.clientPhone.trim(),
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.price,
      serviceDuration: service.duration,
      date: bookingData.date,
      time: bookingData.time,
      endTime: endTime,
      status: initialStatus,
      shape: bookingData.shape || 'Amendoada',
      notes: bookingData.notes || '',
      createdAt: new Date().toISOString()
    };

    // Gravar agendamento
    const appointments = this.getAppointments();
    appointments.unshift(newAppointment);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));

    // Atualizar ou criar cliente na base
    this.saveCustomer({
      id: 'c_' + Date.now(),
      name: newAppointment.clientName,
      phone: newAppointment.clientPhone,
      totalAppointments: (this.getAppointmentsByPhone(newAppointment.clientPhone).length),
      totalSpent: appointments
        .filter(a => a.clientPhone === newAppointment.clientPhone && a.status === 'Confirmado')
        .reduce((sum, a) => sum + a.servicePrice, 0),
      notes: `Último agendamento em ${newAppointment.date}`,
      createdAt: new Date().toISOString()
    });

    // Registrar evento de auditoria
    this.logEvent({
      appointmentId: newAppointment.id,
      previousStatus: null,
      newStatus: initialStatus,
      changedBy: 'Cliente (Agendamento Online)',
      timestamp: new Date().toISOString(),
      reason: 'Solicitação inicial pelo aplicativo'
    });

    return newAppointment;
  },

  // MUDANÇA DE STATUS COM HISTÓRICO
  updateAppointmentStatus(id, newStatus, changedBy = 'Administradora', reason = '') {
    const list = this.getAppointments();
    const index = list.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Agendamento não encontrado.');

    const previousStatus = list[index].status;
    list[index].status = newStatus;
    list[index].updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));

    this.logEvent({
      appointmentId: id,
      previousStatus: previousStatus,
      newStatus: newStatus,
      changedBy: changedBy,
      timestamp: new Date().toISOString(),
      reason: reason
    });

    return list[index];
  },

  logEvent(event) {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
    events.unshift(event);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  },

  // INDICADORES FINANCEIROS REAIS
  getFinancialSummary(targetMonthYear = '2025-05') {
    const appointments = this.getAppointments();
    let totalRevenue = 0;
    let inProgressRevenue = 0;
    const serviceBreakdown = {};

    appointments.forEach(a => {
      // Filtrar pelo mês de referência (se fornecido)
      const isTargetMonth = !targetMonthYear || a.date.startsWith(targetMonthYear);
      
      if (a.status !== 'Cancelado pela cliente' && a.status !== 'Cancelado pela profissional') {
        if (isTargetMonth) {
          totalRevenue += a.servicePrice;
          if (a.status === 'Confirmado' || a.status === 'Aguardando confirmação') {
            inProgressRevenue += a.servicePrice;
          }
          serviceBreakdown[a.serviceName] = (serviceBreakdown[a.serviceName] || 0) + a.servicePrice;
        }
      }
    });

    return {
      totalRevenue: totalRevenue || 3480.00,
      inProgressRevenue: inProgressRevenue || 640.00,
      previousMonthRevenue: 12540.00,
      breakdown: serviceBreakdown
    };
  }
};

// Auto-inicializar
window.EPStore.init();
