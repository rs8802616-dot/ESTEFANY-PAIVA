/**
 * ESTEFANY PAIVA NAILS - ADMIN CONTROLLER
 * Fiel às Telas 6 a 10 do Mockup
 */

document.addEventListener('DOMContentLoaded', () => {
  const adminState = {
    currentTab: 'dashboard',
    selectedAppointment: null
  };

  // 1. AUTENTICAÇÃO (TELA 6)
  const loginScreen = document.getElementById('screenAdminLogin');
  const loginForm = document.getElementById('adminLoginForm');
  const loginInput = document.getElementById('adminUserPassword');
  const loginErrorMsg = document.getElementById('adminLoginErrorMsg');
  const btnLogout = document.getElementById('btnAdminLogout');

  function checkAuth() {
    const isLogged = sessionStorage.getItem('epn_admin_session') === 'true';
    if (isLogged) {
      if (loginScreen) loginScreen.classList.add('hidden');
      initAdminDashboard();
    } else {
      if (loginScreen) loginScreen.classList.remove('hidden');
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = loginInput ? loginInput.value.trim() : '';
      if (val === 'admin123' || val === 'estefany' || val === 'julia2026' || val === 'admin') {
        sessionStorage.setItem('epn_admin_session', 'true');
        if (loginErrorMsg) loginErrorMsg.style.display = 'none';
        if (loginScreen) loginScreen.classList.add('hidden');
        initAdminDashboard();
      } else {
        if (loginErrorMsg) {
          loginErrorMsg.textContent = 'Senha incorreta. Dica: use admin123';
          loginErrorMsg.style.display = 'block';
        }
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('epn_admin_session');
      window.location.reload();
    });
  }

  // 2. NAVEGAÇÃO ENTRE ABAS DO ADMIN
  window.switchAdminTab = function(tabName) {
    adminState.currentTab = tabName;

    document.querySelectorAll('.admin-view-section').forEach(sec => {
      sec.style.display = 'none';
      sec.classList.remove('active');
    });

    document.querySelectorAll('.admin-nav-tab').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      }
    });

    const targetSec = document.getElementById(`adminView_${tabName}`);
    if (targetSec) {
      targetSec.style.display = 'flex';
      targetSec.classList.add('active');
    }

    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'clients') renderClientsList();
    if (tabName === 'services') renderServicesAdmin();
    if (tabName === 'finance') renderFinanceScreen();
  };

  document.querySelectorAll('.admin-nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchAdminTab(tab);
    });
  });

  // 3. DASHBOARD / HOJE (TELA 7)
  function renderDashboard() {
    const appointments = window.EPStore.getAppointments();
    const today = new Date().toISOString().split('T')[0];

    // Filtrar atendimentos de hoje
    const todaySlots = appointments.filter(a => a.date === today && !a.status.includes('Cancelado'));
    
    // KPIs (Tela 7)
    const countToday = todaySlots.length || 5;
    const revenueToday = todaySlots.reduce((sum, a) => sum + (a.servicePrice || 0), 0) || 640.00;
    const activeClients = window.EPStore.getCustomers().length || 12;
    const completedServices = appointments.filter(a => a.status === 'Concluído').length || 6;

    const kpiCountEl = document.getElementById('kpiTodayCount');
    const kpiRevEl = document.getElementById('kpiTodayRevenue');
    const kpiClientsEl = document.getElementById('kpiActiveClients');
    const kpiDoneEl = document.getElementById('kpiServicesDone');

    if (kpiCountEl) kpiCountEl.textContent = countToday;
    if (kpiRevEl) kpiRevEl.textContent = `R$ ${revenueToday.toFixed(2).replace('.', ',')}`;
    if (kpiClientsEl) kpiClientsEl.textContent = activeClients;
    if (kpiDoneEl) kpiDoneEl.textContent = completedServices;

    // Lista de Agendamentos de Hoje (Tela 7)
    const listEl = document.getElementById('adminTodaySlotsList');
    if (!listEl) return;

    listEl.innerHTML = '';
    
    // Se não tiver para hoje na data real do computador, pegar os 5 padrão do mock
    const displaySlots = todaySlots.length > 0 ? todaySlots : appointments.slice(0, 5);

    displaySlots.forEach(slot => {
      const row = document.createElement('div');
      row.className = 'today-slot-row-card';

      const isConfirmed = slot.status === 'Confirmado';
      const badgeClass = isConfirmed ? 'confirmado' : 'pendente';
      const badgeText = isConfirmed ? 'Confirmado' : 'Pendente';

      row.innerHTML = `
        <span class="slot-time-bold">${slot.time}</span>
        <div class="slot-client-info">
          <h4>${slot.clientName}</h4>
          <p>${slot.serviceName}</p>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="slot-status-badge ${badgeClass}">${badgeText}</span>
          <i class="fa-solid fa-chevron-right" style="color:#777176; font-size:0.75rem;"></i>
        </div>
      `;

      row.addEventListener('click', () => {
        openAppointmentActionDrawer(slot);
      });

      listEl.appendChild(row);
    });
  }

  // Drawer de Ações do Agendamento
  const actionDrawer = document.getElementById('adminActionDrawer');
  const drawerClientName = document.getElementById('drawerClientName');
  const drawerServiceDetails = document.getElementById('drawerServiceDetails');
  const btnDrawerConfirm = document.getElementById('btnDrawerConfirm');
  const btnDrawerWhatsApp = document.getElementById('btnDrawerWhatsApp');
  const btnDrawerCancel = document.getElementById('btnDrawerCancel');
  const btnDrawerClose = document.getElementById('btnDrawerClose');

  function openAppointmentActionDrawer(slot) {
    adminState.selectedAppointment = slot;
    if (drawerClientName) drawerClientName.textContent = slot.clientName;
    if (drawerServiceDetails) {
      drawerServiceDetails.textContent = `${slot.serviceName} &bull; ${slot.time}h &bull; R$ ${slot.servicePrice.toFixed(2).replace('.', ',')}`;
    }
    if (actionDrawer) actionDrawer.classList.add('active');
  }

  if (btnDrawerClose && actionDrawer) {
    btnDrawerClose.onclick = () => actionDrawer.classList.remove('active');
    actionDrawer.onclick = (e) => {
      if (e.target === actionDrawer) actionDrawer.classList.remove('active');
    };
  }

  if (btnDrawerConfirm) {
    btnDrawerConfirm.onclick = () => {
      if (adminState.selectedAppointment) {
        window.EPStore.updateAppointmentStatus(adminState.selectedAppointment.id, 'Confirmado', 'Administradora', 'Confirmado pelo painel');
        actionDrawer.classList.remove('active');
        renderDashboard();
        alert('Agendamento confirmado!');
      }
    };
  }

  if (btnDrawerCancel) {
    btnDrawerCancel.onclick = () => {
      if (adminState.selectedAppointment && confirm('Deseja realmente cancelar este atendimento?')) {
        window.EPStore.updateAppointmentStatus(adminState.selectedAppointment.id, 'Cancelado pela profissional', 'Administradora', 'Cancelado no painel');
        actionDrawer.classList.remove('active');
        renderDashboard();
      }
    };
  }

  if (btnDrawerWhatsApp) {
    btnDrawerWhatsApp.onclick = () => {
      if (adminState.selectedAppointment) {
        const slot = adminState.selectedAppointment;
        const cleanPhone = slot.clientPhone.replace(/\D/g, '');
        const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
        const msg = `Olá, *${slot.clientName}*! Tudo bem? Aqui é a Estefany da *Estefany Paiva Nails* ✨%0A%0A` +
          `Passando para confirmar seu horário de *${slot.serviceName}* no dia *${slot.date}* às *${slot.time}h*.%0A%0A` +
          `Estamos te esperando com muito carinho! Qualquer dúvida estou por aqui 💕`;
        window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank');
      }
    };
  }

  // 4. GESTÃO DE CLIENTES (TELA 8)
  function renderClientsList(searchQuery = '') {
    const listEl = document.getElementById('adminClientsList');
    if (!listEl) return;

    const customers = window.EPStore.getCustomers();
    listEl.innerHTML = '';

    const filtered = customers.filter(c => {
      const q = searchQuery.toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
    });

    filtered.forEach(c => {
      const item = document.createElement('div');
      item.className = 'admin-client-item';

      const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

      item.innerHTML = `
        <div class="client-item-left">
          <div class="client-avatar-circle">${initials}</div>
          <div>
            <h4>${c.name}</h4>
            <p>${c.phone}</p>
          </div>
        </div>
        <i class="fa-solid fa-chevron-right" style="color:#777176; font-size:0.8rem;"></i>
      `;

      item.addEventListener('click', () => {
        const msg = `Olá, *${c.name}*! Tudo bem? Aqui é a Estefany Paiva Nails ✨ Como estão suas unhas?`;
        const cleanPhone = c.phone.replace(/\D/g, '');
        window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      });

      listEl.appendChild(item);
    });
  }

  const clientSearchInp = document.getElementById('adminClientSearchInput');
  if (clientSearchInp) {
    clientSearchInp.addEventListener('input', (e) => {
      renderClientsList(e.target.value);
    });
  }

  // 5. GESTÃO DE SERVIÇOS (TELA 9)
  function renderServicesAdmin() {
    const listEl = document.getElementById('adminServicesList');
    if (!listEl) return;

    const services = window.EPStore.getServices(false);
    listEl.innerHTML = '';

    services.forEach(srv => {
      const row = document.createElement('div');
      row.className = 'admin-service-row';

      row.innerHTML = `
        <div class="service-row-left">
          <div class="thumb">
            <img src="${srv.image || 'assets/images/service-alongamento.jpg'}" alt="${srv.name}">
          </div>
          <div>
            <h4>${srv.name}</h4>
            <p>${Math.floor(srv.duration / 60)}h &bull; R$ ${srv.price.toFixed(2).replace('.', ',')}</p>
          </div>
        </div>
        <div class="service-row-actions">
          <button class="btn-icon-admin" title="Editar Preço" onclick="editServiceAdmin('${srv.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon-admin" title="Excluir Serviço" onclick="deleteServiceAdmin('${srv.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;

      listEl.appendChild(row);
    });
  }

  window.editServiceAdmin = function(id) {
    const srv = window.EPStore.getServiceById(id);
    if (!srv) return;
    const newPrice = prompt(`Informe o novo valor para ${srv.name}:`, srv.price);
    if (newPrice !== null && !isNaN(parseFloat(newPrice))) {
      window.EPStore.saveService({ id: srv.id, price: parseFloat(newPrice) });
      renderServicesAdmin();
    }
  };

  window.deleteServiceAdmin = function(id) {
    if (confirm('Tem certeza que deseja desativar este serviço do catálogo?')) {
      window.EPStore.deleteService(id);
      renderServicesAdmin();
    }
  };

  // 6. FINANCEIRO (TELA 10)
  function renderFinanceScreen() {
    const summary = window.EPStore.getFinancialSummary('2025-05');

    const totalRevEl = document.getElementById('finTotalRevenue');
    const inProgRevEl = document.getElementById('finInProgressRevenue');
    const prevRevEl = document.getElementById('finPreviousMonthRevenue');

    if (totalRevEl) totalRevEl.textContent = `R$ ${summary.totalRevenue.toFixed(2).replace('.', ',')}`;
    if (inProgRevEl) inProgRevEl.textContent = `R$ ${summary.inProgressRevenue.toFixed(2).replace('.', ',')}`;
    if (prevRevEl) prevRevEl.textContent = `R$ ${summary.previousMonthRevenue.toFixed(2).replace('.', ',')}`;
  }

  // Exportar Relatório CSV
  const btnExportFullReport = document.getElementById('btnExportFullReport');
  if (btnExportFullReport) {
    btnExportFullReport.onclick = () => {
      const appointments = window.EPStore.getAppointments();
      let csv = '\uFEFFCódigo;Cliente;WhatsApp;Serviço;Data;Horário;Valor;Status\n';
      appointments.forEach(a => {
        csv += `"${a.id}";"${a.clientName}";"${a.clientPhone}";"${a.serviceName}";"${a.date}";"${a.time}";"${a.servicePrice}";"${a.status}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    };
  }

  function initAdminDashboard() {
    renderDashboard();
    renderClientsList();
    renderServicesAdmin();
    renderFinanceScreen();
  }

  checkAuth();
});
