import React, { useMemo, useState } from 'react';
import {
  BellRing,
  ClipboardList,
  MessageCircle,
  Plus,
  Search,
} from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { useToast } from '../Toast';
import { adminSaveClientTechNote } from '../../lib/db';
import {
  buildReturnAlertWhatsAppUrl,
  formatBRL,
  formatDateBR,
  makeClientNoteId,
  maskPhoneBR,
} from '../../lib/utils';
import type {
  ClientProfileSummary,
  ClientTechNote,
  SalonSettings,
} from '../../types/salon';

interface AdminClientsTabProps {
  clients: ClientProfileSummary[];
  settings: SalonSettings;
}

const NAIL_FORMATS = ['Amendoada', 'Quadrada', 'Bailarina', 'Stiletto', 'Natural / Curta', 'Oval'];

export const AdminClientsTab: React.FC<AdminClientsTabProps> = ({ clients, settings }) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [onlyReturnAlert, setOnlyReturnAlert] = useState(false);
  const [editingNote, setEditingNote] = useState<ClientTechNote | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (onlyReturnAlert && !c.needsReturnAlert) return false;
      if (q && !`${c.clientName} ${c.clientPhone}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, onlyReturnAlert]);

  const alertCount = useMemo(
    () => clients.filter((c) => c.needsReturnAlert).length,
    [clients],
  );

  const openTechSheet = (client?: ClientProfileSummary) => {
    if (client?.techNote) {
      setEditingNote({ ...client.techNote });
    } else if (client) {
      setEditingNote({
        id: makeClientNoteId(client.clientPhone),
        clientName: client.clientName,
        clientPhone: client.clientPhone,
        nailFormat: 'Amendoada',
        gelBrand: '',
        favoriteColors: '',
        allergies: '',
        cuticleNotes: '',
        notes: '',
      });
    } else {
      setEditingNote({
        id: '',
        clientName: '',
        clientPhone: '',
        nailFormat: 'Amendoada',
        gelBrand: '',
        favoriteColors: '',
        allergies: '',
        cuticleNotes: '',
        notes: '',
      });
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    if (!editingNote.clientName.trim() || editingNote.clientPhone.replace(/\D/g, '').length < 8) {
      showToast('Informe nome e telefone da cliente.', 'error');
      return;
    }
    setSaving(true);
    try {
      await adminSaveClientTechNote({
        id: editingNote.id || undefined,
        clientName: editingNote.clientName,
        clientPhone: editingNote.clientPhone,
        nailFormat: editingNote.nailFormat,
        gelBrand: editingNote.gelBrand,
        favoriteColors: editingNote.favoriteColors,
        allergies: editingNote.allergies,
        cuticleNotes: editingNote.cuticleNotes,
        notes: editingNote.notes,
      });
      showToast('Ficha técnica salva com segurança.');
      setEditingNote(null);
    } catch {
      showToast('Erro ao salvar ficha técnica.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-[#594943]">
            Clientes & Ficha Técnica
          </h1>
          <p className="text-sm text-[#95847C]">
            Acompanhamento de retorno ({settings.returnAlertDays}+ dias) e preferências técnicas individuais.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openTechSheet()}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#594943] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#433631] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-[#C4A477]" />
          <span>Nova Ficha Técnica</span>
        </button>
      </div>

      {/* Search & Return Alert Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-2xl border border-[#E8D6CB] p-3.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#95847C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome ou WhatsApp..."
            className="w-full min-h-[40px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/70 pl-10 pr-3.5 text-sm focus:border-[#C4A477] focus:bg-white focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setOnlyReturnAlert((v) => !v)}
          className={`min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            onlyReturnAlert
              ? 'bg-[#C4A477] text-white'
              : 'bg-[#FAF6F1] text-[#594943] border border-[#E8D6CB] hover:border-[#C4A477]'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span className="tabular-nums">
            Alerta {settings.returnAlertDays}+ dias ({alertCount})
          </span>
        </button>
      </div>

      {/* Clients Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8D6CB] p-10 text-center text-sm text-[#95847C]">
          Nenhuma cliente encontrada. As clientes aparecem automaticamente após o primeiro agendamento ou cadastro de ficha técnica.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((client) => (
            <article
              key={client.key}
              className="bg-white rounded-2xl border border-[#E8D6CB] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[#594943] truncate">
                      {client.clientName}
                    </h3>
                    <div className="text-xs text-[#95847C] tabular-nums">
                      {client.clientPhone}
                    </div>
                  </div>
                  {client.needsReturnAlert && client.daysSinceLastVisit !== null && (
                    <span className="text-xs font-semibold text-[#C4A477] tabular-nums shrink-0">
                      {client.daysSinceLastVisit} dias sem retorno
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#95847C] tabular-nums">
                  <span>
                    {client.totalVisits} {client.totalVisits === 1 ? 'visita' : 'visitas'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Total {formatBRL(client.totalSpent)}</span>
                  {client.lastVisitDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Última: {formatDateBR(client.lastVisitDate)}</span>
                    </>
                  )}
                </div>

                {client.techNote && (
                  <div className="pt-2 text-xs text-[#594943] space-y-1 border-t border-[#E8D6CB]/70">
                    <div>
                      <span className="text-[#95847C]">Formato:</span>{' '}
                      <strong>{client.techNote.nailFormat || '—'}</strong>
                      {client.techNote.gelBrand && (
                        <>
                          {' · '}
                          <span className="text-[#95847C]">Gel:</span>{' '}
                          <strong>{client.techNote.gelBrand}</strong>
                        </>
                      )}
                    </div>
                    {client.techNote.allergies && (
                      <div className="text-[#C4A477] font-medium">
                        Alergias: {client.techNote.allergies}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E8D6CB]">
                <button
                  type="button"
                  onClick={() => openTechSheet(client)}
                  className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#594943] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#433631] transition-colors"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-[#C4A477]" />
                  <span>{client.techNote ? 'Editar Ficha Técnica' : 'Criar Ficha Técnica'}</span>
                </button>

                {client.clientPhone && (
                  <a
                    href={buildReturnAlertWhatsAppUrl(
                      client.clientName,
                      client.clientPhone,
                      client.daysSinceLastVisit ?? settings.returnAlertDays,
                      settings,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E8D6CB] bg-white px-3.5 py-2 text-xs font-medium text-[#594943] hover:border-[#C4A477] transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#C4A477]" />
                    <span>Chamar Manutenção</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Technical Sheet Bottom Sheet */}
      <BottomSheet
        open={!!editingNote}
        onClose={() => setEditingNote(null)}
        title="Ficha Técnica da Cliente"
        subtitle="Histórico de formato, produtos utilizados, alergias e observações de cutilagem."
      >
        {editingNote && (
          <form onSubmit={handleSaveNote} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tn-name" className="block text-xs font-medium text-[#95847C] mb-1">
                  Nome da cliente
                </label>
                <input
                  id="tn-name"
                  type="text"
                  required
                  maxLength={100}
                  value={editingNote.clientName}
                  onChange={(e) => setEditingNote({ ...editingNote, clientName: e.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="tn-phone" className="block text-xs font-medium text-[#95847C] mb-1">
                  WhatsApp
                </label>
                <input
                  id="tn-phone"
                  type="tel"
                  required
                  maxLength={25}
                  value={editingNote.clientPhone}
                  onChange={(e) =>
                    setEditingNote({ ...editingNote, clientPhone: maskPhoneBR(e.target.value) })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tn-format" className="block text-xs font-medium text-[#95847C] mb-1">
                  Formato preferido
                </label>
                <select
                  id="tn-format"
                  value={editingNote.nailFormat}
                  onChange={(e) => setEditingNote({ ...editingNote, nailFormat: e.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3 text-sm"
                >
                  {NAIL_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tn-gel" className="block text-xs font-medium text-[#95847C] mb-1">
                  Marca de Gel / Base
                </label>
                <input
                  id="tn-gel"
                  type="text"
                  maxLength={100}
                  value={editingNote.gelBrand}
                  onChange={(e) => setEditingNote({ ...editingNote, gelBrand: e.target.value })}
                  placeholder="Ex.: Volia Classic Nude / Più Bella"
                  className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tn-colors" className="block text-xs font-medium text-[#95847C] mb-1">
                Cores e acabamentos favoritos
              </label>
              <input
                id="tn-colors"
                type="text"
                maxLength={160}
                value={editingNote.favoriteColors}
                onChange={(e) => setEditingNote({ ...editingNote, favoriteColors: e.target.value })}
                placeholder="Ex.: Baby boomer suave, marsala, renda translúcida"
                className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="tn-allergies" className="block text-xs font-medium text-[#95847C] mb-1">
                Alergias ou sensibilidades (HEMA, primer ácido, cabine)
              </label>
              <input
                id="tn-allergies"
                type="text"
                maxLength={240}
                value={editingNote.allergies}
                onChange={(e) => setEditingNote({ ...editingNote, allergies: e.target.value })}
                placeholder="Ex.: Sensibilidade ao calor na cabine, usar modo baixa potência"
                className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="tn-cuticle" className="block text-xs font-medium text-[#95847C] mb-1">
                Observações de lâmina e cutilagem
              </label>
              <input
                id="tn-cuticle"
                type="text"
                maxLength={300}
                value={editingNote.cuticleNotes}
                onChange={(e) => setEditingNote({ ...editingNote, cuticleNotes: e.target.value })}
                placeholder="Ex.: Cutícula fina, preferência por cutilagem combinada"
                className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="tn-notes" className="block text-xs font-medium text-[#95847C] mb-1">
                Anotações gerais
              </label>
              <textarea
                id="tn-notes"
                rows={3}
                maxLength={1000}
                value={editingNote.notes}
                onChange={(e) => setEditingNote({ ...editingNote, notes: e.target.value })}
                className="w-full rounded-xl border border-[#E8D6CB] bg-white p-3 text-sm resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[46px] rounded-xl bg-[#594943] text-white text-sm font-semibold hover:bg-[#433631] disabled:opacity-50"
            >
              {saving ? 'Salvando ficha...' : 'Salvar Ficha Técnica'}
            </button>
          </form>
        )}
      </BottomSheet>
    </div>
  );
};
