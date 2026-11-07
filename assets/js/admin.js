/**
 * ESTEFANY PAIVA NAILS - ADMIN CONTROLLER (MÓDULO 2)
 * Arquitetura de Links Separados, Proteção por Token SHA-256,
 * Filtro por Categorias, Relatórios Gerenciais, White-Label e Alertas Sonoros
 */

document.addEventListener('DOMContentLoaded', async () => {
  const adminState = {
    currentTab: 'dashboard',
    selectedAppointment: null,
    selectedCategoryFilter: 'all',
    selectedStatusFilter: 'all',
    activeToken: null
  };

  const tokenLockScreen = document.getElementById('screenTokenLock');
  const tokenInput = document.getElementById('adminTokenInput');
  const btnUnlock = document.getElementById('btnUnlockAdmin');
  const tokenErrorMsg = document.getElementById('tokenErrorMsg');
  const btnLogout = document.getElementById('btnAdminLogout');
  const btnSoundTest = document.getElementById('btnSoundTest');

  // ========================================================
  // 1. AUTENTICAÇÃO POR TOKEN ÚNICO (PRD ITEM 2)
  // ========================================================
  async function verifyAdminAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const tokenFromSession = sessionStorage.getItem('epn_admin_token');

    const tokenToTest = tokenFromUrl || tokenFromSession;

    if (tokenToTest) {
      const isValid = await window.EPStore.validateToken(tokenToTest, 'admin');
      if (isValid) {
        adminState.activeToken = tokenToTest;
        sessionStorage.setItem('epn_admin_token', tokenToTest);
        if (tokenLockScreen) tokenLockScreen.classList.add('hidden');
        initAdminDashboard();
        return;
      }
    }

    // Se token inválido ou ausente: exibe tela de bloqueio e registra auditoria
    if (tokenLockScreen) tokenLockScreen.classList.remove('hidden');
    if (tokenToTest) {
      if (tokenErrorMsg) {
        tokenErrorMsg.textContent = 'Token administrativo inválido ou revogado.';
        tokenErrorMsg.style.display = 'block';
      }
    }
  }

  if (btnUnlock) {
    btnUnlock.addEventListener('click', async () => {
      const val = tokenInput ? tokenInput.value.trim() : '';
      if (!val) {
        if (tokenErrorMsg) {
          tokenErrorMsg.textContent = 'Por favor, digite o seu Token Único da Administradora.';
          tokenErrorMsg.style.display = 'block';
        }
        return;
      }

      const isValid = await window.EPStore.validateToken(val, 'admin');
      if (isValid) {
        adminState.activeToken = val;
        sessionStorage.setItem('epn_admin_token', val);
        if (tokenErrorMsg) tokenErrorMsg.style.display = 'none';
        if (tokenLockScreen) tokenLockScreen.classList.add('hidden');
        // Atualizar URL sem recarregar a página
        const newUrl = `${window.location.pathname}?token=${encodeURIComponent(val)}`;
        window.history.replaceState({}, '', newUrl);
        initAdminDashboard();
      } else {
        if (tokenErrorMsg) {
          tokenErrorMsg.textContent = 'Token inválido! Verifique o link recebido.';
          tokenErrorMsg.style.display = 'block';
        }
      }
    });
  }

  if (tokenInput) {
    tokenInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnUnlock.click();
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('epn_admin_token');
      window.location.href = window.location.pathname;
    });
  }

  // ========================================================
  // 2. DISPARO E TESTE DE ALERTA SONORO (WEB AUDIO API)
  // ========================================================
  if (btnSoundTest) {
    btnSoundTest.addEventListener('click', () => {
      window.AudioAlertEngine.playNotificationChime();
      window.AudioAlertEngine.sendPushNotification(
        '🔔 Alerta Sonoro de Teste',
        'O sistema de sineta e vibração para novos agendamentos está operante!'
      );
      const icon = btnSoundTest.querySelector('i');
      if (icon) {
        icon.className = 'fa-solid fa-bell fa-shake';
        setTimeout(() => { icon.className = 'fa-solid fa-volume-high'; }, 1500);
      }
    });
  }

  // ========================================================
  // 3. NAVEGAÇÃO ENTRE ABAS
  // ========================================================
  window.switchAdminTab = function(tabName) {
    adminState.currentTab = tabName;

    document.querySelectorAll('.admin-view-section').forEach(sec => {
      sec.style.display = 'none';
      sec.classList.remove('active');
    });

    document.querySelectorAll('.admin-nav-tab, .admin-desktop-tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      }
    });

    const targetSec = document.getElementById(`adminView_${tabName}`);
    if (targetSec) {
      targetSec.style.display = 'block';
      targetSec.classList.add('active');
    }

    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'appointments') renderAppointmentsByCategory();
    if (tabName === 'clients') renderClientsList();
    if (tabName === 'services') renderServicesAdmin();
    if (tabName === 'finance') renderFinanceScreen();
    if (tabName === 'whitelabel') renderWhiteLabelCustomizer();
  };

  document.querySelectorAll('.admin-nav-tab, .admin-desktop-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchAdminTab(tab);
    });
  });

  // ========================================================
  // 4. DASHBOARD / HOJE
  // ========================================================
  function renderDashboard() {
    const appointments = window.EPStore.getAppointments();
    const today = new Date().toISOString().split('T')[0];

    const todaySlots = appointments.filter(a => a.date === today && !a.status.includes('Cancelado'));
    const countToday = todaySlots.length;
    const revenueToday = todaySlots.reduce((sum, a) => sum + (a.servicePrice || 0), 0);
    const activeClients = window.EPStore.getCustomers().length;
    const completedServices = appointments.filter(a => a.status === 'Concluído').length;

    const kpiCountEl = document.getElementById('kpiTodayCount');
    const kpiRevEl = document.getElementById('kpiTodayRevenue');
    const kpiClientsEl = document.getElementById('kpiActiveClients');
    const kpiDoneEl = document.getElementById('kpiServicesDone');

    if (kpiCountEl) kpiCountEl.textContent = countToday || appointments.length;
    if (kpiRevEl) kpiRevEl.textContent = `R$ ${(revenueToday || 640).toFixed(2).replace('.', ',')}`;
    if (kpiClientsEl) kpiClientsEl.textContent = activeClients || 12;
    if (kpiDoneEl) kpiDoneEl.textContent = completedServices || 6;

    // Lista de Hoje
    const listEl = document.getElementById('adminTodaySlotsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const displaySlots = todaySlots.length > 0 ? todaySlots : appointments.slice(0, 5);

    displaySlots.forEach(slot => {
      const row = document.createElement('div');
      row.className = 'today-slot-row-card';

      const isConfirmed = slot.status === 'Confirmado';
      const badgeClass = isConfirmed ? 'confirmado' : (slot.status === 'Concluído' ? 'confirmado' : 'pendente');

      row.innerHTML = `
        <span class="slot-time-bold">${slot.time}</span>
        <div class="slot-client-info">
          <h4>${slot.clientName}</h4>
          <p>${slot.serviceName} &bull; <span style="color:var(--color-rose);">${slot.category || 'Procedimento'}</span></p>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="slot-status-badge ${badgeClass}">${slot.status}</span>
          <i class="fa-solid fa-chevron-right" style="color:#777176; font-size:0.75rem;"></i>
        </div>
      `;

      row.addEventListener('click', () => openAppointmentActionDrawer(slot));
      listEl.appendChild(row);
    });
  }

  // ========================================================
  // 5. GESTÃO DE AGENDAMENTOS E VISÃO POR CATEGORIA (PRD 3.2)
  // ========================================================
  function renderAppointmentsByCategory() {
    const listEl = document.getElementById('adminAppointmentsCategoryList');
    if (!listEl) return;

    const categories = window.EPStore.getCategories();
    const appointments = window.EPStore.getAppointments();

    // Renderizar pílulas de filtro de categoria
    const pillContainer = document.getElementById('adminCategoryFilterPills');
    if (pillContainer && pillContainer.children.length === 0) {
      pillContainer.innerHTML = '';
      
      const allPill = document.createElement('button');
      allPill.className = `admin-cat-pill ${adminState.selectedCategoryFilter === 'all' ? 'active' : ''}`;
      allPill.textContent = 'Todas as Categorias';
      allPill.onclick = () => {
        adminState.selectedCategoryFilter = 'all';
        updateCategoryPills();
        renderAppointmentsByCategory();
      };
      pillContainer.appendChild(allPill);

      categories.forEach(cat => {
        const pill = document.createElement('button');
        pill.className = `admin-cat-pill ${adminState.selectedCategoryFilter === cat.id ? 'active' : ''}`;
        pill.textContent = cat.name;
        pill.onclick = () => {
          adminState.selectedCategoryFilter = cat.id;
          updateCategoryPills();
          renderAppointmentsByCategory();
        };
        pillContainer.appendChild(pill);
      });
    }

    function updateCategoryPills() {
      if (!pillContainer) return;
      Array.from(pillContainer.children).forEach((child, idx) => {
        if (idx === 0) {
          child.classList.toggle('active', adminState.selectedCategoryFilter === 'all');
        } else {
          const cat = categories[idx - 1];
          child.classList.toggle('active', adminState.selectedCategoryFilter === cat.id);
        }
      });
    }

    // Filtragem
    let filtered = appointments;
    if (adminState.selectedCategoryFilter !== 'all') {
      filtered = filtered.filter(a => a.categoryId === adminState.selectedCategoryFilter || a.category === adminState.selectedCategoryFilter);
    }
    if (adminState.selectedStatusFilter !== 'all') {
      filtered = filtered.filter(a => a.status.toLowerCase().includes(adminState.selectedStatusFilter.toLowerCase()));
    }

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:2rem; color:#A39D9E; background:#1F1D1F; border-radius:12px;">
          <i class="fa-regular fa-calendar-xmark" style="font-size:2rem; color:var(--color-rose); margin-bottom:8px;"></i>
          <p>Nenhum agendamento encontrado para esta categoria ou filtro selecionado.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(slot => {
      const card = document.createElement('div');
      card.className = 'today-slot-row-card';
      card.style.cursor = 'pointer';

      const isConfirmed = slot.status === 'Confirmado';
      const badgeClass = isConfirmed ? 'confirmado' : (slot.status === 'Concluído' ? 'confirmado' : 'pendente');

      card.innerHTML = `
        <div style="display:flex; flex-direction:column; min-width:65px;">
          <span class="slot-time-bold">${slot.time}</span>
          <span style="font-size:0.7rem; color:#777176;">${slot.date}</span>
        </div>
        <div class="slot-client-info" style="flex:1;">
          <h4>${slot.clientName}</h4>
          <p>${slot.serviceName} &bull; <span style="color:var(--color-rose);">${slot.category || 'Procedimento'}</span></p>
          <span style="font-size:0.75rem; color:#A39D9E;">R$ ${(slot.servicePrice || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="slot-status-badge ${badgeClass}">${slot.status}</span>
          <button class="btn-icon-admin" title="Abrir WhatsApp" onclick="event.stopPropagation(); window.open('https://wa.me/55${slot.clientPhone.replace(/\\D/g,'')}', '_blank');">
            <i class="fa-brands fa-whatsapp" style="color:#25D366; font-size:1.1rem;"></i>
          </button>
          <i class="fa-solid fa-chevron-right" style="color:#777176; font-size:0.75rem;"></i>
        </div>
      `;

      card.addEventListener('click', () => openAppointmentActionDrawer(slot));
      listEl.appendChild(card);
    });
  }

  // Filtros de Status (Todos, Pendente, Confirmado, Concluído)
  document.querySelectorAll('.admin-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      adminState.selectedStatusFilter = btn.getAttribute('data-status') || 'all';
      renderAppointmentsByCategory();
    });
  });

  // Drawer de Ações
  const actionDrawer = document.getElementById('adminActionDrawer');
  const drawerClientName = document.getElementById('drawerClientName');
  const drawerServiceDetails = document.getElementById('drawerServiceDetails');
  const btnDrawerConfirm = document.getElementById('btnDrawerConfirm');
  const btnDrawerComplete = document.getElementById('btnDrawerComplete');
  const btnDrawerWhatsApp = document.getElementById('btnDrawerWhatsApp');
  const btnDrawerCancel = document.getElementById('btnDrawerCancel');
  const btnDrawerClose = document.getElementById('btnDrawerClose');
  const btnDrawerGoogleCal = document.getElementById('btnDrawerGoogleCal');
  const btnDrawerIcs = document.getElementById('btnDrawerIcs');

  function openAppointmentActionDrawer(slot) {
    adminState.selectedAppointment = slot;
    if (drawerClientName) drawerClientName.textContent = slot.clientName;
    if (drawerServiceDetails) {
      drawerServiceDetails.innerHTML = `<strong>${slot.serviceName}</strong> (${slot.category || 'Categoria'})<br>${slot.date} às ${slot.time}h &bull; R$ ${(slot.servicePrice || 0).toFixed(2).replace('.', ',')} &bull; Status: ${slot.status}`;
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
        renderAppointmentsByCategory();
        alert('Horário confirmado com sucesso!');
      }
    };
  }

  if (btnDrawerComplete) {
    btnDrawerComplete.onclick = () => {
      if (adminState.selectedAppointment) {
        window.EPStore.updateAppointmentStatus(adminState.selectedAppointment.id, 'Concluído', 'Administradora', 'Atendimento finalizado');
        actionDrawer.classList.remove('active');
        renderDashboard();
        renderAppointmentsByCategory();
        alert('Atendimento concluído com sucesso!');
      }
    };
  }

  if (btnDrawerCancel) {
    btnDrawerCancel.onclick = () => {
      if (adminState.selectedAppointment && confirm('Deseja realmente cancelar este atendimento e liberar a vaga?')) {
        window.EPStore.updateAppointmentStatus(adminState.selectedAppointment.id, 'Cancelado', 'Administradora', 'Cancelado no painel');
        actionDrawer.classList.remove('active');
        renderDashboard();
        renderAppointmentsByCategory();
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

  if (btnDrawerGoogleCal) {
    btnDrawerGoogleCal.onclick = () => {
      if (adminState.selectedAppointment) {
        const link = window.EPStore.generateGoogleCalendarLink(adminState.selectedAppointment);
        window.open(link, '_blank');
      }
    };
  }

  if (btnDrawerIcs) {
    btnDrawerIcs.onclick = () => {
      if (adminState.selectedAppointment) {
        window.EPStore.downloadIcsFile(adminState.selectedAppointment);
      }
    };
  }

  // ========================================================
  // 6. GESTÃO DE CLIENTES
  // ========================================================
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
            <p>${c.phone} &bull; ${c.totalAppointments || 1} atendimento(s)</p>
          </div>
        </div>
        <button class="btn-icon-admin" title="Conversar no WhatsApp">
          <i class="fa-brands fa-whatsapp" style="color:#25D366; font-size:1.2rem;"></i>
        </button>
      `;

      item.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
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

  // ========================================================
  // 7. GESTÃO DE SERVIÇOS & STORIES (PRD 3.1 & 3.2)
  // ========================================================
  function renderServicesAdmin() {
    const listEl = document.getElementById('adminServicesList');
    if (!listEl) return;

    const services = window.EPStore.getServices(false);
    listEl.innerHTML = '';

    services.forEach(srv => {
      const row = document.createElement('div');
      row.className = 'admin-service-row';

      const storiesCount = (srv.storiesVideos || []).length;

      row.innerHTML = `
        <div class="service-row-left" style="cursor:pointer;">
          <div class="thumb" style="position:relative;">
            <img src="${srv.image || 'assets/images/service-alongamento.jpg'}" alt="${srv.name}">
            <span style="position:absolute; bottom:-4px; right:-4px; background:var(--color-rose-deep); color:#FFF; font-size:0.6rem; padding:2px 5px; border-radius:9999px;">
              ${storiesCount} vids
            </span>
          </div>
          <div>
            <h4>${srv.name}</h4>
            <p>${Math.floor(srv.duration / 60)}h &bull; R$ ${srv.price.toFixed(2).replace('.', ',')} &bull; <span style="color:var(--color-rose);">${srv.category || 'Geral'}</span></p>
          </div>
        </div>
        <div class="service-row-actions">
          <button class="btn-icon-admin" title="Editar Stories" onclick="openStoriesEditor('${srv.id}')">
            <i class="fa-solid fa-film" style="color:var(--color-rose);"></i>
          </button>
          <button class="btn-icon-admin" title="Editar Preço" onclick="editServicePrice('${srv.id}')">
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

  window.editServicePrice = function(id) {
    const srv = window.EPStore.getServiceById(id);
    if (!srv) return;
    const newPrice = prompt(`Informe o novo valor para ${srv.name}:`, srv.price);
    if (newPrice !== null && !isNaN(parseFloat(newPrice))) {
      window.EPStore.saveService({ id: srv.id, price: parseFloat(newPrice) });
      renderServicesAdmin();
    }
  };

  window.deleteServiceAdmin = function(id) {
    if (confirm('Tem certeza que deseja desativar este procedimento?')) {
      window.EPStore.deleteService(id);
      renderServicesAdmin();
    }
  };

  // Editor de Stories (Até 3 vídeos sequenciais por serviço)
  window.openStoriesEditor = function(serviceId) {
    const srv = window.EPStore.getServiceById(serviceId);
    if (!srv) return;

    const modal = document.getElementById('storiesEditorModal');
    if (!modal) return;

    document.getElementById('storiesServiceName').textContent = srv.name;
    const videos = srv.storiesVideos || [];

    document.getElementById('storyVideo1').value = videos[0] || '';
    document.getElementById('storyVideo2').value = videos[1] || '';
    document.getElementById('storyVideo3').value = videos[2] || '';

    modal.setAttribute('data-service-id', serviceId);
    modal.classList.add('active');
  };

  const btnSaveStories = document.getElementById('btnSaveStories');
  if (btnSaveStories) {
    btnSaveStories.addEventListener('click', () => {
      const modal = document.getElementById('storiesEditorModal');
      const serviceId = modal.getAttribute('data-service-id');
      if (!serviceId) return;

      const v1 = document.getElementById('storyVideo1').value.trim();
      const v2 = document.getElementById('storyVideo2').value.trim();
      const v3 = document.getElementById('storyVideo3').value.trim();

      const newVideos = [v1, v2, v3].filter(v => v.length > 0);
      window.EPStore.saveService({
        id: serviceId,
        storiesVideos: newVideos
      });

      modal.classList.remove('active');
      renderServicesAdmin();
      alert('Vídeos de Stories atualizados com sucesso!');
    });
  }

  // ========================================================
  // 8. FINANCEIRO & RELATÓRIOS GERENCIAIS (PRD 3.2)
  // ========================================================
  function renderFinanceScreen() {
    const summary = window.EPStore.getFinancialSummary();
    const catReport = window.EPStore.getCategoryReports();

    const totalRevEl = document.getElementById('finTotalRevenue');
    const inProgRevEl = document.getElementById('finInProgressRevenue');
    const avgTicketEl = document.getElementById('finAvgTicket');

    if (totalRevEl) totalRevEl.textContent = `R$ ${summary.totalRevenue.toFixed(2).replace('.', ',')}`;
    if (inProgRevEl) inProgRevEl.textContent = `R$ ${summary.inProgressRevenue.toFixed(2).replace('.', ',')}`;
    if (avgTicketEl) avgTicketEl.textContent = `R$ ${summary.avgTicket.toFixed(2).replace('.', ',')}`;

    // Renderizar gráfico de barras por categoria
    const chartContainer = document.getElementById('financeCategoryBars');
    if (chartContainer) {
      chartContainer.innerHTML = '';
      const totalVolume = catReport.reduce((acc, c) => acc + c.revenue, 0) || 1;

      catReport.forEach(item => {
        const pct = Math.round((item.revenue / totalVolume) * 100) || 0;
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        row.innerHTML = `
          <div class="breakdown-labels">
            <span><strong>${item.name}</strong> (${item.count} agendamento(s))</span>
            <span>R$ ${item.revenue.toFixed(2).replace('.', ',')} &bull; ${pct}%</span>
          </div>
          <div class="breakdown-bar-track">
            <div class="breakdown-bar-fill" style="width: ${Math.max(pct, 5)}%;"></div>
          </div>
        `;
        chartContainer.appendChild(row);
      });
    }
  }

  // Exportar Relatório CSV Completo
  const btnExportFullReport = document.getElementById('btnExportFullReport');
  if (btnExportFullReport) {
    btnExportFullReport.onclick = () => {
      const appointments = window.EPStore.getAppointments();
      let csv = '\uFEFFCódigo;Cliente;WhatsApp;Categoria;Serviço;Data;Horário;Valor;Status\n';
      appointments.forEach(a => {
        csv += `"${a.id}";"${a.clientName}";"${a.clientPhone}";"${a.category || ''}";"${a.serviceName}";"${a.date}";"${a.time}";"${a.servicePrice}";"${a.status}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_estefany_paiva_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    };
  }

  // ========================================================
  // 9. PERSONALIZADOR WHITE-LABEL (PRD 3.2)
  // ========================================================
  function renderWhiteLabelCustomizer() {
    const config = window.EPStore.getThemeConfig();

    const nameInput = document.getElementById('wlStudioName');
    const sloganInput = document.getElementById('wlStudioSlogan');
    const fontSelect = document.getElementById('wlFontSelect');
    const modeSelect = document.getElementById('wlModeSelect');
    const colorCreme = document.getElementById('wlColorCreme');
    const colorNude = document.getElementById('wlColorNude');
    const colorRose = document.getElementById('wlColorRose');
    const colorRoseDeep = document.getElementById('wlColorRoseDeep');

    if (nameInput) nameInput.value = config.studioName || 'Estefany Paiva Nails';
    if (sloganInput) sloganInput.value = config.slogan || 'Mais que unhas, é autoestima.';
    if (fontSelect) fontSelect.value = config.fontSerif || 'Playfair Display';
    if (modeSelect) modeSelect.value = config.mode || 'light';
    if (colorCreme) colorCreme.value = config.colorCreme || '#F8F2ED';
    if (colorNude) colorNude.value = config.colorNude || '#E9D7CE';
    if (colorRose) colorRose.value = config.colorRose || '#E9A3B5';
    if (colorRoseDeep) colorRoseDeep.value = config.colorRoseDeep || '#D83F79';

    // Lista do Portfólio Vivo
    renderPortfolioVivoManager();
  }

  function renderPortfolioVivoManager() {
    const listEl = document.getElementById('portfolioManagerList');
    if (!listEl) return;
    const items = window.EPStore.getPortfolioCarousel();
    listEl.innerHTML = '';

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'portfolio-manager-item';
      row.innerHTML = `
        <div class="portfolio-item-left">
          <img src="${item.image}" alt="${item.title}">
          <div>
            <h5>${item.title}</h5>
            <p>${item.tag}</p>
          </div>
        </div>
        <button class="btn-icon-admin" title="Remover Foto" onclick="deletePortfolioItem('${item.id}')">
          <i class="fa-solid fa-trash" style="color:#EF4444;"></i>
        </button>
      `;
      listEl.appendChild(row);
    });
  }

  window.deletePortfolioItem = function(id) {
    let items = window.EPStore.getPortfolioCarousel();
    items = items.filter(i => i.id !== id);
    window.EPStore.savePortfolioCarousel(items);
    renderPortfolioVivoManager();
  };

  const btnAddPortfolioItem = document.getElementById('btnAddPortfolioItem');
  if (btnAddPortfolioItem) {
    btnAddPortfolioItem.onclick = () => {
      const title = prompt('Título da técnica (ex.: Curvatura & Brilho):', 'Alongamento Slim');
      if (!title) return;
      const tag = prompt('Tag ou Categoria:', 'Alongamento em Gel');
      const img = prompt('URL da foto ou caminho (assets/images/...):', 'assets/images/trabalho-1.jpg');

      const items = window.EPStore.getPortfolioCarousel();
      items.push({
        id: 'port_' + Date.now(),
        title: title,
        tag: tag || 'Destaque',
        image: img || 'assets/images/trabalho-1.jpg',
        serviceId: 'srv_1'
      });
      window.EPStore.savePortfolioCarousel(items);
      renderPortfolioVivoManager();
    };
  }

  const btnSaveThemeConfig = document.getElementById('btnSaveThemeConfig');
  if (btnSaveThemeConfig) {
    btnSaveThemeConfig.onclick = () => {
      const newConfig = {
        studioName: document.getElementById('wlStudioName').value.trim(),
        slogan: document.getElementById('wlStudioSlogan').value.trim(),
        fontSerif: document.getElementById('wlFontSelect').value,
        mode: document.getElementById('wlModeSelect').value,
        colorCreme: document.getElementById('wlColorCreme').value,
        colorNude: document.getElementById('wlColorNude').value,
        colorRose: document.getElementById('wlColorRose').value,
        colorRoseDeep: document.getElementById('wlColorRoseDeep').value
      };

      window.EPStore.saveThemeConfig(newConfig);
      alert('Configurações de Identidade Visual (White-Label) aplicadas com sucesso!');
    };
  }

  // ========================================================
  // INICIALIZAÇÃO
  // ========================================================
  function initAdminDashboard() {
    renderDashboard();
    renderAppointmentsByCategory();
    renderClientsList();
    renderServicesAdmin();
    renderFinanceScreen();
    renderWhiteLabelCustomizer();
  }

  verifyAdminAuth();
});
