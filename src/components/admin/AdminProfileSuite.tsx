import React, { useEffect, useState } from 'react';
import {
  Camera, Plus, MessageSquare, User, Clock, Sliders, Palette, ShieldCheck,
  HelpCircle, Trash2, Send, CheckCircle2, Lock, KeyRound, Smartphone,
  ChevronRight, ExternalLink, Copy, Upload, Layers, RefreshCw, X
} from 'lucide-react';
import type { SalonSettings, ClientProfileSummary, Appointment, Service } from '../../types/salon';
import { adminSaveSettings } from '../../lib/db';
import { buildWhatsAppUrl, compressImageToDataUrl, formatDateBR, minutesToTime, timeToMinutes } from '../../lib/utils';
import { useToast } from '../Toast';
import { LuxuryStateView } from '../ui/LuxuryDesignSystem';
import { MANDATORY_SCREENS_33 } from '../../theme/luxuryNudeTheme';
import { resetAdminPassword, signOutUser } from '../../lib/firebase';
import { clearAdminGateSession } from '../../lib/adminRoute';

export type ProfileScreenId = 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33;

interface GalleryPhoto {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  createdAt: string;
}

const DEFAULT_GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    id: 'gal-1',
    title: 'Alongamento Fibra Natural Nude',
    category: 'Alongamento',
    imageUrl: '/src/assets/images/service-alongamento.jpg',
    createdAt: '2026-11-01',
  },
  {
    id: 'gal-2',
    title: 'Banho de Gel Natural',
    category: 'Banho de Gel',
    imageUrl: '/src/assets/images/service-banho.jpg',
    createdAt: '2026-11-03',
  },
  {
    id: 'gal-3',
    title: 'Esmaltação em Gel Clássica',
    category: 'Gel',
    imageUrl: '/src/assets/images/service-esmaltacao.jpg',
    createdAt: '2026-11-05',
  },
  {
    id: 'gal-4',
    title: 'Spa dos Pés e Pedicure',
    category: 'Spa',
    imageUrl: '/src/assets/images/service-spa.jpg',
    createdAt: '2026-11-07',
  },
];

const GALLERY_STORAGE_KEY = 'ep_nails_luxury_gallery_v1';

function loadGallery(): GalleryPhoto[] {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) return DEFAULT_GALLERY_PHOTOS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_GALLERY_PHOTOS;
  } catch {
    return DEFAULT_GALLERY_PHOTOS;
  }
}

interface Props {
  settings: SalonSettings;
  clients: ClientProfileSummary[];
  appointments: Appointment[];
  services: Service[];
  activeSubScreen?: ProfileScreenId;
  onSelectSubScreen?: (id: ProfileScreenId) => void;
  onJumpToAnyScreen?: (screenId: number) => void;
  adminEmail?: string;
}

const PROFILE_SCREENS: { id: ProfileScreenId; number: number; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 28, number: 28, label: 'Configurações do Studio', icon: Sliders },
  { id: 25, number: 25, label: 'Galeria', icon: Camera },
  { id: 26, number: 26, label: 'Adicionar Foto', icon: Plus },
  { id: 27, number: 27, label: 'WhatsApp', icon: MessageSquare },
  { id: 32, number: 32, label: 'Segurança', icon: ShieldCheck },
  { id: 33, number: 33, label: 'Ajuda', icon: HelpCircle },
];

const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 0, label: 'Domingo', short: 'Dom' },
];

