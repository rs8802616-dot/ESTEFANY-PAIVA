/**
 * Controlador do Painel Administrativo — Estefany Paiva Nails (v34)
 * 100% dados reais, zero números fictícios, zero iframes, login seguro.
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
  compressImageFile,
  showToast
} from './utils.js';

const state = {
  settings: null,
  categories: [],
  services: [],
  appointments: [],
  blocks: [],
  activeTab: 'dashboard',
  agendaDateFilter: '',
  clientSearch: '',
  reportPeriod: '30d',
  selectedApp: null,
  selectedClientPhone: '',
  pendingServiceImage: '',
  pendingAvatarImage: '',
  pendingBannerImage: ''
};

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('is-open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('is-open');
}

async function reloadAllData() {
  const [settings, categories, services, appointments, blocks] = await Promise.all([
    db.getSettings(),
    db.getCategories(),
    db.getServices(false),
    db.getAppointments(),
    db.getPersonalBlocks()
  ]);
  state.settings = settings;
  state.categories = categories;
  state.services = services;
  state.appointments = appointments;
  state.blocks = blocks;
}

function renderHeader() {
  const s = state.settings;
  document.getElementById('adminSalonName').textContent = s.salonName || 'Estefany Paiva';
  document.getElementById('adminGreeting').textContent = `Olá, ${(s.ownerName || 'Estefany').split(' ')[0]}!`;
  document.getElementById('adminAvatarImg').src = s.avatarImage || 'assets/images/trabalho-amendoada-ouro.png';
  document.getElementById('adminModeBadge').textContent =
    db.mode === 'firebase'
      ? 'Conectado ao Firebase Firestore (Nuvem)'
      : 'Modo Local Seguro (cole seu firebaseConfig em src/config.js)';
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-screen').forEach(el => el.classList.toggle('is-active', el.id === `tab_${tabName}`));
  document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === tabName));
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (tabName === 'dashboard') renderDashboard();
  else if (tabName === 'agenda') renderAgenda();
  else if (tabName === 'clientes') renderClients();
  else if (tabName === 'servicos') renderServices();
  else if (tabName === 'relatorios') renderReports();
  else if (tabName === 'ajustes') renderSettingsForm();
}

// ========================================================
// 1. DASHBOARD (100% DADOS REAIS)
// ========================================================
function renderDashboard() {
  const activeApps = state.appointments.filter(a => a.status !== 'Cancelado');
  const uniquePhones = new Set(activeApps.map(a => cleanPhoneDigits(a.clientPhone)).filter(Boolean));

  const now = new Date();
  const ymPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthApps = activeApps.filter(a => (a.date || '').startsWith(ymPrefix));
  const monthRevenue = monthApps.reduce((sum, a) => sum + (Number(a.servicePrice) || 0), 0);
  const avgTicket = activeApps.length > 0
    ? activeApps.reduce((sum, a) => sum + (Number(a.servicePrice) || 0), 0) / activeApps.length
    : 0;

  document.getElementById('kpiActiveCount').textContent = String(activeApps.length);
  document.getElementById('kpiClientsCount').textContent = String(uniquePhones.size);
  document.getElementById('kpiMonthRevenue').textContent = formatBRL(monthRevenue);
  document.getElementById('kpiAvgTicket').textContent = formatBRL(avgTicket);

  const goal = Number(state.settings.monthlyGoal) || 5000;
  const pct = goal > 0 ? Math.min(100, Math.round((monthRevenue / goal) * 100)) : 0;
  document.getElementById('goalLabel').textContent = `${formatBRL(monthRevenue)} de ${formatBRL(goal)} (${pct}%)`;
  document.getElementById('goalProgressBar').style.width = `${pct}%`;

  const todayIso = formatDateISO(now);
  const upcoming = activeApps
    .filter(a => a.date >= todayIso && a.status !== 'Concluído')
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 6);

  const listEl = document.getElementById('dashUpcomingList');
  if (upcoming.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nenhum agendamento futuro no momento.</div>';
    return;
  }

  listEl.innerHTML = upcoming.map(app => renderAppointmentRowHTML(app)).join('');
  bindAppointmentRowClicks(listEl);
}

function renderAppointmentRowHTML(app) {
  const cls = app.status === 'Cancelado' ? 'status-cancelado' : (app.status === 'Concluído' ? 'status-concluido' : 'status-confirmado');
  return `
    <div class="list-item" data-app-id="${escapeHTML(app.id)}">
      <div class="list-item-main">
        <div class="list-item-title">${escapeHTML(app.clientName)} — ${escapeHTML(app.serviceName)}</div>
        <div class="list-item-sub">${formatDateBR(app.date)} às ${escapeHTML(app.time)} • ${formatBRL(app.servicePrice)} • ${app.duration || 90} min</div>
      </div>
      <span class="status-badge ${cls}">${escapeHTML(app.status)}</span>
    </div>
  `;
}

function bindAppointmentRowClicks(container) {
  container.querySelectorAll('[data-app-id]').forEach(row => {
    row.addEventListener('click', () => {
      const app = state.appointments.find(a => a.id === row.dataset.appId);
      if (app) openAppointmentDetails(app);
    });
  });
}

// ========================================================
// 2. AGENDA & MENSAGENS PRONTAS DE 1 CLIQUE
// ========================================================
function renderAgenda() {
  const listEl = document.getElementById('agendaList');
  const filtered = state.agendaDateFilter
    ? state.appointments.filter(a => a.date === state.agendaDateFilter)
    : state.appointments;

  const sorted = [...filtered].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  if (sorted.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nenhum agendamento encontrado para este filtro.</div>';
    return;
  }

  listEl.innerHTML = sorted.map(app => renderAppointmentRowHTML(app)).join('');
  bindAppointmentRowClicks(listEl);
}

function openAppointmentDetails(app) {
  state.selectedApp = app;
  document.getElementById('appDetailsInfo').innerHTML = `
    <div><strong>Cliente:</strong> ${escapeHTML(app.clientName)}</div>
    <div><strong>WhatsApp:</strong> ${escapeHTML(app.clientPhone)}</div>
    <div><strong>Procedimento:</strong> ${escapeHTML(app.serviceName)}</div>
    <div><strong>Data e Horário:</strong> ${formatDateBR(app.date)} às ${escapeHTML(app.time)} (${app.duration || 90} min)</div>
    <div><strong>Valor:</strong> ${formatBRL(app.servicePrice)} • <strong>Status:</strong> ${escapeHTML(app.status)}</div>
  `;
  openModal('modalAppDetails');
}

function sendQuickTemplate(type) {
  const app = state.selectedApp;
  if (!app) return;
  const dateBr = formatDateBR(app.date);
  const s = state.settings;
  const depPct = parseInt(s.depositPercent || 0, 10);
  const pixVal = depPct > 0 ? (Number(app.servicePrice) * depPct) / 100 : Number(app.servicePrice);

  let msg = '';
  if (type === 'lembrete') {
    msg = `Olá, ${app.clientName}! Passando para confirmar seu horário de *${app.serviceName}* no dia *${dateBr}* às *${app.time}* no ${s.salonName}. Te espero!`;
  } else if (type === 'pix') {
    const label = depPct > 0 ? `sinal de reserva (${depPct}% - ${formatBRL(pixVal)})` : `valor de ${formatBRL(pixVal)}`;
    msg = `Olá, ${app.clientName}! Segue nossa chave Pix para o ${label} referente ao horário de *${app.serviceName}* (${dateBr} às ${app.time}):\n\nChave Pix: ${s.pixKey || '(consulte no atendimento)'}`;
  } else if (type === 'avaliacao') {
    msg = `Olá, ${app.clientName}! Foi um prazer te atender hoje. Como ficaram suas unhas de *${app.serviceName}*? Seu feedback é muito importante para mim!`;
  }
  window.open(buildWhatsAppUrl(app.clientPhone, msg), '_blank');
}

// ========================================================
// 3. CLIENTES, RETORNO 21+ DIAS & FICHA TÉCNICA
// ========================================================
function renderClients() {
  const map = new Map();
  state.appointments.forEach(a => {
    const key = cleanPhoneDigits(a.clientPhone);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        name: a.clientName,
        phone: a.clientPhone,
        lastDate: a.date,
        lastService: a.serviceName,
        count: 0,
        total: 0
      });
    }
    const entry = map.get(key);
    if (a.status !== 'Cancelado') {
      entry.count += 1;
      entry.total += Number(a.servicePrice) || 0;
      if (a.date > entry.lastDate) {
        entry.lastDate = a.date;
        entry.lastService = a.serviceName;
      }
    }
  });

  const q = state.clientSearch.trim().toLowerCase();
  const list = Array.from(map.values()).filter(c =>
    !q || c.name.toLowerCase().includes(q) || cleanPhoneDigits(c.phone).includes(cleanPhoneDigits(q))
  );

  const host = document.getElementById('clientsList');
  if (list.length === 0) {
    host.innerHTML = '<div class="empty-state">Nenhuma cliente encontrada ainda.</div>';
    return;
  }

  const nowMs = Date.now();
  host.innerHTML = list.map(c => {
    let days = 0;
    if (c.lastDate && c.lastDate.includes('-')) {
      const [y, m, d] = c.lastDate.split('-').map(Number);
      days = Math.floor((nowMs - new Date(y, m - 1, d).getTime()) / 86400000);
    }
    const needsReturn = days >= 21;
    return `
      <div class="list-item" data-client-phone="${escapeHTML(c.phone)}">
        <div class="list-item-main">
          <div class="list-item-title">
            ${escapeHTML(c.name)}
            ${needsReturn ? `<span class="status-badge status-retorno">⏰ Retorno (${days}d)</span>` : ''}
          </div>
          <div class="list-item-sub">${escapeHTML(c.phone)} • ${c.count} atend. • ${formatBRL(c.total)} • Último: ${formatDateBR(c.lastDate)}</div>
        </div>
        ${needsReturn ? `
          <button type="button" class="btn btn-whatsapp btn-sm" data-return-phone="${escapeHTML(c.phone)}" data-return-name="${escapeHTML(c.name)}" data-return-days="${days}">
            <i class="fa-brands fa-whatsapp"></i> Retorno
          </button>
        ` : `<i class="fa-solid fa-chevron-right"></i>`}
      </div>
    `;
  }).join('');

  host.querySelectorAll('[data-return-phone]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const msg = `Olá, ${btn.dataset.returnName}! Tudo bem? Faz ${btn.dataset.returnDays} dias desde seu último atendimento conosco. Vamos agendar sua manutenção?`;
      window.open(buildWhatsAppUrl(btn.dataset.returnPhone, msg), '_blank');
    });
  });

  host.querySelectorAll('[data-client-phone]').forEach(row => {
    row.addEventListener('click', () => openClientSheet(row.dataset.clientPhone));
  });
}

async function openClientSheet(phone) {
  state.selectedClientPhone = phone;
  const digits = cleanPhoneDigits(phone);
  const apps = state.appointments.filter(a => cleanPhoneDigits(a.clientPhone) === digits);
  const name = apps[0]?.clientName || 'Cliente';

  document.getElementById('sheetClientName').textContent = name;
  document.getElementById('sheetClientMeta').textContent = `${phone} • ${apps.length} registro(s)`;

  const tech = await db.getClientTechNotes(phone);
  document.getElementById('techShape').value = tech.nailShape || '';
  document.getElementById('techColor').value = tech.favoriteColor || '';
  document.getElementById('techAllergies').value = tech.allergies || '';
  document.getElementById('techNotes').value = tech.notes || '';

  const histEl = document.getElementById('sheetClientHistory');
  histEl.innerHTML = apps.map(a => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${escapeHTML(a.serviceName)}</div>
        <div class="list-item-sub">${formatDateBR(a.date)} às ${escapeHTML(a.time)} • ${formatBRL(a.servicePrice)}</div>
      </div>
      <span class="status-badge ${a.status === 'Cancelado' ? 'status-cancelado' : 'status-confirmado'}">${escapeHTML(a.status)}</span>
    </div>
  `).join('');

  openModal('modalClientSheet');
}

// ========================================================
// 4. SERVIÇOS & CATEGORIAS
// ========================================================
function renderServices() {
  const host = document.getElementById('adminServicesList');
  if (state.services.length === 0) {
    host.innerHTML = '<div class="empty-state">Nenhum serviço cadastrado. Clique em "Novo Serviço".</div>';
    return;
  }

  host.innerHTML = state.services.map(s => `
    <article class="service-card">
      <div class="service-cover">
        <img src="${escapeHTML(s.image || 'assets/images/trabalho-alongamento-chocolate.png')}" alt="${escapeHTML(s.name)}" loading="lazy">
        <span class="service-duration-tag">${s.duration || 90} min</span>
      </div>
      <div class="service-body">
        <h4>${escapeHTML(s.name)}</h4>
        <p>${escapeHTML(s.description || '')}</p>
        <div class="service-footer">
          <span class="service-price">${formatBRL(s.price)}</span>
          <div class="topbar-actions">
            <button type="button" class="btn btn-outline btn-sm" data-edit-srv="${escapeHTML(s.id)}">Editar</button>
            <button type="button" class="btn btn-danger-soft btn-sm" data-del-srv="${escapeHTML(s.id)}">Excluir</button>
          </div>
        </div>
      </div>
    </article>
  `).join('');

  host.querySelectorAll('[data-edit-srv]').forEach(btn => {
    btn.addEventListener('click', () => {
      const srv = state.services.find(s => s.id === btn.dataset.editSrv);
      if (srv) openServiceModal(srv);
    });
  });

  host.querySelectorAll('[data-del-srv]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Deseja excluir este procedimento?')) return;
      await db.deleteService(btn.dataset.delSrv);
      await reloadAllData();
      renderServices();
      showToast('Serviço excluído.');
    });
  });
}

function openServiceModal(srv = null) {
  const sel = document.getElementById('srvCategory');
  sel.innerHTML = state.categories
    .map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`)
    .join('');

  state.pendingServiceImage = srv?.image || '';
  document.getElementById('serviceModalHeading').textContent = srv ? 'Editar Serviço' : 'Novo Serviço';
  document.getElementById('srvId').value = srv?.id || '';
  document.getElementById('srvName').value = srv?.name || '';
  document.getElementById('srvPrice').value = srv?.price ?? '';
  document.getElementById('srvDuration').value = srv?.duration || 90;
  if (srv?.categoryId) sel.value = srv.categoryId;
  document.getElementById('srvDesc').value = srv?.description || '';
  document.getElementById('srvPhoto').value = '';
  openModal('modalServiceForm');
}

function renderCategoriesModal() {
  const host = document.getElementById('categoriesList');
  host.innerHTML = state.categories.map(c => `
    <div class="list-item">
      <div class="list-item-title">${escapeHTML(c.name)}</div>
      <button type="button" class="btn btn-danger-soft btn-sm" data-del-cat="${escapeHTML(c.id)}">Excluir</button>
    </div>
  `).join('');

  host.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.deleteCategory(btn.dataset.delCat);
      await reloadAllData();
      renderCategoriesModal();
      showToast('Categoria removida.');
    });
  });
}

// ========================================================
// 5. RELATÓRIOS REAIS & EXPORTAÇÃO CSV
// ========================================================
function getFilteredReportApps() {
  const now = new Date();
  let cutoff = null;
  if (state.reportPeriod === '7d') cutoff = new Date(now.getTime() - 7 * 86400000);
  else if (state.reportPeriod === '30d') cutoff = new Date(now.getTime() - 30 * 86400000);
  else if (state.reportPeriod === '6m') cutoff = new Date(now.getTime() - 180 * 86400000);

  return state.appointments.filter(a => {
    if (!cutoff) return true;
    const [y, m, d] = (a.date || '').split('-').map(Number);
    if (!y) return false;
    return new Date(y, m - 1, d) >= cutoff;
  });
}

function renderReports() {
  const list = getFilteredReportApps();
  const active = list.filter(a => a.status !== 'Cancelado');
  const canceled = list.filter(a => a.status === 'Cancelado');
  const rev = active.reduce((s, a) => s + (Number(a.servicePrice) || 0), 0);
  const ticket = active.length > 0 ? rev / active.length : 0;

  document.getElementById('repRevenue').textContent = formatBRL(rev);
  document.getElementById('repCount').textContent = String(active.length);
  document.getElementById('repTicket').textContent = formatBRL(ticket);
  document.getElementById('repCanceled').textContent = String(canceled.length);

  const bySrv = new Map();
  active.forEach(a => {
    const cur = bySrv.get(a.serviceName) || { name: a.serviceName, count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(a.servicePrice) || 0;
    bySrv.set(a.serviceName, cur);
  });

  const rows = Array.from(bySrv.values()).sort((a, b) => b.total - a.total);
  const host = document.getElementById('repByServiceList');
  if (rows.length === 0) {
    host.innerHTML = '<div class="empty-state">Sem dados financeiros neste período.</div>';
    return;
  }

  host.innerHTML = rows.map(r => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${escapeHTML(r.name)}</div>
        <div class="list-item-sub">${r.count} atendimento(s)</div>
      </div>
      <strong>${formatBRL(r.total)}</strong>
    </div>
  `).join('');
}

function exportCSV() {
  const rows = getFilteredReportApps();
  let csv = '\uFEFFData;Horário;Cliente;WhatsApp;Serviço;Valor;Status\n';
  rows.forEach(a => {
    csv += `${formatDateBR(a.date)};${a.time};"${a.clientName}";"${a.clientPhone}";"${a.serviceName}";${Number(a.servicePrice || 0).toFixed(2)};${a.status}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-estefany-paiva-${state.reportPeriod}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Planilha CSV exportada!');
}

// ========================================================
// 6. AJUSTES & BLOQUEIOS
// ========================================================
function renderSettingsForm() {
  const s = state.settings;
  state.pendingAvatarImage = s.avatarImage || '';
  state.pendingBannerImage = s.promoBannerImage || '';
  document.getElementById('cfgSalonName').value = s.salonName || '';
  document.getElementById('cfgOwnerName').value = s.ownerName || '';
  document.getElementById('cfgPhone').value = s.phone || '';
  document.getElementById('cfgPixKey').value = s.pixKey || '';
  document.getElementById('cfgBio').value = s.bio || '';
  document.getElementById('cfgDepositPct').value = s.depositPercent || 0;
  document.getElementById('cfgRescheduleHours').value = s.rescheduleMinHours || 12;
  document.getElementById('cfgMonthlyGoal').value = s.monthlyGoal || 5000;
  document.getElementById('cfgSlots').value = (s.configuredSlots || []).join(', ');
}

function renderBlocksModal() {
  const host = document.getElementById('blocksList');
  if (state.blocks.length === 0) {
    host.innerHTML = '<div class="empty-state">Nenhum bloqueio cadastrado.</div>';
    return;
  }
  host.innerHTML = state.blocks.map(b => `
    <div class="list-item">
      <div class="list-item-main">
        <div class="list-item-title">${escapeHTML(b.title)}</div>
        <div class="list-item-sub">${formatDateBR(b.date)} • ${escapeHTML(b.startTime)} às ${escapeHTML(b.endTime)}</div>
      </div>
      <button type="button" class="btn btn-danger-soft btn-sm" data-del-blk="${escapeHTML(b.id)}">Remover</button>
    </div>
  `).join('');

  host.querySelectorAll('[data-del-blk]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.deletePersonalBlock(btn.dataset.delBlk);
      await reloadAllData();
      renderBlocksModal();
      showToast('Bloqueio removido.');
    });
  });
}

// ========================================================
// BINDINGS & LOGIN GATE
// ========================================================
function bindEvents() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.getElementById('btnAdminLogout').addEventListener('click', async () => {
    await db.logoutAdmin();
    location.reload();
  });

  // Novo agendamento manual
  const openNewApp = () => {
    const sel = document.getElementById('newAppService');
    sel.innerHTML = state.services.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)} — ${formatBRL(s.price)}</option>`).join('');
    document.getElementById('newAppDate').value = state.agendaDateFilter || formatDateISO(new Date());
    openModal('modalNewApp');
  };
  document.getElementById('btnQuickNewApp').addEventListener('click', openNewApp);
  document.getElementById('btnAgendaNewApp').addEventListener('click', openNewApp);

  document.getElementById('newAppPhone').addEventListener('input', e => {
    e.target.value = maskPhoneBR(e.target.value);
  });

  document.getElementById('newAppForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const srvId = document.getElementById('newAppService').value;
    const srv = state.services.find(s => s.id === srvId);
    await db.createAppointment({
      clientName: document.getElementById('newAppName').value,
      clientPhone: document.getElementById('newAppPhone').value,
      serviceId: srv?.id || '',
      serviceName: srv?.name || 'Serviço',
      servicePrice: srv?.price || 0,
      duration: srv?.duration || 90,
      date: document.getElementById('newAppDate').value,
      time: document.getElementById('newAppTime').value
    });
    e.target.reset();
    closeModal('modalNewApp');
    await reloadAllData();
    switchTab(state.activeTab);
    showToast('Agendamento salvo!');
  });

  // Agenda filtros
  document.getElementById('inputAgendaDate').addEventListener('change', (e) => {
    state.agendaDateFilter = e.target.value;
    renderAgenda();
  });
  document.getElementById('btnClearAgendaDate').addEventListener('click', () => {
    state.agendaDateFilter = '';
    document.getElementById('inputAgendaDate').value = '';
    renderAgenda();
  });

  // Ações do modal de detalhes
  document.getElementById('btnTplReminder').addEventListener('click', () => sendQuickTemplate('lembrete'));
  document.getElementById('btnTplPix').addEventListener('click', () => sendQuickTemplate('pix'));
  document.getElementById('btnTplFeedback').addEventListener('click', () => sendQuickTemplate('avaliacao'));
  document.getElementById('btnAppGcal').addEventListener('click', () => {
    if (state.selectedApp) window.open(buildGoogleCalendarUrl(state.selectedApp, state.settings.salonName), '_blank');
  });

  const updateStatus = async (status) => {
    if (!state.selectedApp) return;
    await db.updateAppointment(state.selectedApp.id, { status });
    closeModal('modalAppDetails');
    await reloadAllData();
    switchTab(state.activeTab);
    showToast(`Status atualizado para: ${status}`);
  };
  document.getElementById('btnMarkConfirm').addEventListener('click', () => updateStatus('Confirmado'));
  document.getElementById('btnMarkDone').addEventListener('click', () => updateStatus('Concluído'));
  document.getElementById('btnMarkCancel').addEventListener('click', () => updateStatus('Cancelado'));

  // Clientes busca & ficha técnica
  document.getElementById('inputSearchClients').addEventListener('input', (e) => {
    state.clientSearch = e.target.value;
    renderClients();
  });

  document.getElementById('techNotesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await db.saveClientTechNotes(state.selectedClientPhone, {
      nailShape: document.getElementById('techShape').value,
      favoriteColor: document.getElementById('techColor').value,
      allergies: document.getElementById('techAllergies').value,
      notes: document.getElementById('techNotes').value
    });
    showToast('Ficha técnica salva!');
  });

  // Serviços & Categorias
  document.getElementById('btnNewService').addEventListener('click', () => openServiceModal(null));
  document.getElementById('srvPhoto').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      state.pendingServiceImage = await compressImageFile(file, 720, 0.8);
      showToast('Foto otimizada e pronta para salvar.');
    }
  });
  document.getElementById('serviceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await db.saveService({
      id: document.getElementById('srvId').value || undefined,
      name: document.getElementById('srvName').value,
      price: document.getElementById('srvPrice').value,
      duration: document.getElementById('srvDuration').value,
      categoryId: document.getElementById('srvCategory').value,
      description: document.getElementById('srvDesc').value,
      image: state.pendingServiceImage || 'assets/images/trabalho-alongamento-chocolate.png'
    });
    closeModal('modalServiceForm');
    await reloadAllData();
    renderServices();
    showToast('Serviço salvo!');
  });

  document.getElementById('btnManageCats').addEventListener('click', () => {
    renderCategoriesModal();
    openModal('modalCategories');
  });
  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = document.getElementById('newCatName');
    await db.saveCategory({ name: inp.value });
    inp.value = '';
    await reloadAllData();
    renderCategoriesModal();
    showToast('Categoria adicionada!');
  });

  // Bloqueios pessoais
  document.getElementById('btnOpenBlocks').addEventListener('click', () => {
    document.getElementById('blkDate').value = formatDateISO(new Date());
    renderBlocksModal();
    openModal('modalBlocks');
  });
  document.getElementById('blockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await db.addPersonalBlock({
      title: document.getElementById('blkTitle').value,
      date: document.getElementById('blkDate').value,
      startTime: document.getElementById('blkStart').value,
      endTime: document.getElementById('blkEnd').value
    });
    e.target.reset();
    await reloadAllData();
    renderBlocksModal();
    showToast('Bloqueio registrado!');
  });

  // Relatórios
  document.querySelectorAll('#reportPeriodPills [data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.reportPeriod = btn.dataset.period;
      document.querySelectorAll('#reportPeriodPills .pill-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      renderReports();
    });
  });
  document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
  document.getElementById('btnPrintPDF').addEventListener('click', () => window.print());

  // Ajustes
  document.getElementById('cfgAvatarFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      state.pendingAvatarImage = await compressImageFile(file, 480, 0.82);
      showToast('Foto de perfil pronta — clique em Salvar Configurações.');
    }
  });
  document.getElementById('cfgBannerFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      state.pendingBannerImage = await compressImageFile(file, 900, 0.8);
      showToast('Banner pronto — clique em Salvar Configurações.');
    }
  });
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const slotsRaw = document.getElementById('cfgSlots').value
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d{2}:\d{2}$/.test(s));

    await db.saveSettings({
      salonName: document.getElementById('cfgSalonName').value.trim(),
      ownerName: document.getElementById('cfgOwnerName').value.trim(),
      phone: document.getElementById('cfgPhone').value.trim(),
      pixKey: document.getElementById('cfgPixKey').value.trim(),
      bio: document.getElementById('cfgBio').value.trim(),
      depositPercent: parseInt(document.getElementById('cfgDepositPct').value, 10) || 0,
      rescheduleMinHours: parseInt(document.getElementById('cfgRescheduleHours').value, 10) || 12,
      monthlyGoal: Number(document.getElementById('cfgMonthlyGoal').value) || 5000,
      configuredSlots: slotsRaw.length > 0 ? slotsRaw : state.settings.configuredSlots,
      avatarImage: state.pendingAvatarImage || state.settings.avatarImage,
      promoBannerImage: state.pendingBannerImage || state.settings.promoBannerImage
    });
    await reloadAllData();
    renderHeader();
    showToast('Configurações salvas com sucesso!');
  });
}

async function enterAdminApp() {
  document.getElementById('loginGate').hidden = true;
  document.getElementById('adminAppShell').hidden = false;
  await reloadAllData();
  renderHeader();
  bindEvents();
  switchTab('dashboard');
}

async function bootstrap() {
  await db.init();

  if (await db.isAdminAuthenticated()) {
    await enterAdminApp();
    return;
  }

  // Configura tela de login conforme modo (Supabase Auth vs Senha Privada Local)
  const emailField = document.getElementById('loginEmailField');
  const subtitle = document.getElementById('loginSubtitle');
  const passLabel = document.getElementById('loginPasswordLabel');
  const btnSubmit = document.getElementById('btnLoginSubmit');

  if (db.mode === 'firebase') {
    emailField.hidden = false;
    document.getElementById('inputLoginEmail').required = true;
    subtitle.textContent = 'Entre com seu e-mail e senha do Firebase';
  } else if (!db.hasLocalAdminPassword()) {
    subtitle.textContent = 'Primeiro acesso: crie sua senha privada de administradora';
    passLabel.textContent = 'Crie sua Senha (mín. 4 caracteres)';
    btnSubmit.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Criar Senha e Entrar';
  }

  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await db.loginAdmin({
        email: document.getElementById('inputLoginEmail').value.trim(),
        password: document.getElementById('inputLoginPassword').value
      });
      await enterAdminApp();
    } catch (err) {
      showToast(err.message || 'Falha no login.', 'error');
    }
  });
}

bootstrap();
