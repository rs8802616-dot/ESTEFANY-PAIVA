/**
 * =====================================================================
 * ESTEFANY PAIVA NAILS - CLIENT ENGINE
 * STORIES DO INSTAGRAM (3 VÍDEOS), PORTFÓLIO VIVO & AGENDAMENTO ENXUTO LGPD
 * =====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Registra visita para métricas de picos de acesso e funil
  if (window.EPStore && window.EPStore.recordPageVisit) {
    window.EPStore.recordPageVisit();
  }

  // Estado interno do cliente
  const state = {
    selectedCategory: 'all',
    selectedService: null,
    bookingDate: new Date().toISOString().split('T')[0],
    bookingTime: null,
    currentCalMonth: new Date().getMonth(),
    currentCalYear: new Date().getFullYear(),
    lastCreatedAppointment: null,

    // Estado do Player de Stories (Instagram Style)
    storyService: null,
    storyIndex: 0,
    storyTimer: null,
    storyProgressInterval: null,
    storyProgressPct: 0,
    isStoryPaused: false,
    storyDurationMs: 5000 // 5 segundos por slide/vídeo
  };

  // ----------------------------------------------------
  // 1. CARROSSEL SUPERIOR (PORTFÓLIO VIVO)
  // ----------------------------------------------------
  function renderPortfolioVivo() {
    const track = document.getElementById('carouselVivoTrack');
    if (!track) return;

    const items = window.EPStore.getCarouselItems().filter(i => i.active !== false);
    track.innerHTML = '';

    if (items.length === 0) {
      track.innerHTML = '<p style="padding:1rem; color:#777176;">Portfólio em atualização.</p>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card-vivo-item';
      card.innerHTML = `
        <div class="card-vivo-image-wrap">
          <img src="${item.image}" alt="${item.technique}">
          <span class="card-vivo-tag">${item.tag || item.category}</span>
        </div>
        <div class="card-vivo-info">
          <div>
            <h3>${item.technique}</h3>
            <p>${item.category}</p>
          </div>
          <button class="btn-card-vivo-book" data-service-id="${item.serviceId || 'srv_alongamento'}">
            <i class="fa-regular fa-calendar-check"></i>
            <span>Agendar este estilo</span>
          </button>
        </div>
      `;

      const btnBook = card.querySelector('.btn-card-vivo-book');
      btnBook.addEventListener('click', (e) => {
        e.stopPropagation();
        const srvId = btnBook.getAttribute('data-service-id');
        selectServiceAndOpenBooking(srvId);
      });

      track.appendChild(card);
    });

    // Auto-scroll suave horizontal
    let scrollDirection = 1;
    setInterval(() => {
      if (!track.matches(':hover')) {
        track.scrollLeft += 1.5 * scrollDirection;
        if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 5) {
          scrollDirection = -1;
        } else if (track.scrollLeft <= 0) {
          scrollDirection = 1;
        }
      }
    }, 40);
  }

  // ----------------------------------------------------
  // 2. CATEGORIAS & VITRINE DE SERVIÇOS
  // ----------------------------------------------------
  function renderCategoriesFilter() {
    const bar = document.getElementById('categoryFilterBar');
    if (!bar) return;

    const categories = window.EPStore.getCategories();
    bar.innerHTML = `
      <button class="category-pill-btn active" data-category="all">
        <i class="fa-solid fa-sparkles"></i>
        <span>Todos os Procedimentos</span>
      </button>
    `;

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-pill-btn';
      btn.setAttribute('data-category', cat.id);
      btn.innerHTML = `
        <i class="fa-solid ${cat.icon || 'fa-gem'}"></i>
        <span>${cat.name}</span>
      `;
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.category-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedCategory = cat.id;
        renderServicesGrid();
      });
      bar.appendChild(btn);
    });

    const allBtn = bar.querySelector('[data-category="all"]');
    allBtn.addEventListener('click', () => {
      bar.querySelectorAll('.category-pill-btn').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
      state.selectedCategory = 'all';
      renderServicesGrid();
    });
  }

  function renderServicesGrid() {
    const grid = document.getElementById('servicesCatalogGrid');
    if (!grid) return;

    let services = window.EPStore.getServices(true);
    if (state.selectedCategory !== 'all') {
      services = services.filter(s => s.categoryId === state.selectedCategory);
    }

    grid.innerHTML = '';

    if (services.length === 0) {
      grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:2rem; color:#777176;">Nenhum serviço disponível nesta categoria.</p>';
      return;
    }

    const categories = window.EPStore.getCategories();

    services.forEach(srv => {
      const cat = categories.find(c => c.id === srv.categoryId);
      const catName = cat ? cat.name : 'Nail Design';

      const card = document.createElement('div');
      card.className = 'service-card-interactive';
      card.innerHTML = `
        <div>
          <div class="service-card-header">
            <!-- Thumbnail com anel de Stories do Instagram -->
            <div class="service-story-trigger" title="Ver Stories deste trabalho em vídeo" data-service-id="${srv.id}">
              <div class="service-story-trigger-inner">
                <img src="${srv.image || 'assets/images/service-alongamento.jpg'}" alt="${srv.name}">
              </div>
              <div class="story-play-pill-badge">
                <i class="fa-solid fa-play"></i>
              </div>
            </div>

            <div class="service-info-block">
              <span class="service-category-tag">${catName}</span>
              <h3>${srv.name}</h3>
              <p class="service-desc-text">${srv.description}</p>
            </div>
          </div>
        </div>

        <div class="service-card-footer">
          <div class="service-price-block">
            <span class="service-duration-lbl"><i class="fa-regular fa-clock"></i> ${Math.floor(srv.duration / 60)}h ${srv.duration % 60 ? (srv.duration % 60) + 'min' : ''}</span>
            <span class="service-price-val">R$ ${srv.price.toFixed(2).replace('.', ',')}</span>
          </div>

          <div class="service-actions-pair">
            <button class="btn-open-story-text" data-service-id="${srv.id}" title="Ver Stories">
              <i class="fa-solid fa-circle-play"></i>
              <span>Ver Stories</span>
            </button>
            <button class="btn-select-book-service" data-service-id="${srv.id}">
              <span>Agendar</span>
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      `;

      // Eventos de clique
      const storyTriggers = card.querySelectorAll('.service-story-trigger, .btn-open-story-text');
      storyTriggers.forEach(el => {
        el.addEventListener('click', () => {
          openInstagramStoriesModal(srv.id);
        });
      });

      const btnBook = card.querySelector('.btn-select-book-service');
      btnBook.addEventListener('click', () => {
        selectServiceAndOpenBooking(srv.id);
      });

      grid.appendChild(card);
    });
  }

  // ----------------------------------------------------
  // 3. MOTOR DOS STORIES ESTILO INSTAGRAM (3 VÍDEOS SEQUENCIAIS)
  // ----------------------------------------------------
  const storyModal = document.getElementById('storyInstagramModal');
  const storyBarsContainer = document.getElementById('storyProgressBarsContainer');
  const storyMediaDisplay = document.getElementById('storyMediaDisplay');
  const storyCaptionOverlay = document.getElementById('storyCaptionOverlay');
  const storyAuthorTitle = document.getElementById('storyAuthorTitle');
  const btnCloseStory = document.getElementById('btnCloseStory');
  const btnStoryScheduleNow = document.getElementById('btnStoryScheduleNow') || document.getElementById('btnStoryBookNow');
  const storyTapLeft = document.getElementById('storyTapLeft');
  const storyTapRight = document.getElementById('storyTapRight');

  function openInstagramStoriesModal(serviceId) {
    const service = window.EPStore.getServiceById(serviceId);
    if (!service) return;

    state.storyService = service;
    state.storyIndex = 0;
    state.isStoryPaused = false;

    // Registra métrica de visualização de Stories no funil de conversão
    if (window.EPStore.recordStoriesView) {
      window.EPStore.recordStoriesView();
    }

    if (storyAuthorTitle) {
      storyAuthorTitle.textContent = service.name;
    }

    if (storyModal) {
      storyModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    startStoryAtIndex(0);
  }

  function closeInstagramStoriesModal() {
    clearTimeout(state.storyTimer);
    clearInterval(state.storyProgressInterval);
    if (storyModal) {
      storyModal.classList.remove('active');
      document.body.style.overflow = '';
    }
    state.storyService = null;
  }

  window.openStoryForService = openInstagramStoriesModal;

  function startStoryAtIndex(index) {
    clearTimeout(state.storyTimer);
    clearInterval(state.storyProgressInterval);

    const service = state.storyService;
    if (!service) return;

    const stories = service.storiesVideos && service.storiesVideos.length > 0
      ? service.storiesVideos
      : [
          { title: 'Passo 1: Preparação', mediaUrl: service.image, caption: 'Unhas tratadas com produtos de alta aderência ✨', duration: 5 },
          { title: 'Passo 2: Curvatura C', mediaUrl: 'assets/images/trabalho-amendoada-glitter.jpg', caption: 'Estruturação fina, leve e resistente 💎', duration: 5 },
          { title: 'Passo 3: Finalização Luxo', mediaUrl: 'assets/images/banner-nails-1.jpg', caption: 'Resultado impecável que dura até 30 dias 💕', duration: 5 }
        ];

    if (index >= stories.length) {
      closeInstagramStoriesModal();
      return;
    }

    state.storyIndex = index;
    const currentStory = stories[index];
    const durationMs = (currentStory.duration || 5) * 1000;
    state.storyDurationMs = durationMs;
    state.storyProgressPct = 0;

    // Renderizar as 3 barras superiores
    renderProgressBars(stories.length, index);

    // Renderizar mídia (Vídeo ou Slide)
    renderStoryMedia(currentStory);

    // Iniciar animação contínua da barra de progresso
    const intervalStep = 50;
    const increment = (intervalStep / durationMs) * 100;

    state.storyProgressInterval = setInterval(() => {
      if (!state.isStoryPaused) {
        state.storyProgressPct += increment;
        const currentFill = document.getElementById(`storyFill_${state.storyIndex}`);
        if (currentFill) {
          currentFill.style.width = `${Math.min(state.storyProgressPct, 100)}%`;
        }

        if (state.storyProgressPct >= 100) {
          clearInterval(state.storyProgressInterval);
          startStoryAtIndex(state.storyIndex + 1);
        }
      }
    }, intervalStep);
  }

  function renderProgressBars(totalStories, currentIndex) {
    if (!storyBarsContainer) return;
    storyBarsContainer.innerHTML = '';

    for (let i = 0; i < totalStories; i++) {
      const slot = document.createElement('div');
      slot.className = 'story-progress-bar-slot';

      const fill = document.createElement('div');
      fill.className = 'story-progress-bar-fill';
      fill.id = `storyFill_${i}`;

      if (i < currentIndex) {
        fill.classList.add('done');
      } else if (i === currentIndex) {
        fill.style.width = '0%';
      }

      slot.appendChild(fill);
      storyBarsContainer.appendChild(slot);
    }
  }

  function renderStoryMedia(story) {
    if (!storyMediaDisplay) return;
    storyMediaDisplay.innerHTML = '';

    if (story.type === 'video' || (story.mediaUrl && story.mediaUrl.endsWith('.mp4'))) {
      const video = document.createElement('video');
      video.src = story.mediaUrl;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.loop = false;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      storyMediaDisplay.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = story.mediaUrl || 'assets/images/banner-nails-1.jpg';
      img.alt = story.title || 'Story de Unha';
      storyMediaDisplay.appendChild(img);
    }

    if (storyCaptionOverlay) {
      storyCaptionOverlay.textContent = story.caption || `${story.title} - Estefany Paiva Nails`;
    }
  }

  // Toques esquerda/direita e pausa ao segurar (Hold to Pause)
  if (storyTapLeft) {
    storyTapLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.storyIndex > 0) {
        startStoryAtIndex(state.storyIndex - 1);
      } else {
        startStoryAtIndex(0);
      }
    });
  }

  if (storyTapRight) {
    storyTapRight.addEventListener('click', (e) => {
      e.stopPropagation();
      startStoryAtIndex(state.storyIndex + 1);
    });
  }

  // Pausa ao segurar o dedo/mouse
  const phoneViewport = document.querySelector('.story-phone-viewport');
  if (phoneViewport) {
    const pauseStory = () => { state.isStoryPaused = true; };
    const resumeStory = () => { state.isStoryPaused = false; };

    phoneViewport.addEventListener('pointerdown', pauseStory);
    phoneViewport.addEventListener('pointerup', resumeStory);
    phoneViewport.addEventListener('pointerleave', resumeStory);
  }

  if (btnCloseStory) {
    btnCloseStory.addEventListener('click', closeInstagramStoriesModal);
  }

  if (btnStoryScheduleNow) {
    btnStoryScheduleNow.addEventListener('click', () => {
      if (state.storyService) {
        const srvId = state.storyService.id;
        closeInstagramStoriesModal();
        selectServiceAndOpenBooking(srvId);
      }
    });
  }

  // ----------------------------------------------------
  // 4. FLUXO DE AGENDAMENTO ENXUTO (LGPD)
  // ----------------------------------------------------
  function selectServiceAndOpenBooking(serviceId) {
    const srv = window.EPStore.getServiceById(serviceId);
    if (!srv) return;

    state.selectedService = srv;

    // Registra início de agendamento no funil
    if (window.EPStore.recordBookingStart) {
      window.EPStore.recordBookingStart();
    }

    // Atualiza o card de resumo do serviço
    const cardEl = document.getElementById('selectedServiceSummaryBooking');
    if (cardEl) {
      cardEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px;">
          <img src="${srv.image || 'assets/images/service-alongamento.jpg'}" style="width:54px; height:54px; border-radius:12px; object-fit:cover;" alt="${srv.name}">
          <div>
            <h4 style="font-size:1.05rem; font-weight:700; color:#171719;">${srv.name}</h4>
            <span style="font-size:0.85rem; color:#777176;"><i class="fa-regular fa-clock"></i> ${Math.floor(srv.duration / 60)}h ${srv.duration % 60 ? (srv.duration % 60) + 'min' : ''} &bull; <strong style="color:#C59B6D;">R$ ${srv.price.toFixed(2).replace('.', ',')}</strong></span>
          </div>
        </div>
      `;
    }

    renderBookingCalendar();
    renderBookingTimeSlots();

    // Rola suavemente até a seção de agendamento
    const bookingSec = document.getElementById('bookingSection');
    if (bookingSec) {
      bookingSec.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Calendário Mensal
  function renderBookingCalendar() {
    const titleEl = document.getElementById('calMonthYearTitle');
    const gridEl = document.getElementById('calGridCells');
    const prevBtn = document.getElementById('calPrevMonthBtn');
    const nextBtn = document.getElementById('calNextMonthBtn');
    if (!gridEl || !titleEl) return;

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    titleEl.textContent = `${monthNames[state.currentCalMonth]} ${state.currentCalYear}`;

    gridEl.innerHTML = '';

    const firstDay = new Date(state.currentCalYear, state.currentCalMonth, 1).getDay();
    const daysInMonth = new Date(state.currentCalYear, state.currentCalMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Células vazias de alinhamento
    for (let i = 0; i < firstDay; i++) {
      gridEl.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.textContent = d;

      const cellDate = new Date(state.currentCalYear, state.currentCalMonth, d);
      const dateStr = `${state.currentCalYear}-${(state.currentCalMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

      // Regras: passado e domingo bloqueados
      const isPast = cellDate < today;
      const isSunday = cellDate.getDay() === 0;

      if (isPast || isSunday) {
        cell.classList.add('disabled');
      } else {
        if (state.bookingDate === dateStr) {
          cell.classList.add('selected');
        }

        cell.addEventListener('click', () => {
          document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
          cell.classList.add('selected');
          state.bookingDate = dateStr;
          renderBookingTimeSlots();
        });
      }

      gridEl.appendChild(cell);
    }

    if (prevBtn) {
      prevBtn.onclick = () => {
        state.currentCalMonth--;
        if (state.currentCalMonth < 0) {
          state.currentCalMonth = 11;
          state.currentCalYear--;
        }
        renderBookingCalendar();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        state.currentCalMonth++;
        if (state.currentCalMonth > 11) {
          state.currentCalMonth = 0;
          state.currentCalYear++;
        }
        renderBookingCalendar();
      };
    }
  }

  // Horários disponíveis sem conflito
  function renderBookingTimeSlots() {
    const grid = document.getElementById('bookingTimeSlotsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const duration = state.selectedService ? state.selectedService.duration : 60;
    const available = window.EPStore.getAvailableSlots(state.bookingDate, duration);

    if (available.length === 0) {
      grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:10px; color:#777176; font-size:0.85rem;">Todos os horários ocupados para este dia.</p>';
      state.bookingTime = null;
      return;
    }

    state.bookingTime = available[0];

    available.forEach((slot, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `time-pill-btn ${idx === 0 ? 'selected' : ''}`;
      btn.textContent = slot;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.time-pill-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.bookingTime = slot;
      });

      grid.appendChild(btn);
    });
  }

  // Máscara de Celular LGPD: (DD) 9XXXX-XXXX
  const phoneInput = document.getElementById('clientPhoneInput');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
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

  // Submissão do Agendamento Enxuto (LGPD)
  const btnConfirmBooking = document.getElementById('btnConfirmBookingLgpd');
  if (btnConfirmBooking) {
    btnConfirmBooking.addEventListener('click', async () => {
      const nameInput = document.getElementById('clientNameInput');
      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';

      if (!state.selectedService) {
        alert('Por favor, selecione um serviço na vitrine acima.');
        return;
      }

      if (!name || name.length < 3) {
        alert('Por favor, preencha o seu Nome completo.');
        if (nameInput) nameInput.focus();
        return;
      }

      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        alert('Por favor, preencha um Celular/WhatsApp válido com DDD.');
        if (phoneInput) phoneInput.focus();
        return;
      }

      if (!state.bookingDate || !state.bookingTime) {
        alert('Por favor, escolha um dia e horário disponível.');
        return;
      }

      try {
        const appointment = await window.EPStore.createAppointment({
          serviceId: state.selectedService.id,
          date: state.bookingDate,
          time: state.bookingTime,
          clientName: name,
          clientPhone: phone
        });

        state.lastCreatedAppointment = appointment;
        showBookingSuccessModal(appointment);
      } catch (err) {
        alert('Erro ao agendar: ' + err.message);
      }
    });
  }

  // ----------------------------------------------------
  // 5. MODAL DE SUCESSO & INTEGRAÇÕES DE CALENDÁRIO
  // ----------------------------------------------------
  const successModal = document.getElementById('bookingSuccessModal');
  const successSummary = document.getElementById('successSummaryBox');
  const btnGoogleCal = document.getElementById('btnSuccessGoogleCalendar');
  const btnIcsCal = document.getElementById('btnSuccessIcsDownload');
  const btnWhatsAppSuccess = document.getElementById('btnSuccessWhatsApp');
  const btnCloseSuccess = document.getElementById('btnSuccessClose');

  function showBookingSuccessModal(app) {
    if (successSummary) {
      const [y, m, d] = app.date.split('-');
      const dateFormatted = `${d}/${m}/${y}`;
      successSummary.innerHTML = `
        <div><strong>Código:</strong> <span style="color:#D83F79; font-weight:700;">${app.id}</span></div>
        <div><strong>Cliente:</strong> ${app.clientName}</div>
        <div><strong>Serviço:</strong> ${app.serviceName}</div>
        <div><strong>Data & Horário:</strong> ${dateFormatted} às ${app.time}h</div>
        <div><strong>Valor:</strong> R$ ${app.servicePrice.toFixed(2).replace('.', ',')}</div>
      `;
    }

    if (btnGoogleCal) {
      btnGoogleCal.onclick = () => {
        const gUrl = window.EPStore.getGoogleCalendarUrl(app);
        window.open(gUrl, '_blank');
      };
    }

    if (btnIcsCal) {
      btnIcsCal.onclick = () => {
        window.EPStore.downloadIcsFile(app);
      };
    }

    if (btnWhatsAppSuccess) {
      btnWhatsAppSuccess.onclick = () => {
        const cleanSalonPhone = '5561985543452';
        const [y, m, d] = app.date.split('-');
        const msg = `Olá, Estefany! Acabei de realizar meu agendamento no site ✨%0A%0A` +
          `👤 *Nome:* ${encodeURIComponent(app.clientName)}%0A` +
          `💅 *Serviço:* ${encodeURIComponent(app.serviceName)}%0A` +
          `📅 *Data:* ${d}/${m}/${y} às ${app.time}h%0A` +
          `🔖 *Código:* ${app.id}%0A%0A` +
          `Aguardo sua confirmação! 💕`;
        window.open(`https://wa.me/${cleanSalonPhone}?text=${msg}`, '_blank');
      };
    }

    if (successModal) {
      successModal.classList.add('active');
    }
  }

  if (btnCloseSuccess && successModal) {
    btnCloseSuccess.onclick = () => {
      successModal.classList.remove('active');
      // Reseta formulário
      const nInp = document.getElementById('clientNameInput');
      const pInp = document.getElementById('clientPhoneInput');
      if (nInp) nInp.value = '';
      if (pInp) pInp.value = '';
      window.location.reload();
    };
  }

  // Inicializar componentes visuais
  renderPortfolioVivo();
  renderCategoriesFilter();
  renderServicesGrid();

  // Seleciona o primeiro serviço para agendamento inicial
  const firstSrv = window.EPStore.getServices(true)[0];
  if (firstSrv) {
    selectServiceAndOpenBooking(firstSrv.id);
  }
});