export const AdminProfileSuite: React.FC<Props> = ({
  settings,
  clients,
  activeSubScreen,
  onSelectSubScreen,
  onJumpToAnyScreen,
  adminEmail,
}) => {
  const { showToast } = useToast();
  const [internalScreen, setInternalScreen] = useState<ProfileScreenId>(28);
  const currentScreen = activeSubScreen || internalScreen;

  const isUnifiedSettings = currentScreen === 28 || currentScreen === 29 || currentScreen === 30 || currentScreen === 31;

  useEffect(() => {
    const targetId =
      currentScreen === 29
        ? 'cfg-horarios'
        : currentScreen === 30
          ? 'cfg-agenda-pix'
          : currentScreen === 31
            ? 'cfg-pagina-publica'
            : null;
    if (targetId) {
      setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }, [currentScreen]);

  const setScreen = (id: ProfileScreenId) => {
    setInternalScreen(id);
    onSelectSubScreen?.(id);
  };

  // Gallery State (Screens 25 & 26)
  const [gallery, setGallery] = useState<GalleryPhoto[]>(loadGallery);
  const [galleryFilter, setGalleryFilter] = useState('Todas');
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [newPhotoCategory, setNewPhotoCategory] = useState('Alongamento');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  // Communication State (Screen 27)
  const [selectedClientPhone, setSelectedClientPhone] = useState(clients[0]?.clientPhone || '');
  const [selectedClientName, setSelectedClientName] = useState(clients[0]?.clientName || 'Cliente VIP');
  const [customMessage, setCustomMessage] = useState(
    'Olá! Tudo bem? Passando para confirmar seu horário especial no Studio Estefany Paiva Nails ✨'
  );

  // Settings Form State (Screens 28, 29, 30, 31)
  const [form, setForm] = useState<SalonSettings>(settings);
  const [scheduleMode, setScheduleMode] = useState<'interval' | 'fixed'>(() =>
    settings.configuredSlots && settings.configuredSlots.length > 0 ? 'fixed' : 'interval',
  );
  const [slotsText, setSlotsText] = useState((settings.configuredSlots || []).join(', '));
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Sincroniza o formulário sempre que settings atualizar
  useEffect(() => {
    setForm(settings);
    setScheduleMode(settings.configuredSlots && settings.configuredSlots.length > 0 ? 'fixed' : 'interval');
    setSlotsText((settings.configuredSlots || []).join(', '));
  }, [settings]);

  // Sincroniza a cliente inicial da Central de Comunicação quando a lista carregar
  useEffect(() => {
    if (!selectedClientPhone && clients.length > 0) {
      setSelectedClientPhone(clients[0].clientPhone);
      setSelectedClientName(clients[0].clientName);
    }
  }, [clients, selectedClientPhone]);

  const saveGallery = (next: GalleryPhoto[]) => {
    setGallery(next);
    try {
      localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      showToast('Limite de memória local atingido para fotos.', 'error');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageToDataUrl(file, 720, 0.78);
      setNewPhotoUrl(base64);
      showToast('Fotografia otimizada em alta definição!', 'success');
    } catch {
      showToast('Erro ao carregar fotografia.', 'error');
    }
  };

  const handleAddGalleryPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoTitle.trim() || !newPhotoUrl.trim()) {
      showToast('Informe o título e selecione uma fotografia.', 'error');
      return;
    }
    const item: GalleryPhoto = {
      id: `gal-${Date.now()}`,
      title: newPhotoTitle.trim(),
      category: newPhotoCategory,
      imageUrl: newPhotoUrl.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    saveGallery([item, ...gallery]);
    setNewPhotoTitle('');
    setNewPhotoUrl('');
    showToast('Foto publicada na galeria!', 'success');
    setScreen(25);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalSlots: string[] = [];
      if (scheduleMode === 'fixed') {
        const parsedSlots = slotsText
          .split(',')
          .map(s => {
            const t = s.trim();
            return /^\d:\d{2}$/.test(t) ? `0${t}` : t;
          })
          .filter(s => /^\d{2}:\d{2}$/.test(s));

        if (parsedSlots.length === 0) {
          showToast('Informe pelo menos um horário fixo válido (ex.: 08:30, 10:30) ou use o modo Horários Corridos.', 'error');
          setSaving(false);
          return;
        }
        finalSlots = parsedSlots;
      }

      const updatedForm: SalonSettings = {
        ...form,
        configuredSlots: finalSlots,
      };
      setForm(updatedForm);
      setSlotsText(finalSlots.join(', '));
      await adminSaveSettings(updatedForm);
      showToast('Configurações salvas!', 'success');
    } catch {
      showToast('Não foi possível salvar as configurações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const generateSlotsFromWorkHours = () => {
    const startMin = timeToMinutes(form.openTime || '08:00');
    const endMin = timeToMinutes(form.closeTime || '19:00');
    const step = Math.max(15, Number(form.slotIntervalMinutes) || 90);
    if (endMin <= startMin) {
      showToast('O horário de fechamento deve ser maior que o de abertura.', 'error');
      return;
    }
    const generated: string[] = [];
    for (let m = startMin; m + 30 <= endMin && generated.length < 48; m += step) {
      generated.push(minutesToTime(m));
    }
    setSlotsText(generated.join(', '));
    setForm(prev => ({ ...prev, configuredSlots: generated }));
    showToast(`${generated.length} horários gerados a partir do expediente!`, 'success');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'avatarImage' | 'heroImageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageToDataUrl(file, field === 'heroImageUrl' ? 1100 : 500, 0.82);
      setForm(prev => ({ ...prev, [field]: base64 }));
      showToast('Imagem atualizada! Clique em Salvar para publicar.', 'success');
    } catch {
      showToast('Erro ao processar imagem.', 'error');
    }
  };

  const toggleWorkDay = (day: number) => {
    const exists = form.workDays.includes(day);
    if (exists && form.workDays.length <= 1) {
      showToast('Mantenha pelo menos 1 dia de atendimento na semana.', 'error');
      return;
    }
    const nextDays = exists
      ? form.workDays.filter(d => d !== day)
      : [...form.workDays, day].sort();
    setForm({ ...form, workDays: nextDays });
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="bg-white rounded-3xl p-4 border border-[#E8D6CB] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A477] block">
              Configurações, Fotos e WhatsApp
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#594943]">
              Gestão do Studio
            </h2>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#F2EAE4] text-[#594943] text-xs font-semibold border border-[#E8D6CB]">
            Tudo em um só lugar
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PROFILE_SCREENS.map(scr => {
            const Icon = scr.icon;
            const active = scr.id === 28 ? isUnifiedSettings : currentScreen === scr.id;
            return (
              <button
                key={scr.id}
                onClick={() => setScreen(scr.id)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#594943] text-[#FAF6F1] shadow-sm'
                    : 'bg-[#FAF6F1] text-[#95847C] hover:text-[#594943] border border-[#E8D6CB]/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#C4A477]' : 'text-[#95847C]'}`} />
                <span className="truncate">{scr.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SCREEN 25: GALERIA */}
      {currentScreen === 25 && (
        <div className="space-y-5">
          <div className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                Tela 25 • Portfólio Visual Luxury Nude
              </span>
              <h3 className="font-serif text-xl font-bold text-[#594943]">Galeria de Trabalhos</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['Todas', 'Alongamento', 'Banho de Gel', 'Blindagem', 'Gel', 'Spa'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setGalleryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    galleryFilter === cat
                      ? 'bg-[#594943] text-white'
                      : 'bg-[#FAF6F1] text-[#95847C] border border-[#E8D6CB]'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => setScreen(26)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#BE9293] text-white text-xs font-semibold hover:bg-[#594943] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                26. Adicionar Fotografia
              </button>
            </div>
          </div>

          {gallery.length === 0 ? (
            <LuxuryStateView
              state="empty"
              title="Sua galeria ainda está vazia"
              message="Adicione fotografias em alta resolução dos seus melhores procedimentos Nail Designer."
              actionLabel="Adicionar Primeira Fotografia"
              onAction={() => setScreen(26)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {gallery
                .filter(item => galleryFilter === 'Todas' || item.category === galleryFilter)
                .map(photo => (
                  <div
                    key={photo.id}
                    className="group bg-white rounded-3xl overflow-hidden border border-[#E8D6CB] shadow-sm hover:shadow-md transition-all flex flex-col"
                  >
                    <div className="aspect-[4/5] bg-[#F2EAE4] relative overflow-hidden">
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#594943]/85 backdrop-blur-md text-[#FAF6F1] text-[10px] font-bold uppercase tracking-wider">
                        {photo.category}
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-serif font-bold text-sm text-[#594943] truncate">{photo.title}</h4>
                        <p className="text-[11px] text-[#95847C]">{photo.createdAt}</p>
                      </div>
                      <button
                        onClick={() => {
                          saveGallery(gallery.filter(g => g.id !== photo.id));
                          showToast('Fotografia removida da galeria.', 'info');
                        }}
                        className="p-2 rounded-xl text-[#95847C] hover:text-[#B45353] hover:bg-[#FAF6F1] cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SCREEN 26: ADICIONAR FOTOGRAFIA */}
      {currentScreen === 26 && (
        <div className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm w-full">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block mb-1">
            Tela 26 • Upload & Curadoria Visual
          </span>
          <h3 className="font-serif text-xl font-bold text-[#594943] mb-4">
            Adicionar Nova Fotografia à Galeria
          </h3>

          <form onSubmit={handleAddGalleryPhoto} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Título do Trabalho *</label>
              <input
                type="text"
                required
                value={newPhotoTitle}
                onChange={e => setNewPhotoTitle(e.target.value)}
                placeholder="Ex: Fibra de Vidro Babyboomer Nude Rosé"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Técnica / Categoria</label>
              <select
                value={newPhotoCategory}
                onChange={e => setNewPhotoCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              >
                <option value="Alongamento">Alongamento</option>
                <option value="Banho de Gel">Banho de Gel</option>
                <option value="Blindagem">Blindagem</option>
                <option value="Gel">Esmaltação em Gel</option>
                <option value="Spa">Spa & Cuticulagem</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <label className="flex-1 flex flex-col items-center justify-center gap-1.5 p-5 rounded-2xl border-2 border-dashed border-[#C4A477] bg-[#FAF6F1] hover:bg-[#F2EAE4] transition-colors cursor-pointer text-center">
                <Upload className="w-5 h-5 text-[#C4A477]" />
                <span className="text-xs font-semibold text-[#594943]">Selecionar foto do celular / PC</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>

              {newPhotoUrl && (
                <div className="w-28 h-28 rounded-2xl overflow-hidden border border-[#E8D6CB] bg-[#F2EAE4] shrink-0">
                  <img src={newPhotoUrl} alt="Prévia" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors cursor-pointer"
              >
                Publicar na Galeria
              </button>
              <button
                type="button"
                onClick={() => setScreen(25)}
                className="px-5 py-3 rounded-xl bg-[#FAF6F1] text-[#594943] text-xs font-semibold border border-[#E8D6CB] cursor-pointer"
              >
                Voltar à Galeria
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SCREEN 27: CENTRAL DE COMUNICAÇÃO */}
      {currentScreen === 27 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
              Tela 27 • Relacionamento VIP
            </span>
            <h3 className="font-serif text-lg font-bold text-[#594943]">Selecionar Cliente</h3>

            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Cliente Cadastrada</label>
              <select
                value={selectedClientPhone}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedClientPhone(val);
                  const found = clients.find(c => c.clientPhone === val);
                  setSelectedClientName(found ? found.clientName : '');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              >
                <option value="">Digitar número manualmente</option>
                {clients.map(c => (
                  <option key={c.key} value={c.clientPhone}>
                    {c.clientName} ({c.clientPhone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Nome da Cliente</label>
              <input
                type="text"
                value={selectedClientName}
                onChange={e => setSelectedClientName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">WhatsApp (com DDD)</label>
              <input
                type="tel"
                value={selectedClientPhone}
                onChange={e => setSelectedClientPhone(e.target.value)}
                placeholder="63992000000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                Templates Inteligentes • 1 Clique
              </span>
              <h3 className="font-serif text-lg font-bold text-[#594943]">
                Central de Mensagens WhatsApp Luxury
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: 'Confirmação de Agendamento',
                  text: `Oi, ${selectedClientName}! Seu horário aqui no ${settings.studioName} já está garantido. Se precisar de algo, é só me chamar.`,
                },
                {
                  title: 'Lembrete 24h Antes',
                  text: `Oi, ${selectedClientName}! Tudo certo pro nosso horário amanhã no ${settings.studioName}? Me confirma por aqui, por favor.`,
                },
                {
                  title: 'Ciclo de Manutenção (21 dias)',
                  text: `Oi, ${selectedClientName}! Já deu 21 dias do seu atendimento. Quer deixar sua manutenção marcada pra não ficar sem horário?`,
                },
                {
                  title: 'Pós-Atendimento & Feedback',
                  text: `Oi, ${selectedClientName}! Obrigada por vir hoje no ${settings.studioName}. Gostou do resultado? Depois me conta!`,
                },
              ].map((tpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCustomMessage(tpl.text)}
                  className="text-left p-4 rounded-2xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] transition-all cursor-pointer"
                >
                  <p className="text-xs font-bold text-[#594943] mb-1">{tpl.title}</p>
                  <p className="text-[11px] text-[#95847C] line-clamp-2">{tpl.text}</p>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Mensagem Personalizada</label>
              <textarea
                rows={3}
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const digits = selectedClientPhone.replace(/\D/g, '');
                  if (digits.length < 8) {
                    showToast('Informe um número de WhatsApp válido com DDD.', 'error');
                    return;
                  }
                  const url = buildWhatsAppUrl(selectedClientPhone, customMessage);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-[#C4A477]" />
                Enviar pelo WhatsApp Oficial
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(customMessage);
                  showToast('Mensagem copiada!', 'success');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#FAF6F1] text-[#594943] text-xs font-semibold border border-[#E8D6CB] cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Texto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURAÇÕES UNIFICADAS DO STUDIO (TELAS 28, 29, 30 e 31 EM UM ÚNICO LUGAR) */}
      {isUnifiedSettings && (
        <form onSubmit={handleSaveSettings} className="space-y-6 w-full">
          {/* Barra fixa de atalhos internos + Botão Único de Salvar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E8D6CB] shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => document.getElementById('cfg-perfil')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-1.5 rounded-xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] text-xs font-semibold text-[#594943] cursor-pointer"
              >
                1. Perfil e Foto
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('cfg-horarios')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-1.5 rounded-xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] text-xs font-semibold text-[#594943] cursor-pointer"
              >
                2. Horários
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('cfg-agenda-pix')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-1.5 rounded-xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] text-xs font-semibold text-[#594943] cursor-pointer"
              >
                3. Pix, Sinal e Folgas
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('cfg-pagina-publica')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-1.5 rounded-xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] text-xs font-semibold text-[#594943] cursor-pointer"
              >
                4. Capa e Textos do Site
              </button>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Tudo'}
            </button>
          </div>

          <div id="cfg-perfil" className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 w-full scroll-mt-20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  1. Perfil da Profissional
                </span>
                <h3 className="font-serif text-xl font-bold text-[#594943]">Dados do Studio e Bio</h3>
              </div>
            </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB]">
            <img
              src={form.avatarImage}
              alt={form.ownerName}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-[#C4A477]"
            />
            <div className="space-y-1.5">
              <p className="font-serif font-bold text-base text-[#594943]">{form.ownerName}</p>
              <p className="text-xs text-[#95847C]">{form.tagline}</p>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#594943] text-white text-xs font-semibold cursor-pointer">
                <Camera className="w-3.5 h-3.5 text-[#C4A477]" />
                Trocar Foto de Perfil
                <input type="file" accept="image/*" onChange={e => handleAvatarUpload(e, 'avatarImage')} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Nome da Profissional</label>
              <input
                type="text"
                value={form.ownerName}
                onChange={e => setForm({ ...form, ownerName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Nome do Studio</label>
              <input
                type="text"
                value={form.studioName}
                onChange={e => setForm({ ...form, studioName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Especialidade / Tagline</label>
              <input
                type="text"
                value={form.tagline}
                onChange={e => setForm({ ...form, tagline: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">WhatsApp Oficial</label>
              <input
                type="text"
                value={form.whatsapp}
                onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#594943] mb-1">Biografia & Apresentação</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
            />
          </div>

          </div>

          {/* 2. HORÁRIOS DE FUNCIONAMENTO */}
          <div id="cfg-horarios" className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 w-full scroll-mt-20">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                2. Grade de Atendimento
              </span>
              <h3 className="font-serif text-xl font-bold text-[#594943]">Horários de Funcionamento</h3>
            </div>

          <div>
            <label className="block text-xs font-semibold text-[#594943] mb-2">Dias de Atendimento na Semana</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(day => {
                const active = form.workDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWorkDay(day.value)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#594943] text-white shadow-sm'
                        : 'bg-[#FAF6F1] text-[#95847C] border border-[#E8D6CB]'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#E8D6CB]/70">
            <label className="block text-xs font-semibold text-[#594943]">
              Modelo de Horários na Agenda
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setScheduleMode('interval')}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  scheduleMode === 'interval'
                    ? 'bg-[#594943] text-white border-[#594943]'
                    : 'bg-[#FAF6F1] text-[#594943] border-[#E8D6CB] hover:border-[#C4A477]'
                }`}
              >
                <div className="text-xs font-bold">Horários Corridos (Intervalo)</div>
                <div className={`text-[11px] mt-0.5 ${scheduleMode === 'interval' ? 'text-white/80' : 'text-[#95847C]'}`}>
                  Gera horários de {form.slotIntervalMinutes || 30} em {form.slotIntervalMinutes || 30} min entre abertura e fechamento.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode('fixed')}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  scheduleMode === 'fixed'
                    ? 'bg-[#594943] text-white border-[#594943]'
                    : 'bg-[#FAF6F1] text-[#594943] border-[#E8D6CB] hover:border-[#C4A477]'
                }`}
              >
                <div className="text-xs font-bold">Horários Fixos Fechados</div>
                <div className={`text-[11px] mt-0.5 ${scheduleMode === 'fixed' ? 'text-white/80' : 'text-[#95847C]'}`}>
                  Você define exatamente quais horários aparecem (ex.: 08:30, 10:30, 13:30).
                </div>
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${scheduleMode === 'interval' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Abertura</label>
              <input
                type="time"
                value={form.openTime}
                onChange={e => setForm({ ...form, openTime: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Fechamento</label>
              <input
                type="time"
                value={form.closeTime}
                onChange={e => setForm({ ...form, closeTime: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            {scheduleMode === 'interval' && (
              <div>
                <label className="block text-xs font-semibold text-[#594943] mb-1">Intervalo Base (min)</label>
                <input
                  type="number"
                  min={15}
                  step={5}
                  value={form.slotIntervalMinutes}
                  onChange={e => setForm({ ...form, slotIntervalMinutes: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
                />
              </div>
            )}
          </div>

          {scheduleMode === 'fixed' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-[#594943]">
                  Horários Fixos Disponíveis (separados por vírgula)
                </label>
                <button
                  type="button"
                  onClick={generateSlotsFromWorkHours}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F2EAE4] hover:bg-[#E8D6CB] text-[#594943] text-xs font-semibold border border-[#E8D6CB] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#C4A477]" />
                  <span>Gerar do Expediente</span>
                </button>
              </div>
              <input
                type="text"
                value={slotsText}
                onChange={e => setSlotsText(e.target.value)}
                placeholder="08:30, 10:30, 13:30, 15:30, 17:30"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
          )}

          </div>

          {/* 3. PIX, SINAL E FOLGAS */}
          <div id="cfg-agenda-pix" className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 w-full scroll-mt-20">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                3. Regras, Sinal Pix e Folgas
              </span>
              <h3 className="font-serif text-xl font-bold text-[#594943]">Configurações de Agendamento e Pix</h3>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Chave Pix Oficial</label>
              <input
                type="text"
                value={form.pixKey}
                onChange={e => setForm({ ...form, pixKey: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Titular do Pix</label>
              <input
                type="text"
                value={form.pixName}
                onChange={e => setForm({ ...form, pixName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Cidade do Pix (BACEN)</label>
              <input
                type="text"
                value={form.pixCity}
                onChange={e => setForm({ ...form, pixCity: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Percentual de Sinal (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.depositPercent}
                onChange={e => setForm({ ...form, depositPercent: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">
                Antecedência Mínima p/ Reagendar (horas)
              </label>
              <input
                type="number"
                min={1}
                value={form.rescheduleMinHours}
                onChange={e => setForm({ ...form, rescheduleMinHours: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">
                Ciclo Ideal de Retorno / Manutenção (dias)
              </label>
              <input
                type="number"
                min={7}
                value={form.returnAlertDays}
                onChange={e => setForm({ ...form, returnAlertDays: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">
                Meta Mensal de Faturamento (R$)
              </label>
              <input
                type="number"
                min={0}
                value={form.monthlyGoal}
                onChange={e => setForm({ ...form, monthlyGoal: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
          </div>

          {/* Gerenciador de Dias de Folga & Feriados (blockedDates) */}
          <div className="pt-4 border-t border-[#E8D6CB] space-y-3">
            <label className="block text-xs font-semibold text-[#594943]">
              Dias de Folga & Feriados Fechados no Calendário
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={newBlockedDate}
                onChange={e => setNewBlockedDate(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newBlockedDate) return;
                  if ((form.blockedDates || []).includes(newBlockedDate)) {
                    showToast('Esta data já está bloqueada.', 'info');
                    return;
                  }
                  const next = [...(form.blockedDates || []), newBlockedDate].sort();
                  setForm({ ...form, blockedDates: next });
                  setNewBlockedDate('');
                  showToast('Folga adicionada! Clique em Salvar para confirmar.', 'success');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F2EAE4] hover:bg-[#E8D6CB] text-[#594943] text-xs font-semibold border border-[#E8D6CB] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#C4A477]" />
                <span>Adicionar Folga</span>
              </button>
            </div>

            {(form.blockedDates || []).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(form.blockedDates || []).map(d => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6F1] border border-[#E8D6CB] text-xs font-semibold text-[#594943]"
                  >
                    <span>{formatDateBR(d)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          blockedDates: (form.blockedDates || []).filter(x => x !== d),
                        })
                      }
                      className="text-[#95847C] hover:text-[#594943] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          </div>

          {/* 4. PERSONALIZAÇÃO DA PÁGINA PÚBLICA */}
          <div id="cfg-pagina-publica" className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 w-full scroll-mt-20">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                4. Vitrine Online da Cliente
              </span>
              <h3 className="font-serif text-xl font-bold text-[#594943]">Capa, Endereço e Textos do Site</h3>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#594943] mb-1">Título Principal (Hero)</label>
              <input
                type="text"
                value={form.heroTitle}
                onChange={e => setForm({ ...form, heroTitle: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#594943] mb-1">Subtítulo de Boas-vindas</label>
              <textarea
                rows={2}
                value={form.heroSubtitle}
                onChange={e => setForm({ ...form, heroSubtitle: e.target.value })}
                className="w-full p-3.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Endereço do Studio</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Instagram (@)</label>
              <input
                type="text"
                value={form.instagram}
                onChange={e => setForm({ ...form, instagram: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB]">
            <img
              src={form.heroImageUrl}
              alt="Capa"
              className="w-24 h-16 rounded-xl object-cover border border-[#C4A477]"
            />
            <div>
              <p className="text-xs font-bold text-[#594943] mb-1">Fotografia de Capa da Página Pública</p>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#594943] text-white text-xs font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#C4A477]" />
                Enviar Nova Capa
                <input type="file" accept="image/*" onChange={e => handleAvatarUpload(e, 'heroImageUrl')} className="hidden" />
              </label>
            </div>
          </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Todas as Configurações'}
              </button>
              <button
                type="button"
                onClick={() => onJumpToAnyScreen?.(7)}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#FAF6F1] text-[#594943] text-xs font-semibold border border-[#E8D6CB] cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#C4A477]" />
                Visualizar Site da Cliente
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SCREEN 32: SEGURANÇA */}
      {currentScreen === 32 && (
        <div className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 w-full">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#594943]">Segurança da Conta</h3>
            <p className="text-xs text-[#95847C]">Acesso restrito da administradora do estúdio.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F2EAE4] border border-[#E8D6CB] flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#594943]">Conta Administrativa Conectada</p>
              <p className="text-xs text-[#95847C]">{adminEmail || 'rs8802616@gmail.com'}</p>
            </div>
            <div className="flex items-center gap-2">
              {adminEmail && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await resetAdminPassword(adminEmail);
                      showToast('Link de redefinição de senha enviado para seu e-mail!', 'success');
                    } catch {
                      showToast('Não foi possível enviar o e-mail de redefinição.', 'error');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-white text-[#594943] text-xs font-semibold border border-[#E8D6CB] cursor-pointer"
                >
                  Redefinir Senha por E-mail
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  clearAdminGateSession();
                  await signOutUser().catch(() => {});
                  window.location.replace('/');
                }}
                className="px-4 py-2 rounded-xl bg-[#B45353] text-white text-xs font-semibold cursor-pointer"
              >
                Encerrar Sessão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 33: AJUDA E SUPORTE + NAVEGADOR DAS 33 TELAS */}
      {currentScreen === 33 && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                  Tela 33 • Ajuda, Suporte & Mapa Completo do Design System
                </span>
                <h3 className="font-serif text-xl font-bold text-[#594943]">
                  Mapa Interativo das 33 Telas Obrigatórias (Luxury Nude)
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#4E7D5B]/15 text-[#4E7D5B] text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                33 / 33 Telas Implementadas
              </span>
            </div>

            <p className="text-xs text-[#95847C] leading-relaxed">
              Clique em qualquer uma das 33 telas abaixo para navegar imediatamente até ela no aplicativo.
              A arquitetura de tokens em <code>src/theme/luxuryNudeTheme.ts</code> é 100% compatível com React Web PWA, React Native e Expo + TypeScript.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {MANDATORY_SCREENS_33.map(item => (
                <button
                  key={item.number}
                  type="button"
                  onClick={() => onJumpToAnyScreen?.(item.number)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF6F1] hover:bg-[#F2EAE4] border border-[#E8D6CB] text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-[#594943] text-[#FAF6F1] text-xs font-bold flex items-center justify-center shrink-0 group-hover:bg-[#BE9293] transition-colors">
                      {item.number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#594943] truncate">{item.title}</p>
                      <p className="text-[10px] text-[#95847C] uppercase tracking-wider">Aba: {item.tab}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#C4A477] shrink-0 opacity-70 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-[#E8D6CB] shadow-sm flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#F2EAE4] flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-[#594943]" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-base text-[#594943]">
                  Pronto para React Native & Expo + TypeScript
                </h4>
                <p className="text-xs text-[#95847C] mt-1 leading-relaxed">
                  Todos os tokens da paleta oficial (<code>#E8D6CB</code>, <code>#BE9293</code>, <code>#C4A477</code>, <code>#FAF6F1</code>, <code>#FFFFFF</code>, <code>#594943</code>, <code>#95847C</code>, <code>#F2EAE4</code>) e componentes reutilizáveis estão centralizados e tipados em TypeScript.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-[#E8D6CB] shadow-sm flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#F2EAE4] flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-[#C4A477]" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-base text-[#594943]">
                  Estados Visuais Padronizados
                </h4>
                <p className="text-xs text-[#95847C] mt-1 leading-relaxed">
                  Componente <code>LuxuryStateView</code> integrado com suporte a estados de carregamento (loading), sucesso (success), erro (error) e ausência de dados (empty state).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
