/**
 * Controlador do Portal da Cliente — Estefany Paiva Nails (v34)
 */
import { db } from './db.js';
import {
  formatBRL,
  formatDateISO,
  formatDateBR,
  cleanPhoneDigits,
  maskPhoneBR,
  escapeHTML,
  buildWhatsAppUrl,
  buildGoogleCalendarUrl,
  downloadIcsFile,
  showToast
} from './utils.js';

const state = {
  settings: null,
  categories: [],
  services: [],
  activeCategory: 'all',
  selectedService: null,
  extraServiceIds: [],
  rescheduleId: null,
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDate: new Date(),
  selectedSlot: '',
  lastBooking: null
};

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('is-open');
  document.body.style.overflow = '';
}

function getBookingTotals() {
  const base = state.selectedService || state.services[0];
  if (!base) return { combinedName: 'Procedimento', totalPrice: 0, totalDuration: 90 };

  const names = [base.name];
  let totalPrice = Number(base.price) || 0;
  let totalDuration = parseInt(base.duration, 10) || 90;

  state.extraServiceIds.forEach(extraId => {
    if (extraId === base.id) return;
    const extra = state.services.find(s => s.id === extraId);
    if (extra) {
      names.push(extra.name);
      totalPrice += Number(extra.price) || 0;
      totalDuration += parseInt(extra.duration, 10) || 60;
    }
  });

  return { combinedName: names.join(' + '), totalPrice, totalDuration };
}

async function hydrateBranding() {
  const s = state.settings;
  document.getElementById('headerSalonName').textContent = s.salonName || 'Estefany Paiva';
  document.getElementById('headerSalonSub').textContent = s.salonSubtitle || 'NAIL DESIGNER';
  document.getElementById('salonBioText').textContent = s.bio || '';
  document.getElementById('salonAvatarImg').src = s.avatarImage || 'assets/images/trabalho-amendoada-ouro.png';
  document.getElementById('promoTitle').textContent = s.promoBannerTitle || 'Realce a beleza das suas mãos';
  document.getElementById('promoSubtitle').textContent = s.promoBannerSubtitle || '';
  document.getElementById('promoBannerImg').src = s.promoBannerImage || 'assets/images/trabalho-alongamento-chocolate.png';

  const savedName = localStorage.getItem('epn_last_client_name');
  if (savedName) {
    document.getElementById('clientGreeting').textContent = `Olá, ${savedName.split(' ')[0]}!`;
  }
}

function renderCategories() {
  const host = document.getElementById('categoryPills');
  const pills = [{ id: 'all', name: 'Todos' }, ...state.categories];
  host.innerHTML = pills
    .map(c => `<button type="button" class="pill-btn ${state.activeCategory === c.id ? 'is-active' : ''}" data-cat="${escapeHTML(c.id)}">${escapeHTML(c.name)}</button>`)
    .join('');

  host.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.cat;
      renderCategories();
      renderServices();
    });
  });
}

function renderServices() {
  const host = document.getElementById('servicesGrid');
  const filtered = state.activeCategory === 'all'
    ? state.services
    : state.services.filter(s => s.categoryId === state.activeCategory);

  if (filtered.length === 0) {
    host.innerHTML = '<div class="empty-state">Nenhum procedimento disponível nesta categoria.</div>';
    return;
  }

  host.innerHTML = filtered.map(s => `
    <article class="service-card" data-service-id="${escapeHTML(s.id)}">
      <div class="service-cover" data-book-id="${escapeHTML(s.id)}">
        <img src="${escapeHTML(s.image || 'assets/images/trabalho-alongamento-chocolate.png')}" alt="${escapeHTML(s.name)}" loading="lazy">
        <span class="service-duration-tag"><i class="fa-regular fa-clock"></i> ${parseInt(s.duration, 10) || 90} min</span>
      </div>
      <div class="service-body">
        <h4>${escapeHTML(s.name)}</h4>
        <p>${escapeHTML(s.description || 'Acabamento de alto padrão com produtos selecionados.')}</p>
        <div class="service-footer">
          <span class="service-price">${formatBRL(s.price)}</span>
          <button type="button" class="btn btn-dark btn-sm" data-book-id="${escapeHTML(s.id)}">Agendar</button>
        </div>
      </div>
    </article>
  `).join('');

  host.querySelectorAll('[data-book-id]').forEach(el => {
    el.addEventListener('click', () => {
      const srv = state.services.find(item => item.id === el.dataset.bookId);
      if (srv) startBookingFlow(srv);
    });
  });
}

