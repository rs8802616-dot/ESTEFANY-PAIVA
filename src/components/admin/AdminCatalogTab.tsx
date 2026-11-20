import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { SafeImage } from '../SafeImage';
import { useToast } from '../Toast';
import {
  adminDeleteCategory,
  adminDeleteService,
  adminSaveCategory,
  adminSaveService,
} from '../../lib/db';
import { STUDIO_IMAGE_PRESETS, STUDIO_IMAGES } from '../../lib/defaults';
import { compressImageToDataUrl, formatBRL, formatDuration } from '../../lib/utils';
import type { Category, Service } from '../../types/salon';

interface AdminCatalogTabProps {
  categories: Category[];
  services: Service[];
  openNewServiceSignal?: number;
}

export const AdminCatalogTab: React.FC<AdminCatalogTabProps> = ({
  categories,
  services,
  openNewServiceSignal = 0,
}) => {
  const { showToast } = useToast();
  const [catName, setCatName] = useState('');
  const [editingSvc, setEditingSvc] = useState<Partial<Service> | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSaving(true);
    try {
      await adminSaveCategory({
        name: catName.trim(),
        order: categories.length + 1,
        active: true,
      });
      setCatName('');
      showToast('Categoria criada.');
    } catch {
      showToast('Erro ao criar categoria.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openNewService = () => {
    setEditingSvc({
      name: '',
      categoryId: categories[0]?.id || 'cat_alongamentos',
      description: '',
      price: 120,
      durationMinutes: 90,
      imageUrl: STUDIO_IMAGES.alongamento,
      featured: false,
      active: true,
      order: services.length + 1,
      maintenanceDays: 21,
    });
  };

  useEffect(() => {
    if (openNewServiceSignal > 0) {
      openNewService();
    }
  }, [openNewServiceSignal]);

  const handleUploadImage = async (file?: File | null) => {
    if (!file || !editingSvc) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setEditingSvc({ ...editingSvc, imageUrl: dataUrl });
      showToast('Imagem comprimida e aplicada.');
    } catch {
      showToast('Não foi possível processar a imagem.', 'error');
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSvc || !editingSvc.name?.trim() || !editingSvc.categoryId) {
      showToast('Preencha nome e categoria do procedimento.', 'error');
      return;
    }
    setSaving(true);
    try {
      await adminSaveService({
        id: editingSvc.id,
        name: editingSvc.name.trim(),
        categoryId: editingSvc.categoryId,
        description: editingSvc.description || '',
        price: Number(editingSvc.price) || 0,
        durationMinutes: Number(editingSvc.durationMinutes) || 60,
        imageUrl: editingSvc.imageUrl || STUDIO_IMAGES.alongamento,
        featured: Boolean(editingSvc.featured),
        active: editingSvc.active !== false,
        order: Number(editingSvc.order) || 1,
        maintenanceDays:
          editingSvc.maintenanceDays !== undefined ? Number(editingSvc.maintenanceDays) : 21,
      });
      showToast(editingSvc.id ? 'Procedimento atualizado.' : 'Procedimento criado.');
      setEditingSvc(null);
    } catch {
      showToast('Erro ao salvar procedimento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-[#594943]">
            Serviços e Categorias
          </h1>
          <p className="text-sm text-[#95847C]">
            Mude preços, tempos e fotos — tudo atualiza na hora no site da cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewService}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#594943] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#433631] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-[#C4A477]" />
          <span>Novo Procedimento</span>
        </button>
      </div>

      {/* Categories Bar */}
      <section className="bg-white rounded-2xl border border-[#E8D6CB] p-5 space-y-4">
        <h2 className="font-editorial text-2xl font-semibold text-[#594943]">Categorias</h2>

        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            maxLength={60}
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Ex.: Nail Art"
            className="flex-1 min-h-[42px] rounded-xl border border-[#E8D6CB] bg-[#FAF6F1]/70 px-3.5 text-sm focus:border-[#C4A477] focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !catName.trim()}
            className="min-h-[42px] rounded-xl bg-[#594943] px-5 text-xs font-semibold text-white hover:bg-[#433631] disabled:opacity-45"
          >
            Adicionar categoria
          </button>
        </form>

        <div className="divide-y divide-[#E8D6CB]">
          {categories.map((cat) => (
            <div key={cat.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-[#594943]">{cat.name}</div>
              <button
                type="button"
                onClick={() => {
                  void adminDeleteCategory(cat.id)
                    .then(() => showToast('Categoria removida.'))
                    .catch(() => showToast('Erro ao remover categoria.', 'error'));
                }}
                aria-label={`Excluir categoria ${cat.name}`}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#95847C] hover:text-[#C4A477]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Services Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map((svc) => (
          <article
            key={svc.id}
            className="bg-white rounded-2xl border border-[#E8D6CB] overflow-hidden flex flex-col"
          >
            <div className="aspect-[4/3] bg-[#FAF6F1] overflow-hidden">
              <SafeImage src={svc.imageUrl} alt={svc.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-[#95847C] tabular-nums">
                  <span>{formatDuration(svc.durationMinutes)}</span>
                  <span>{svc.active ? 'Ativo no catálogo' : 'Oculto'}</span>
                </div>
                <h3 className="text-base font-semibold text-[#594943]">{svc.name}</h3>
                <p className="text-xs text-[#95847C] line-clamp-2">{svc.description}</p>
              </div>

              <div className="pt-3 border-t border-[#E8D6CB] flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-[#594943] tabular-nums">
                  {formatBRL(svc.price)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingSvc({ ...svc })}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#E8D6CB] px-3 py-1.5 text-xs font-medium text-[#594943] hover:border-[#C4A477]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void adminDeleteService(svc.id)
                        .then(() => showToast('Procedimento removido.'))
                        .catch(() => showToast('Erro ao remover procedimento.', 'error'));
                    }}
                    aria-label={`Excluir ${svc.name}`}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-[#E8D6CB] text-[#95847C] hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Edit / Create Service Sheet */}
      <BottomSheet
        open={!!editingSvc}
        onClose={() => setEditingSvc(null)}
        title={editingSvc?.id ? 'Editar Procedimento' : 'Novo Procedimento'}
        subtitle="Defina valor, duração exata para bloqueio inteligente e fotografia."
      >
        {editingSvc && (
          <form onSubmit={handleSaveService} className="space-y-4">
            <div>
              <label htmlFor="svc-name" className="block text-xs font-medium text-[#95847C] mb-1">
                Nome do procedimento
              </label>
              <input
                id="svc-name"
                type="text"
                required
                maxLength={100}
                value={editingSvc.name || ''}
                onChange={(e) => setEditingSvc({ ...editingSvc, name: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="svc-cat" className="block text-xs font-medium text-[#95847C] mb-1">
                  Categoria
                </label>
                <select
                  id="svc-cat"
                  value={editingSvc.categoryId || ''}
                  onChange={(e) => setEditingSvc({ ...editingSvc, categoryId: e.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="svc-price" className="block text-xs font-medium text-[#95847C] mb-1">
                  Preço (R$)
                </label>
                <input
                  id="svc-price"
                  type="number"
                  step="0.50"
                  min={0}
                  max={50000}
                  required
                  value={editingSvc.price ?? 0}
                  onChange={(e) => setEditingSvc({ ...editingSvc, price: Number(e.target.value) })}
                  className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="svc-dur" className="block text-xs font-medium text-[#95847C] mb-1">
                  Duração (min)
                </label>
                <input
                  id="svc-dur"
                  type="number"
                  step={15}
                  min={15}
                  max={600}
                  required
                  value={editingSvc.durationMinutes ?? 60}
                  onChange={(e) =>
                    setEditingSvc({ ...editingSvc, durationMinutes: Number(e.target.value) })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <label htmlFor="svc-maint" className="block text-xs font-medium text-[#95847C] mb-1">
                Prazo de Manutenção / Retorno (dias — ex: 21 p/ Unha em Gel, 0 se não tiver)
              </label>
              <input
                id="svc-maint"
                type="number"
                min={0}
                max={180}
                value={editingSvc.maintenanceDays ?? 21}
                onChange={(e) =>
                  setEditingSvc({ ...editingSvc, maintenanceDays: Number(e.target.value) })
                }
                className="w-full min-h-[44px] rounded-xl border border-[#E8D6CB] bg-white px-3.5 text-sm tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="svc-desc" className="block text-xs font-medium text-[#95847C] mb-1">
                Descrição
              </label>
              <textarea
                id="svc-desc"
                rows={3}
                maxLength={400}
                value={editingSvc.description || ''}
                onChange={(e) => setEditingSvc({ ...editingSvc, description: e.target.value })}
                className="w-full rounded-xl border border-[#E8D6CB] bg-white p-3 text-sm resize-none"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-[#95847C]">Fotografia do procedimento</div>
              <div className="grid grid-cols-5 gap-2">
                {STUDIO_IMAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setEditingSvc({ ...editingSvc, imageUrl: preset.url })}
                    title={preset.label}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      editingSvc.imageUrl === preset.url
                        ? 'border-[#C4A477]'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <SafeImage src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <label className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#E8D6CB] bg-white px-4 py-2 text-xs font-medium text-[#594943] hover:border-[#C4A477] cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#C4A477]" />
                <span>Ou enviar foto do dispositivo (comprimida)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleUploadImage(e.target.files?.[0])}
                />
              </label>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-[#594943]">
                <input
                  type="checkbox"
                  checked={editingSvc.active !== false}
                  onChange={(e) => setEditingSvc({ ...editingSvc, active: e.target.checked })}
                  className="w-4 h-4 accent-[#C4A477]"
                />
                <span>Visível no catálogo</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-[#594943]">
                <input
                  type="checkbox"
                  checked={Boolean(editingSvc.featured)}
                  onChange={(e) => setEditingSvc({ ...editingSvc, featured: e.target.checked })}
                  className="w-4 h-4 accent-[#C4A477]"
                />
                <span>Destaque</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[46px] rounded-xl bg-[#594943] text-white text-sm font-semibold hover:bg-[#433631] disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar procedimento'}
            </button>
          </form>
        )}
      </BottomSheet>
    </div>
  );
};
