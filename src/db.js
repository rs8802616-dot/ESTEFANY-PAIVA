/**
 * Camada de Dados Unificada (Supabase Cloud + Fallback Local Seguro)
 * Zero senhas em texto puro, zero vazamento em canais públicos.
 */
import { APP_CONFIG } from './config.js';
import { cleanPhoneDigits, timeToMinutes, sha256 } from './utils.js';

const KEYS = {
  SETTINGS: 'epn_salon_settings',
  CATEGORIES: 'epn_categories',
  SERVICES: 'epn_services_with_stories',
  APPOINTMENTS: 'epn_appointments_lgpd',
  BLOCKS: 'epn_personal_busy_blocks',
  TECH_NOTES: 'epn_client_tech_notes',
  ADMIN_AUTH_HASH: 'epn_admin_private_pass_hash'
};

let supabaseClient = null;
let isCloudMode = false;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const db = {
  get mode() {
    return isCloudMode ? 'supabase' : 'local';
  },

  async init() {
    if (APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY) {
      try {
        const mod = await import('https://esm.sh/@supabase/supabase-js@2');
        supabaseClient = mod.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
        isCloudMode = true;
      } catch (err) {
        console.warn('Supabase indisponível, operando em modo local:', err);
        isCloudMode = false;
      }
    }

    // Seed inicial apenas se ainda não existir nada salvo localmente
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      writeJSON(KEYS.SETTINGS, { ...APP_CONFIG.DEFAULT_SALON });
    }
    if (!localStorage.getItem(KEYS.CATEGORIES)) {
      writeJSON(KEYS.CATEGORIES, [...APP_CONFIG.DEFAULT_CATEGORIES]);
    }
    if (!localStorage.getItem(KEYS.SERVICES)) {
      writeJSON(KEYS.SERVICES, [...APP_CONFIG.DEFAULT_SERVICES]);
    }
    if (!localStorage.getItem(KEYS.APPOINTMENTS)) {
      writeJSON(KEYS.APPOINTMENTS, []);
    }
    if (!localStorage.getItem(KEYS.BLOCKS)) {
      writeJSON(KEYS.BLOCKS, []);
    }
    if (!localStorage.getItem(KEYS.TECH_NOTES)) {
      writeJSON(KEYS.TECH_NOTES, {});
    }
  },

  // ========================================================
  // AUTENTICAÇÃO DO ADMIN (Supabase Auth ou Senha Privada Local)
  // ========================================================
  hasLocalAdminPassword() {
    return Boolean(localStorage.getItem(KEYS.ADMIN_AUTH_HASH));
  },

  async setupLocalAdminPassword(password) {
    const hash = await sha256(`epn_salt_v34:${password}`);
    localStorage.setItem(KEYS.ADMIN_AUTH_HASH, hash);
    sessionStorage.setItem('epn_admin_session', '1');
    return true;
  },

  async loginAdmin({ email, password }) {
    if (isCloudMode && supabaseClient) {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message || 'Credenciais inválidas.');
      return true;
    }
    const savedHash = localStorage.getItem(KEYS.ADMIN_AUTH_HASH);
    if (!savedHash) {
      return this.setupLocalAdminPassword(password);
    }
    const inputHash = await sha256(`epn_salt_v34:${password}`);
    if (inputHash !== savedHash) {
      throw new Error('Senha incorreta.');
    }
    sessionStorage.setItem('epn_admin_session', '1');
    return true;
  },

  async isAdminAuthenticated() {
    if (isCloudMode && supabaseClient) {
      const { data } = await supabaseClient.auth.getSession();
      return Boolean(data?.session);
    }
    return sessionStorage.getItem('epn_admin_session') === '1';
  },

  async logoutAdmin() {
    if (isCloudMode && supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    sessionStorage.removeItem('epn_admin_session');
  },

  // ========================================================
  // CONFIGURAÇÕES DO ESTÚDIO
  // ========================================================
  async getSettings() {
    if (isCloudMode && supabaseClient) {
      const { data } = await supabaseClient.from('salon_settings').select('data').eq('id', 'main').maybeSingle();
      if (data?.data) {
        const merged = { ...APP_CONFIG.DEFAULT_SALON, ...data.data };
        writeJSON(KEYS.SETTINGS, merged);
        return merged;
      }
    }
    return { ...APP_CONFIG.DEFAULT_SALON, ...readJSON(KEYS.SETTINGS, {}) };
  },

  async saveSettings(partial) {
    const current = await this.getSettings();
    const updated = { ...current, ...partial, updatedAt: new Date().toISOString() };
    writeJSON(KEYS.SETTINGS, updated);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('salon_settings').upsert({ id: 'main', data: updated });
    }
    return updated;
  },

  // ========================================================
  // CATEGORIAS
  // ========================================================
  async getCategories() {
    if (isCloudMode && supabaseClient) {
      const { data } = await supabaseClient.from('categories').select('*').order('name');
      if (Array.isArray(data) && data.length > 0) {
        writeJSON(KEYS.CATEGORIES, data);
        return data;
      }
    }
    return readJSON(KEYS.CATEGORIES, [...APP_CONFIG.DEFAULT_CATEGORIES]);
  },

  async saveCategory(cat) {
    const list = await this.getCategories();
    const item = { id: cat.id || `cat_${Date.now()}`, name: cat.name.trim() };
    const idx = list.findIndex(c => c.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    writeJSON(KEYS.CATEGORIES, list);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('categories').upsert(item);
    }
    return list;
  },

  async deleteCategory(id) {
    const list = (await this.getCategories()).filter(c => c.id !== id);
    writeJSON(KEYS.CATEGORIES, list);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('categories').delete().eq('id', id);
    }
    return list;
  },

  // ========================================================
  // SERVIÇOS
  // ========================================================
  async getServices(onlyActive = false) {
    let list;
    if (isCloudMode && supabaseClient) {
      const { data } = await supabaseClient.from('services').select('*').order('name');
      if (Array.isArray(data)) {
        writeJSON(KEYS.SERVICES, data);
        list = data;
      }
    }
    if (!list) list = readJSON(KEYS.SERVICES, [...APP_CONFIG.DEFAULT_SERVICES]);
    return onlyActive ? list.filter(s => s.active !== false) : list;
  },

  async saveService(srv) {
    const list = await this.getServices(false);
    const item = {
      id: srv.id || `srv_${Date.now()}`,
      name: srv.name.trim(),
      categoryId: srv.categoryId || 'cat_alongamento',
      price: Number(srv.price) || 0,
      duration: parseInt(srv.duration, 10) || 90,
      description: (srv.description || '').trim(),
      image: srv.image || 'assets/images/trabalho-alongamento-chocolate.png',
      active: srv.active !== false
    };
    const idx = list.findIndex(s => s.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    writeJSON(KEYS.SERVICES, list);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('services').upsert(item);
    }
    return item;
  },

  async deleteService(id) {
    const list = (await this.getServices(false)).filter(s => s.id !== id);
    writeJSON(KEYS.SERVICES, list);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('services').delete().eq('id', id);
    }
    return list;
  },

  // ========================================================
  // AGENDAMENTOS & BLOQUEIO INTELIGENTE POR DURAÇÃO
  // ========================================================
  async getAppointments() {
    if (isCloudMode && supabaseClient) {
      const { data } = await supabaseClient
        .from('appointments')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: true });
      if (Array.isArray(data)) {
        writeJSON(KEYS.APPOINTMENTS, data);
        return data;
      }
    }
    return readJSON(KEYS.APPOINTMENTS, []);
  },

  async getPersonalBlocks() {
    if (isCloudMode && supabaseClient) {
      const { data } = await supabaseClient.from('personal_blocks').select('*').order('date');
      if (Array.isArray(data)) {
        writeJSON(KEYS.BLOCKS, data);
        return data;
      }
    }
    return readJSON(KEYS.BLOCKS, []);
  },

  async addPersonalBlock(block) {
    const list = await this.getPersonalBlocks();
    const item = {
      id: block.id || `blk_${Date.now()}`,
      title: (block.title || 'Compromisso Pessoal').trim(),
      date: block.date,
      startTime: block.startTime || '09:00',
      endTime: block.endTime || '18:00',
      allDay: Boolean(block.allDay)
    };
    list.unshift(item);
    writeJSON(KEYS.BLOCKS, list);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('personal_blocks').upsert(item);
    }
    return item;
  },

  async deletePersonalBlock(id) {
    const list = (await this.getPersonalBlocks()).filter(b => b.id !== id);
    writeJSON(KEYS.BLOCKS, list);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('personal_blocks').delete().eq('id', id);
    }
    return list;
  },

  async isDateOpen(dateStr) {
    const settings = await this.getSettings();
    if (!dateStr || !dateStr.includes('-')) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (target < today) return false;

    const workingDays = Array.isArray(settings.workingDays) ? settings.workingDays : [1, 2, 3, 4, 5, 6];
    if (!workingDays.includes(target.getDay())) return false;

    const blocked = Array.isArray(settings.blockedDates) ? settings.blockedDates : [];
    if (blocked.includes(dateStr)) return false;

    return true;
  },

  async getAvailableSlots(dateStr, durationMinutes = 90, ignoreAppId = '') {
    const open = await this.isDateOpen(dateStr);
    if (!open) return [];

    const [settings, appointments, blocks] = await Promise.all([
      this.getSettings(),
      this.getAppointments(),
      this.getPersonalBlocks()
    ]);

    const slots = Array.isArray(settings.configuredSlots) && settings.configuredSlots.length > 0
      ? settings.configuredSlots
      : APP_CONFIG.DEFAULT_SALON.configuredSlots;

    const dayApps = appointments.filter(a =>
      a.date === dateStr &&
      a.status !== 'Cancelado' &&
      (!ignoreAppId || a.id !== ignoreAppId)
    );
    const dayBlocks = blocks.filter(b => b.date === dateStr);
    const reqDur = Math.max(30, parseInt(durationMinutes, 10) || 90);

    return slots.filter(slot => {
      const sStart = timeToMinutes(slot);
      const sEnd = sStart + reqDur;

      for (const blk of dayBlocks) {
        if (blk.allDay) return false;
        const bStart = timeToMinutes(blk.startTime);
        const bEnd = timeToMinutes(blk.endTime);
        if (sStart < bEnd && sEnd > bStart) return false;
      }

      for (const app of dayApps) {
        if (app.time === slot) return false;
        const aStart = timeToMinutes(app.time);
        const aEnd = aStart + Math.max(30, parseInt(app.duration, 10) || 90);
        if (sStart < aEnd && sEnd > aStart) return false;
      }

      return true;
    });
  },

  async createAppointment(input) {
    const newApp = {
      id: `EP-${Date.now().toString().slice(-6)}`,
      clientName: input.clientName.trim(),
      clientPhone: input.clientPhone.trim(),
      serviceId: input.serviceId || '',
      serviceName: input.serviceName,
      servicePrice: Number(input.servicePrice) || 0,
      duration: parseInt(input.duration, 10) || 90,
      date: input.date,
      time: input.time,
      status: input.status || 'Confirmado',
      createdAt: new Date().toISOString()
    };
    const list = await this.getAppointments();
    list.unshift(newApp);
    writeJSON(KEYS.APPOINTMENTS, list);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('appointments').insert(newApp);
    }
    return newApp;
  },

  async updateAppointment(id, updates) {
    const list = await this.getAppointments();
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const updated = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    list[idx] = updated;
    writeJSON(KEYS.APPOINTMENTS, list);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('appointments').update(updated).eq('id', id);
    }
    return updated;
  },

  canClientReschedule(app, minHours = 12) {
    if (!app || !app.date || !app.time) return { allowed: false, minHours };
    if (app.status === 'Cancelado' || app.status === 'Concluído') return { allowed: false, minHours };
    const [y, m, d] = app.date.split('-').map(Number);
    const [hh, mm] = app.time.split(':').map(Number);
    const appDate = new Date(y, m - 1, d, hh, mm);
    const diffHours = (appDate.getTime() - Date.now()) / 3600000;
    return { allowed: diffHours >= minHours, minHours, hoursLeft: Math.max(0, Math.round(diffHours)) };
  },

  // ========================================================
  // FICHA TÉCNICA DA CLIENTE
  // ========================================================
  async getClientTechNotes(phone) {
    const key = cleanPhoneDigits(phone);
    const empty = { nailShape: '', favoriteColor: '', allergies: '', notes: '' };
    if (!key) return empty;

    if (isCloudMode && supabaseClient) {
      const { data } = await supabaseClient.from('client_tech_notes').select('*').eq('phoneKey', key).maybeSingle();
      if (data) return data;
    }
    const map = readJSON(KEYS.TECH_NOTES, {});
    return map[key] || empty;
  },

  async saveClientTechNotes(phone, notesObj) {
    const key = cleanPhoneDigits(phone);
    if (!key) return null;
    const record = {
      phoneKey: key,
      nailShape: (notesObj.nailShape || '').trim(),
      favoriteColor: (notesObj.favoriteColor || '').trim(),
      allergies: (notesObj.allergies || '').trim(),
      notes: (notesObj.notes || '').trim(),
      updatedAt: new Date().toISOString()
    };
    const map = readJSON(KEYS.TECH_NOTES, {});
    map[key] = record;
    writeJSON(KEYS.TECH_NOTES, map);
    if (isCloudMode && supabaseClient) {
      await supabaseClient.from('client_tech_notes').upsert(record);
    }
    return record;
  }
};