async function renderNextBookingStrip() {
  const strip = document.getElementById('nextBookingStrip');
  const savedPhone = cleanPhoneDigits(localStorage.getItem('epn_last_client_phone') || '');
  if (savedPhone.length < 8) {
    strip.hidden = true;
    return;
  }

  const all = await db.getAppointments();
  const todayIso = formatDateISO(new Date());
  const mine = all.filter(a =>
    a.status !== 'Cancelado' &&
    a.status !== 'Concluído' &&
    a.date >= todayIso &&
    cleanPhoneDigits(a.clientPhone).includes(savedPhone)
  );

  if (mine.length === 0) {
    strip.hidden = true;
    return;
  }

  const next = mine[0];
  document.getElementById('nextBookingTitle').textContent = `Próximo horário: ${next.serviceName}`;
  document.getElementById('nextBookingMeta').textContent = `${formatDateBR(next.date)} às ${next.time} • ${next.status}`;
  strip.hidden = false;
}

function updateSummaryUI() {
  const totals = getBookingTotals();
  document.getElementById('summaryServiceName').textContent = totals.combinedName;
  document.getElementById('summaryServiceMeta').textContent = `${formatBRL(totals.totalPrice)} • ${totals.totalDuration} min`;

  const comboBtn = document.getElementById('btnToggleCombo');
  comboBtn.innerHTML = state.extraServiceIds.length > 0
    ? `<i class="fa-solid fa-layer-group"></i> Combo (+${state.extraServiceIds.length})`
    : `<i class="fa-solid fa-plus"></i> Combo`;
}

function renderComboList() {
  const listEl = document.getElementById('comboList');
  const others = state.services.filter(s => s.id !== state.selectedService?.id);
  if (others.length === 0) {
    listEl.innerHTML = '<div class="list-item-sub">Sem outros procedimentos disponíveis.</div>';
    return;
  }

  listEl.innerHTML = others.map(s => {
    const checked = state.extraServiceIds.includes(s.id);
    return `
      <label class="list-item">
        <input type="checkbox" data-extra-id="${escapeHTML(s.id)}" ${checked ? 'checked' : ''}>
        <div class="list-item-main">
          <div class="list-item-title">${escapeHTML(s.name)}</div>
          <div class="list-item-sub">+${parseInt(s.duration, 10) || 60} min • ${formatBRL(s.price)}</div>
        </div>
      </label>
    `;
  }).join('');

  listEl.querySelectorAll('input[data-extra-id]').forEach(chk => {
    chk.addEventListener('change', async () => {
      const id = chk.dataset.extraId;
      if (chk.checked) {
        if (!state.extraServiceIds.includes(id)) state.extraServiceIds.push(id);
      } else {
        state.extraServiceIds = state.extraServiceIds.filter(x => x !== id);
      }
      updateSummaryUI();
      await renderSlots();
    });
  });
}

