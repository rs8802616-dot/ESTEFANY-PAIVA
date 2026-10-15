/**
 * ESTEFANY PAIVA NAILS - CLIENT APPLICATION LOGIC
 * Gerencia onboarding, carrossel de mídia, vitrine, catálogo, fluxo de agendamento e consulta.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Estado local do cliente
  const state = {
    currentScreen: 'home', // 'onboarding', 'home', 'details', 'booking', 'my-appointments'
    selectedService: null,
    bookingDate: null,
    bookingTime: null,
    bookingShape: 'Amendoada',
    currentCalendarMonth: new Date().getMonth(),
    currentCalendarYear: new Date().getFullYear(),
    bannerIndex: 0,
    bannerInterval: null
  };

  // 1. ONBOARDING (TELA 1)
  const screenOnboarding = document.getElementById('screenOnboarding');
  const btnStartBooking = document.getElementById('btnStartBooking');
  const btnHaveBooking = document.getElementById('btnHaveBooking');

  // Mostrar onboarding se for a primeira visita nesta sessão
  if (screenOnboarding) {
    if (!sessionStorage.getItem('epn_onboarding_seen')) {
      screenOnboarding.classList.remove('hidden');
    } else {
      screenOnboarding.classList.add('hidden');
    }

    if (btnStartBooking) {
      btnStartBooking.addEventListener('click', () => {
        sessionStorage.setItem('epn_onboarding_seen', 'true');
        screenOnboarding.classList.add('hidden');
        navigateTo('booking');
      });
    }

    if (btnHaveBooking) {
      btnHaveBooking.addEventListener('click', () => {
        sessionStorage.setItem('epn_onboarding_seen', 'true');
        screenOnboarding.classList.add('hidden');
        navigateTo('my-appointments');
      });
    }
  }

  // 2. NAVEGAÇÃO ENTRE TELAS (ROUTER SPA)
  window.navigateTo = function(screenName, payload = null) {
    state.currentScreen = screenName;

    // Ocultar todas as telas principais
    const screens = {
      'home': document.getElementById('screenHome'),
      'details': document.getElementById('screenServiceDetails'),
      'booking': document.getElementById('screenBookingFlow'),
      'my-appointments': document.getElementById('screenMyAppointments')
    };

    Object.values(screens).forEach(s => {
      if (s) {
        s.style.display = 'none';
        s.classList.remove('active');
      }
    });

    // Atualizar abas inferiores ativas
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-target') === screenName) {
        btn.classList.add('active');
      }
    });

    if (screenName === 'home') {
      if (screens.home) screens.home.style.display = 'block';
      renderServicesCatalog();
    } else if (screenName === 'details' && payload) {
      if (screens.details) {
        screens.details.style.display = 'flex';
        screens.details.classList.add('active');
        renderServiceDetails(payload);
      }
    } else if (screenName === 'booking') {
      if (screens.booking) {
        screens.booking.style.display = 'flex';
        screens.booking.classList.add('active');
        initBookingFlow(payload);
      }
    } else if (screenName === 'my-appointments') {
      if (screens.my-appointments) {
        screens['my-appointments'].style.display = 'flex';
        screens['my-appointments'].classList.add('active');
        renderMyAppointments();
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Botões de navegação inferior (Bottom Bar)
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (target) navigateTo(target);
    });
  });

  // 3. CARROSSEL DINÂMICO DE VÍDEO & FOTOS (TELA 2)
  function initBannerCarousel() {
    const container = document.getElementById('carouselSlidesContainer');
    const dotsContainer = document.getElementById('carouselDotsContainer');
    const captionEl = document.getElementById('carouselCaptionText');
    if (!container || !dotsContainer) return;

    const mediaList = window.EPStore.getMedia(true);
    if (mediaList.length === 0) return;

    container.innerHTML = '';
    dotsContainer.innerHTML = '';

    mediaList.forEach((m, idx) => {
      const slide = document.createElement('div');
      slide.className = `carousel-media-slide ${idx === 0 ? 'active' : ''}`;
      slide.setAttribute('data-index', idx);

      if (m.type === 'video') {
        slide.innerHTML = `<video src="${m.url}" autoplay loop muted playsinline poster="${m.thumbnail || ''}"></video>`;
      } else {
        slide.innerHTML = `<img src="${m.url}" alt="${m.title || 'Unhas Estefany Paiva'}">`;
      }
      container.appendChild(slide);

      const dot = document.createElement('span');
      dot.className = `dot-indicator ${idx === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => setBannerSlide(idx));
      dotsContainer.appendChild(dot);
    });

    if (captionEl) captionEl.textContent = mediaList[0].caption || 'Mais que unhas, é autoestima.';

    // Auto-advance a cada 5 segundos
    clearInterval(state.bannerInterval);
    state.bannerInterval = setInterval(() => {
      const next = (state.bannerIndex + 1) % mediaList.length;
      setBannerSlide(next);
    }, 5000);
  }

  function setBannerSlide(index) {
    const slides = document.querySelectorAll('.carousel-media-slide');
    const dots = document.querySelectorAll('.dot-indicator');
    const captionEl = document.getElementById('carouselCaptionText');
    const mediaList = window.EPStore.getMedia(true);

    if (slides.length === 0) return;
    state.bannerIndex = index;

    slides.forEach((s, idx) => {
      s.classList.toggle('active', idx === index);
    });
    dots.forEach((d, idx) => {
      d.classList.toggle('active', idx === index);
    });

    if (captionEl && mediaList[index]) {
      captionEl.textContent = mediaList[index].caption || '';
    }
  }

  // 4. ATALHOS / STORIES
  const storyViewerModal = document.getElementById('storyViewerModal');
  const storyModalImg = document.getElementById('storyModalImg');
  const storyCloseBtn = document.getElementById('storyCloseBtn');

  document.querySelectorAll('.story-circle-item').forEach(story => {
    story.addEventListener('click', () => {
      const category = story.getAttribute('data-category');
      const mediaList = window.EPStore.getMedia(false);
      const match = mediaList.find(m => m.category === category) || mediaList[0];
      
      if (match && storyViewerModal && storyModalImg) {
        storyModalImg.src = match.url;
        storyViewerModal.classList.add('active');
      }
    });
  });

  if (storyCloseBtn && storyViewerModal) {
    storyCloseBtn.addEventListener('click', () => {
      storyViewerModal.classList.remove('active');
    });
    storyViewerModal.addEventListener('click', (e) => {
      if (e.target === storyViewerModal) storyViewerModal.classList.remove('active');
    });
  }

  // 5. VITRINE DE SERVIÇOS (TELA 2)
  function renderServicesCatalog() {
    const grid = document.getElementById('servicesCompactGrid');
    if (!grid) return;

    const services = window.EPStore.getServices(true);
    grid.innerHTML = '';

    services.forEach(srv => {
      const card = document.createElement('div');
      card.className = 'service-card-compact';
      card.innerHTML = `
        <div class="thumb">
          <img src="${srv.image || 'assets/images/service-alongamento.jpg'}" alt="${srv.name}">
        </div>
        <div class="info">
          <h4>${srv.name}</h4>
          <span class="price">R$ ${srv.price.toFixed(2).replace('.', ',')}</span>
        </div>
        <button class="btn-card-heart" title="Favoritar">
          <i class="fa-regular fa-heart"></i>
        </button>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-heart')) {
          e.stopPropagation();
          const heartIcon = card.querySelector('.btn-card-heart i');
          heartIcon.classList.toggle('fa-regular');
          heartIcon.classList.toggle('fa-solid');
          card.querySelector('.btn-card-heart').classList.toggle('liked');
          return;
        }
        navigateTo('details', srv);
      });

      grid.appendChild(card);
    });
  }

  // 6. DETALHES DO SERVIÇO (TELA 3)
  function renderServiceDetails(service) {
    state.selectedService = service;
    const imgEl = document.getElementById('detailsMainImg');
    const titleEl = document.getElementById('detailsTitle');
    const priceEl = document.getElementById('detailsPrice');
    const descEl = document.getElementById('detailsDesc');
    const timeEl = document.getElementById('detailsTime');
    const idealEl = document.getElementById('detailsIdeal');
    const resultsGrid = document.getElementById('detailsResultsGrid');
    const btnBookThis = document.getElementById('btnBookThisService');

    if (imgEl) imgEl.src = service.image || 'assets/images/service-alongamento.jpg';
    if (titleEl) titleEl.textContent = service.name;
    if (priceEl) priceEl.textContent = `R$ ${service.price.toFixed(2).replace('.', ',')}`;
    if (descEl) descEl.textContent = service.description;
    if (timeEl) timeEl.textContent = `${Math.floor(service.duration / 60)}h ${service.duration % 60 ? (service.duration % 60) + 'min' : ''}`.trim();
    if (idealEl) idealEl.textContent = service.idealFor || 'todos os tipos de unhas';

    if (resultsGrid && service.gallery) {
      resultsGrid.innerHTML = '';
      service.gallery.forEach(imgUrl => {
        const thumb = document.createElement('img');
        thumb.src = imgUrl;
        thumb.alt = 'Resultado de unhas';
        thumb.addEventListener('click', () => {
          if (imgEl) imgEl.src = imgUrl;
        });
        resultsGrid.appendChild(thumb);
      });
    }

    if (btnBookThis) {
      btnBookThis.onclick = () => {
        navigateTo('booking', service);
      };
    }
  }

  // 7. FLUXO DE AGENDAMENTO (TELA 4)
  function initBookingFlow(preSelectedService = null) {
    const services = window.EPStore.getServices(true);
    state.selectedService = preSelectedService || services[0];

    renderBookingServiceSummary();
    renderBookingCalendar();
    
    // Configurar data inicial como hoje ou amanhã
    const todayStr = new Date().toISOString().split('T')[0];
    state.bookingDate = todayStr;
    renderAvailableTimeSlots(todayStr);

    // Botão Avançar / Concluir Agendamento
    const btnNext = document.getElementById('btnBookingNext');
    if (btnNext) {
      btnNext.onclick = handleBookingSubmit;
    }
  }

  function renderBookingServiceSummary() {
    const container = document.getElementById('bookingSelectedServiceCard');
    if (!container || !state.selectedService) return;

    const srv = state.selectedService;
    container.innerHTML = `
      <div class="thumb">
        <img src="${srv.image || 'assets/images/service-alongamento.jpg'}" alt="${srv.name}">
      </div>
      <div>
        <h4>${srv.name}</h4>
        <p>R$ ${srv.price.toFixed(2).replace('.', ',')} &bull; <i class="fa-regular fa-clock"></i> ${Math.floor(srv.duration / 60)}h</p>
      </div>
    `;
  }

  // Calendário Mensal Dinâmico
  function renderBookingCalendar() {
    const titleEl = document.getElementById('calendarMonthTitle');
    const gridEl = document.getElementById('calendarDaysGrid');
    const prevBtn = document.getElementById('calPrevMonth');
    const nextBtn = document.getElementById('calNextMonth');
    if (!gridEl || !titleEl) return;

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    titleEl.textContent = `${monthNames[state.currentCalendarMonth]} ${state.currentCalendarYear}`;

    gridEl.innerHTML = '';

    const firstDay = new Date(state.currentCalendarYear, state.currentCalendarMonth, 1).getDay();
    const daysInMonth = new Date(state.currentCalendarYear, state.currentCalendarMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Espaçamento inicial para alinhar com o dia da semana
    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement('div');
      gridEl.appendChild(blank);
    }

    // Dias do mês
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      cell.textContent = d;

      const cellDate = new Date(state.currentCalendarYear, state.currentCalendarMonth, d);
      const dateStr = `${state.currentCalendarYear}-${(state.currentCalendarMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

      // Regra do PRD: Datas passadas e domingos fechados não podem ser selecionadas
      const isPast = cellDate < today;
      const isSunday = cellDate.getDay() === 0;

      if (isPast || isSunday) {
        cell.classList.add('disabled');
      } else {
        if (state.bookingDate === dateStr) {
          cell.classList.add('selected');
        }

        cell.addEventListener('click', () => {
          document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
          cell.classList.add('selected');
          state.bookingDate = dateStr;
          renderAvailableTimeSlots(dateStr);
        });
      }

      gridEl.appendChild(cell);
    }

    if (prevBtn) {
      prevBtn.onclick = () => {
        state.currentCalendarMonth--;
        if (state.currentCalendarMonth < 0) {
          state.currentCalendarMonth = 11;
          state.currentCalendarYear--;
        }
        renderBookingCalendar();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        state.currentCalendarMonth++;
        if (state.currentCalendarMonth > 11) {
          state.currentCalendarMonth = 0;
          state.currentCalendarYear++;
        }
        renderBookingCalendar();
      };
    }
  }

  // Horários disponíveis calculados pelo Store
  function renderAvailableTimeSlots(dateStr) {
    const grid = document.getElementById('bookingTimeSlotsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const duration = state.selectedService ? state.selectedService.duration : 120;
    const availableSlots = window.EPStore.getAvailableSlots(dateStr, duration);

    if (availableSlots.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1; font-size:0.85rem; color:#777176; text-align:center;">Não há horários disponíveis para este dia.</p>`;
      state.bookingTime = null;
      return;
    }

    state.bookingTime = availableSlots[0];

    availableSlots.forEach((slot, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `time-slot-btn ${idx === 0 ? 'selected' : ''}`;
      btn.textContent = slot;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.bookingTime = slot;
      });

      grid.appendChild(btn);
    });
  }

  // Submissão do agendamento
  function handleBookingSubmit() {
    const nameInput = document.getElementById('bookingClientName');
    const phoneInput = document.getElementById('bookingClientPhone');
    const notesInput = document.getElementById('bookingClientNotes');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!name) {
      alert('Por favor, informe seu nome completo.');
      if (nameInput) nameInput.focus();
      return;
    }

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      alert('Por favor, informe um WhatsApp válido com DDD.');
      if (phoneInput) phoneInput.focus();
      return;
    }

    if (!state.bookingDate || !state.bookingTime) {
      alert('Por favor, escolha um dia e horário disponível.');
      return;
    }

    try {
      // Gravação atômica segura no store
      const appointment = window.EPStore.createAppointment({
        serviceId: state.selectedService.id,
        date: state.bookingDate,
        time: state.bookingTime,
        clientName: name,
        clientPhone: phone,
        notes: notes,
        shape: state.bookingShape
      });

      // Salvar telefone no localStorage para consulta rápida de "Meus Agendamentos"
      localStorage.setItem('epn_last_client_phone', phone);

      // Exibir modal ou tela de confirmação
      alert(`✨ Agendamento Realizado com Sucesso!\n\nCódigo: ${appointment.id}\nServiço: ${appointment.serviceName}\nData: ${appointment.date} às ${appointment.time}h\nStatus: ${appointment.status}`);

      // Redirecionar para "Meus agendamentos"
      navigateTo('my-appointments');
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  // 8. MEUS AGENDAMENTOS (TELA 5)
  function renderMyAppointments(filterTab = 'proximos') {
    const listContainer = document.getElementById('myAppointmentsCardsList');
    const tabProximos = document.getElementById('tabProximos');
    const tabHistorico = document.getElementById('tabHistorico');
    if (!listContainer) return;

    if (tabProximos && tabHistorico) {
      tabProximos.onclick = () => {
        tabProximos.classList.add('active');
        tabHistorico.classList.remove('active');
        renderMyAppointments('proximos');
      };
      tabHistorico.onclick = () => {
        tabHistorico.classList.add('active');
        tabProximos.classList.remove('active');
        renderMyAppointments('historico');
      };
    }

    const savedPhone = localStorage.getItem('epn_last_client_phone') || '(61) 99999-1111';
    const appointments = window.EPStore.getAppointmentsByPhone(savedPhone);
    const today = new Date().toISOString().split('T')[0];

    listContainer.innerHTML = '';

    const filtered = appointments.filter(a => {
      if (filterTab === 'proximos') {
        return a.date >= today && a.status !== 'Concluído' && a.status !== 'Cancelado pela cliente' && a.status !== 'Cancelado pela profissional';
      } else {
        return a.date < today || a.status === 'Concluído' || a.status.includes('Cancelado');
      }
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem; color:#777176;">
          <i class="fa-regular fa-calendar-xmark" style="font-size:2.5rem; margin-bottom:1rem; color:#E9A3B5;"></i>
          <h4>Nenhum agendamento encontrado</h4>
          <p style="font-size:0.85rem; margin-top:4px;">Nenhum atendimento na aba ${filterTab}.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'appointment-card-item';

      let statusClass = 'aguardando';
      if (item.status === 'Confirmado') statusClass = 'confirmado';
      if (item.status.includes('Cancelado')) statusClass = 'cancelado';

      card.innerHTML = `
        <div class="card-appointment-left">
          <div class="thumb">
            <img src="assets/images/service-alongamento.jpg" alt="${item.serviceName}">
          </div>
          <div class="meta">
            <p>${formatDateDisplay(item.date)} &bull; ${item.time}h</p>
            <h4>${item.serviceName}</h4>
            <span class="badge-status ${statusClass}">${item.status}</span>
          </div>
        </div>
        <i class="fa-solid fa-chevron-right" style="color:#777176; font-size:0.85rem;"></i>
      `;

      card.addEventListener('click', () => {
        showAppointmentDetailsModal(item);
      });

      listContainer.appendChild(card);
    });
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${parts[2]} de ${months[parseInt(parts[1]) - 1]}`;
  }

  function showAppointmentDetailsModal(item) {
    const text = `📋 Detalhes do Agendamento:\n\nCódigo: ${item.id}\nServiço: ${item.serviceName}\nValor: R$ ${item.servicePrice.toFixed(2).replace('.', ',')}\nData: ${item.date} às ${item.time}h\nStatus: ${item.status}\n\nDeseja falar no WhatsApp sobre esse horário?`;
    if (confirm(text)) {
      const msg = `Olá, Estefany! Gostaria de falar sobre o meu agendamento *${item.id}* de *${item.serviceName}* no dia ${item.date} às ${item.time}h 💕`;
      window.open(`https://wa.me/5561985543452?text=${encodeURIComponent(msg)}`, '_blank');
    }
  }

  // Máscara de Telefone WhatsApp
  const phoneInp = document.getElementById('bookingClientPhone');
  if (phoneInp) {
    phoneInp.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 6) {
        v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      }
      e.target.value = v;
    });
  }

  // Inicializar componentes da Home
  initBannerCarousel();
  renderServicesCatalog();
});
