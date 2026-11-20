import React, { useState } from 'react';
import {
  Camera, Plus, MessageSquare, User, Clock, Sliders, Palette, ShieldCheck,
  HelpCircle, Trash2, Send, CheckCircle2, Lock, KeyRound, Smartphone,
  Sparkles, ExternalLink, Copy, Upload, Layers
} from 'lucide-react';
import type { SalonSettings, ClientProfileSummary, Appointment, Service } from '../../types/salon';
import { adminSaveSettings } from '../../lib/db';
import { compressImageToDataUrl } from '../../lib/utils';
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
    imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85',
    createdAt: '2025-05-01',
  },
  {
    id: 'gal-2',
    title: 'Banho de Gel Luxury Rosé',
    category: 'Banho de Gel',
    imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=85',
    createdAt: '2025-05-03',
  },
  {
    id: 'gal-3',
    title: 'Blindagem Diamante & Francesa Fina',
    category: 'Blindagem',
    imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=85',
    createdAt: '2025-05-05',
  },
  {
    id: 'gal-4',
    title: 'Esmaltação em Gel Clássica',
    category: 'Gel',
    imageUrl: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=85',
    createdAt: '2025-05-07',
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
  { id: 25, number: 25, label: 'Galeria', icon: Camera },
  { id: 26, number: 26, label: 'Adicionar Foto', icon: Plus },
  { id: 27, number: 27, label: 'Comunicação', icon: MessageSquare },
  { id: 28, number: 28, label: 'Perfil', icon: User },
  { id: 29, number: 29, label: 'Horários', icon: Clock },
  { id: 30, number: 30, label: 'Config. Agenda', icon: Sliders },
  { id: 31, number: 31, label: 'Página Pública', icon: Palette },
  { id: 32, number: 32, label: 'Segurança', icon: ShieldCheck },
  { id: 33, number: 33, label: 'Ajuda & 33 Telas', icon: HelpCircle },
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
  const [slotsText, setSlotsText] = useState((settings.configuredSlots || []).join(', '));
  const [saving, setSaving] = useState(false);

  const saveGallery = (next: GalleryPhoto[]) => {
    setGallery(next);
    try {
      localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageToDataUrl(file, 900, 0.82);
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
    showToast('Fotografia publicada na Galeria Luxury Nude!', 'success');
    setScreen(25);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedSlots = slotsText
        .split(',')
        .map(s => s.trim())
        .filter(s => /^\d{2}:\d{2}$/.test(s));

      await adminSaveSettings({
        ...form,
        configuredSlots: parsedSlots.length > 0 ? parsedSlots : form.configuredSlots,
      });
      showToast('Configurações Luxury Nude salvas com sucesso!', 'success');
    } catch {
      showToast('Não foi possível salvar as configurações.', 'error');
    } finally {
      setSaving(false);
    }
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
    const nextDays = exists
      ? form.workDays.filter(d => d !== day)
      : [...form.workDays, day].sort();
    setForm({ ...form, workDays: nextDays });
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar for Screens 25 to 33 */}
      <div className="bg-white rounded-3xl p-4 border border-[#E8D6CB] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4A477] block">
              Portfólio, Marca, Comunicação & Segurança • Telas 25 a 33
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#594943]">
              Gestão do Studio & Identidade Luxury Nude
            </h2>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#F2EAE4] text-[#594943] text-xs font-semibold border border-[#E8D6CB]">
            Tela #{currentScreen} de 33
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {PROFILE_SCREENS.map(scr => {
            const Icon = scr.icon;
            const active = currentScreen === scr.id;
            return (
              <button
                key={scr.id}
                onClick={() => setScreen(scr.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-[#594943] text-[#FAF6F1] shadow-sm'
                    : 'bg-[#FAF6F1] text-[#95847C] hover:text-[#594943] border border-[#E8D6CB]/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#C4A477]' : 'text-[#95847C]'}`} />
                <span>{scr.number}. {scr.label}</span>
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
              {['Todas', 'Alongamento', 'Banho de Gel', 'Blindagem', 'Gel'].map(cat => (
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
        <div className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm max-w-2xl">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-[#594943] mb-1.5">
                  Enviar do Celular / Computador
                </label>
                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-[#C4A477] bg-[#FAF6F1] hover:bg-[#F2EAE4] transition-colors cursor-pointer text-center">
                  <Upload className="w-6 h-6 text-[#C4A477]" />
                  <span className="text-xs font-semibold text-[#594943]">Selecionar Fotografia</span>
                  <span className="text-[11px] text-[#95847C]">Compressão automática HD</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>

              {newPhotoUrl ? (
                <div className="aspect-square rounded-2xl overflow-hidden border border-[#E8D6CB] bg-[#F2EAE4]">
                  <img src={newPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square rounded-2xl border border-[#E8D6CB] bg-[#FAF6F1] flex items-center justify-center text-xs text-[#95847C] p-4 text-center">
                  Pré-visualização Luxury Nude aparecerá aqui
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
                  const found = clients.find(c => c.clientPhone === e.target.value);
                  setSelectedClientPhone(e.target.value);
                  if (found) setSelectedClientName(found.clientName);
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
                  text: `Olá, ${selectedClientName}! ✨ Seu horário no ${settings.studioName} está reservado com carinho. Qualquer dúvida estou à disposição!`,
                },
                {
                  title: 'Lembrete 24h Antes',
                  text: `Oi, ${selectedClientName}! Passando para lembrar do nosso encontro amanhã no ${settings.studioName} 💅 Confirma sua presença?`,
                },
                {
                  title: 'Ciclo de Manutenção (21 dias)',
                  text: `Olá, ${selectedClientName}! Já completaram 21 dias do seu procedimento. Vamos agendar sua manutenção para manter suas unhas impecáveis? ✨`,
                },
                {
                  title: 'Pós-Atendimento & Feedback',
                  text: `Oi, ${selectedClientName}! Foi um prazer cuidar das suas unhas hoje no ${settings.studioName}. O que achou do resultado? 💖`,
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
              <a
                href={`https://wa.me/55${selectedClientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(customMessage)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-[#C4A477]" />
                Enviar pelo WhatsApp Oficial
              </a>
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

      {/* SCREEN 28: PERFIL DA PROFISSIONAL */}
      {currentScreen === 28 && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                Tela 28 • Perfil da Especialista
              </span>
              <h3 className="font-serif text-xl font-bold text-[#594943]">Dados da Profissional & Bio</h3>
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

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Perfil da Profissional'}
          </button>
        </form>
      )}

      {/* SCREEN 29: HORÁRIOS DE FUNCIONAMENTO */}
      {currentScreen === 29 && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 max-w-3xl">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
              Tela 29 • Grade de Atendimento
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-xs font-semibold text-[#594943] mb-1">Intervalo Base (min)</label>
              <input
                type="number"
                value={form.slotIntervalMinutes}
                onChange={e => setForm({ ...form, slotIntervalMinutes: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#594943] mb-1">
              Horários Padrão Disponíveis (separados por vírgula)
            </label>
            <input
              type="text"
              value={slotsText}
              onChange={e => setSlotsText(e.target.value)}
              placeholder="08:00, 09:30, 11:00, 13:30, 15:00, 16:30, 18:00"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E8D6CB] bg-[#FAF6F1] text-sm text-[#594943]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors cursor-pointer"
          >
            {saving ? 'Salvando...' : 'Salvar Horários de Funcionamento'}
          </button>
        </form>
      )}

      {/* SCREEN 30: CONFIGURAÇÕES DE AGENDAMENTO */}
      {currentScreen === 30 && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 max-w-3xl">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
              Tela 30 • Regras de Negócio & Sinal Pix
            </span>
            <h3 className="font-serif text-xl font-bold text-[#594943]">Configurações de Agendamento</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors cursor-pointer"
          >
            {saving ? 'Salvando...' : 'Salvar Regras de Agendamento'}
          </button>
        </form>
      )}

      {/* SCREEN 31: PERSONALIZAÇÃO DA PÁGINA PÚBLICA */}
      {currentScreen === 31 && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 max-w-3xl">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
              Tela 31 • Vitrine Online da Cliente (Tela 7)
            </span>
            <h3 className="font-serif text-xl font-bold text-[#594943]">Personalização da Página Pública</h3>
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-[#594943] text-white text-xs font-semibold hover:bg-[#433631] transition-colors cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Publicar Alterações na Página Pública'}
            </button>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#FAF6F1] text-[#594943] text-xs font-semibold border border-[#E8D6CB]"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#C4A477]" />
              Abrir Página Pública (Tela 7)
            </a>
          </div>
        </form>
      )}

      {/* SCREEN 32: SEGURANÇA */}
      {currentScreen === 32 && (
        <div className="bg-white rounded-3xl p-6 border border-[#E8D6CB] shadow-sm space-y-5 max-w-2xl">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
              Tela 32 • Criptografia & Controle de Acesso
            </span>
            <h3 className="font-serif text-xl font-bold text-[#594943]">Segurança do Aplicativo</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB] space-y-1.5">
              <div className="flex items-center gap-2 text-[#4E7D5B] text-xs font-bold">
                <Lock className="w-4 h-4" />
                Rota Secreta SHA-256 Ativa
              </div>
              <p className="text-xs text-[#95847C]">
                Rotas <code>/admin</code> e <code>#/admin</code> bloqueadas. Acesso permitido exclusivamente via token criptográfico 256-bit.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF6F1] border border-[#E8D6CB] space-y-1.5">
              <div className="flex items-center gap-2 text-[#594943] text-xs font-bold">
                <KeyRound className="w-4 h-4 text-[#C4A477]" />
                Autenticação Firebase TLS 1.3
              </div>
              <p className="text-xs text-[#95847C]">
                Sessão autenticada com e-mail e senha (scrypt) via Google Identity Platform.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F2EAE4] border border-[#E8D6CB] flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#594943]">Conta Administrativa Conectada</p>
              <p className="text-xs text-[#95847C]">{adminEmail || 'Autenticada com segurança'}</p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
                  <Sparkles className="w-3.5 h-3.5 text-[#C4A477] shrink-0 opacity-70 group-hover:opacity-100" />
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