async function renderCalendar() {
  document.getElementById('calMonthLabel').textContent = `${MONTHS_PT[state.calMonth]} ${state.calYear}`;
  const grid = document.getElementById('calDaysGrid');
  grid.innerHTML = '';

  const firstDay = new Date(state.calYear, state.calMonth, 1).getDay();
  const totalDays = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  const selectedIso = formatDateISO(state.selectedDate);

  for (let i = 0; i < firstDay; i++) {
    grid.insertAdjacentHTML('beforeend', '<div></div>');
  }

  for (let day = 1; day <= totalDays; day++) {
    const dt = new Date(state.calYear, state.calMonth, day);
    const iso = formatDateISO(dt);
    const open = await db.isDateOpen(iso);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cal-day${iso === selectedIso ? ' is-selected' : ''}${open ? '' : ' is-disabled'}`;
    btn.textContent = String(day);
    btn.disabled = !open;
    if (open) {
      btn.addEventListener('click', async () => {
        state.selectedDate = dt;
        await renderCalendar();
        await renderSlots();
      });
    }
    grid.appendChild(btn);
  }
}

async function renderSlots() {
  const iso = formatDateISO(state.selectedDate);
  document.getElementById('selectedDateLabel').textContent = formatDateBR(iso);
  const grid = document.getElementById('slotsGrid');
  const totals = getBookingTotals();
  const free = await db.getAvailableSlots(iso, totals.totalDuration, state.rescheduleId || '');

  if (free.length === 0) {
    state.selectedSlot = '';
    grid.innerHTML = '<div class="empty-state">Sem horários livres nesta data. Escolha outro dia no calendário.</div>';
    return;
  }

  if (!free.includes(state.selectedSlot)) {
    state.selectedSlot = free[0];
  }

  grid.innerHTML = free
    .map(slot => `<button type="button" class="slot-btn ${slot === state.selectedSlot ? 'is-selected' : ''}" data-slot="${slot}">${slot}</button>`)
    .join('');

  grid.querySelectorAll('.slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedSlot = btn.dataset.slot;
      renderSlots();
    });
  });
}

async function startBookingFlow(service, rescheduleApp = null) {
  state.selectedService = service || state.services[0];
  state.extraServiceIds = [];
  state.rescheduleId = rescheduleApp ? rescheduleApp.id : null;
  state.selectedDate = new Date();
  state.calYear = state.selectedDate.getFullYear();
  state.calMonth = state.selectedDate.getMonth();

  const notice = document.getElementById('rescheduleNotice');
  if (rescheduleApp) {
    notice.hidden = false;
    document.getElementById('rescheduleNoticeText').textContent =
      `Atual: ${formatDateBR(rescheduleApp.date)} às ${rescheduleApp.time}. Escolha a nova data e horário.`;
    document.getElementById('bookingModalTitle').textContent = 'Remarcar Horário';
  } else {
    notice.hidden = true;
    document.getElementById('bookingModalTitle').textContent = 'Agendar Horário';
  }

  document.getElementById('comboPickerBox').hidden = true;

  const nameInp = document.getElementById('inputClientName');
  const phoneInp = document.getElementById('inputClientPhone');
  nameInp.value = rescheduleApp?.clientName || localStorage.getItem('epn_last_client_name') || '';
  phoneInp.value = rescheduleApp?.clientPhone || localStorage.getItem('epn_last_client_phone') || '';

  updateSummaryUI();
  renderComboList();
  await renderCalendar();
  await renderSlots();
  openModal('modalBooking');
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('inputClientName').value.trim();
  const phone = document.getElementById('inputClientPhone').value.trim();

  if (!name || cleanPhoneDigits(phone).length < 10) {
    showToast('Informe seu nome e WhatsApp com DDD.', 'error');
    return;
  }
  if (!state.selectedSlot) {
    showToast('Escolha um horário disponível.', 'error');
    return;
  }

  const totals = getBookingTotals();
  const dateIso = formatDateISO(state.selectedDate);
  const wasReschedule = Boolean(state.rescheduleId);

  let saved;
  if (wasReschedule) {
    saved = await db.updateAppointment(state.rescheduleId, {
      clientName: name,
      clientPhone: phone,
      serviceId: state.selectedService?.id || '',
      serviceName: totals.combinedName,
      servicePrice: totals.totalPrice,
      duration: totals.totalDuration,
      date: dateIso,
      time: state.selectedSlot,
      status: 'Confirmado'
    });
  } else {
    saved = await db.createAppointment({
      clientName: name,
      clientPhone: phone,
      serviceId: state.selectedService?.id || '',
      serviceName: totals.combinedName,
      servicePrice: totals.totalPrice,
      duration: totals.totalDuration,
      date: dateIso,
      time: state.selectedSlot
    });
  }

  localStorage.setItem('epn_last_client_name', name);
  localStorage.setItem('epn_last_client_phone', phone);
  state.lastBooking = saved;
  state.rescheduleId = null;

  document.getElementById('successDetailsBox').innerHTML = `
    <div><strong>Procedimento:</strong> ${escapeHTML(saved.serviceName)}</div>
    <div><strong>Data e Horário:</strong> ${formatDateBR(saved.date)} às ${escapeHTML(saved.time)}</div>
    <div><strong>Valor e Duração:</strong> ${formatBRL(saved.servicePrice)} • ${saved.duration} min</div>
    <div><strong>Cliente:</strong> ${escapeHTML(saved.clientName)}</div>
  `;

  // Exibe Pix Copia e Cola se configurado
  const pixBox = document.getElementById('successPixBox');
  if (state.settings.pixKey) {
    const depPct = parseInt(state.settings.depositPercent || 0, 10);
    const pixVal = depPct > 0 ? (saved.servicePrice * depPct) / 100 : saved.servicePrice;
    document.getElementById('successPixTitle').textContent =
      depPct > 0 ? `Sinal de Reserva (${depPct}%) via Pix` : 'Chave Pix do Studio';
    document.getElementById('successPixValue').textContent = formatBRL(pixVal);
    document.getElementById('successPixKey').textContent = state.settings.pixKey;
    pixBox.hidden = false;
  } else {
    pixBox.hidden = true;
  }

  closeModal('modalBooking');
  openModal('modalSuccess');
  await renderNextBookingStrip();
  showToast(wasReschedule ? 'Horário remarcado com sucesso!' : 'Agendamento confirmado!');
}

async function renderMyBookings() {
  const listEl = document.getElementById('myBookingsList');
  const query = cleanPhoneDigits(document.getElementById('inputSearchMyPhone').value);
  const all = await db.getAppointments();

  const mine = query.length >= 4
    ? all.filter(a => cleanPhoneDigits(a.clientPhone).includes(query))
    : [];

  if (mine.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Digite seu WhatsApp acima para consultar ou remarcar seus horários.</div>';
    return;
  }

  const minHours = parseInt(state.settings.rescheduleMinHours || 12, 10);
  listEl.innerHTML = mine.map(app => {
    const check = db.canClientReschedule(app, minHours);
    const badgeClass = app.status === 'Cancelado' ? 'status-cancelado' : (app.status === 'Concluído' ? 'status-concluido' : 'status-confirmado');
    return `
      <div class="list-item">
        <div class="list-item-main">
          <div class="list-item-title">${escapeHTML(app.serviceName)}</div>
          <div class="list-item-sub">${formatDateBR(app.date)} às ${escapeHTML(app.time)} • ${formatBRL(app.servicePrice)}</div>
          <span class="status-badge ${badgeClass}">${escapeHTML(app.status)}</span>
        </div>
        ${app.status !== 'Cancelado' && app.status !== 'Concluído' ? `
          <button type="button" class="btn btn-outline btn-sm" data-reschedule-id="${escapeHTML(app.id)}" data-allowed="${check.allowed ? '1' : '0'}">
            <i class="fa-solid fa-rotate"></i> Remarcar
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('[data-reschedule-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.allowed !== '1') {
        showToast(`Remarcação online permitida com no mínimo ${minHours}h de antecedência. Fale no WhatsApp.`, 'error');
        return;
      }
      const app = mine.find(a => a.id === btn.dataset.rescheduleId);
      const srv = state.services.find(s => s.id === app.serviceId) || {
        id: app.serviceId,
        name: app.serviceName,
        price: app.servicePrice,
        duration: app.duration
      };
      closeModal('modalMyBookings');
      startBookingFlow(srv, app);
    });
  });
}

function openStudioWhatsapp(customMessage) {
  const msg = customMessage || `Olá, ${state.settings.ownerName || 'Estefany'}! Gostaria de informações sobre agendamento de unhas.`;
  window.open(buildWhatsAppUrl(state.settings.phone, msg), '_blank');
}

function bindEvents() {
  document.getElementById('btnHeroBookNow').addEventListener('click', () => startBookingFlow(state.services[0]));
  document.getElementById('navBook').addEventListener('click', () => startBookingFlow(state.services[0]));
  document.getElementById('navHome').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const openMy = async () => {
    const inp = document.getElementById('inputSearchMyPhone');
    if (!inp.value) inp.value = localStorage.getItem('epn_last_client_phone') || '';
    await renderMyBookings();
    openModal('modalMyBookings');
  };
  document.getElementById('btnOpenMyBookings').addEventListener('click', openMy);
  document.getElementById('navMyBookings').addEventListener('click', openMy);
  document.getElementById('btnManageNextBooking').addEventListener('click', openMy);

  document.getElementById('btnQuickWhatsapp').addEventListener('click', () => openStudioWhatsapp());
  document.getElementById('navWhatsapp').addEventListener('click', () => openStudioWhatsapp());

  document.getElementById('btnCloseBookingTop').addEventListener('click', () => closeModal('modalBooking'));
  document.getElementById('btnCloseBookingX').addEventListener('click', () => closeModal('modalBooking'));
  document.getElementById('btnCloseSuccess').addEventListener('click', () => closeModal('modalSuccess'));
  document.getElementById('btnCloseMyBookings').addEventListener('click', () => closeModal('modalMyBookings'));

  document.getElementById('btnToggleCombo').addEventListener('click', () => {
    const box = document.getElementById('comboPickerBox');
    box.hidden = !box.hidden;
  });

  document.getElementById('btnCancelReschedule').addEventListener('click', async () => {
    state.rescheduleId = null;
    document.getElementById('rescheduleNotice').hidden = true;
    document.getElementById('bookingModalTitle').textContent = 'Agendar Horário';
    await renderSlots();
  });

  document.getElementById('btnCalPrev').addEventListener('click', async () => {
    state.calMonth -= 1;
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear -= 1; }
    await renderCalendar();
  });

  document.getElementById('btnCalNext').addEventListener('click', async () => {
    state.calMonth += 1;
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear += 1; }
    await renderCalendar();
  });

  document.getElementById('inputClientPhone').addEventListener('input', (e) => {
    e.target.value = maskPhoneBR(e.target.value);
  });

  document.getElementById('inputSearchMyPhone').addEventListener('input', (e) => {
    e.target.value = maskPhoneBR(e.target.value);
    renderMyBookings();
  });

  document.getElementById('bookingForm').addEventListener('submit', handleBookingSubmit);

  document.getElementById('btnCopyPix').addEventListener('click', () => {
    const key = document.getElementById('successPixKey').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(key).then(() => showToast('Chave Pix copiada!'));
    } else {
      prompt('Copie a chave Pix:', key);
    }
  });

  document.getElementById('btnSuccessWhatsapp').addEventListener('click', () => {
    const app = state.lastBooking;
    if (!app) return openStudioWhatsapp();
    openStudioWhatsapp(
      `Olá! Acabei de agendar *${app.serviceName}* para *${formatDateBR(app.date)}* às *${app.time}* (Nome: ${app.clientName}).`
    );
  });

  document.getElementById('btnSuccessGcal').addEventListener('click', () => {
    if (state.lastBooking) {
      window.open(buildGoogleCalendarUrl(state.lastBooking, state.settings.salonName), '_blank');
    }
  });

  document.getElementById('btnSuccessIcs').addEventListener('click', () => {
    if (state.lastBooking) {
      downloadIcsFile(state.lastBooking, state.settings.salonName);
      showToast('Arquivo de calendário (.ics) baixado!');
    }
  });
}

async function bootstrap() {
  await db.init();
  state.settings = await db.getSettings();
  state.categories = await db.getCategories();
  state.services = await db.getServices(true);

  await hydrateBranding();
  renderCategories();
  renderServices();
  await renderNextBookingStrip();
  bindEvents();
}

bootstrap();
