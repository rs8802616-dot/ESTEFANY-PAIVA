import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'sm:max-w-xl',
  footer,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6 no-print"
    >
      <div
        onClick={onClose}
        className="sheet-backdrop fixed inset-0 bg-[#433631]/55 backdrop-blur-sm"
      />
      <div
        className={`sheet-panel relative z-10 w-full ${maxWidthClass} max-h-[92dvh] sm:max-h-[88dvh] flex flex-col bg-[#FAF6F1] rounded-t-[28px] sm:rounded-3xl border border-[#E8D6CB] shadow-2xl overflow-hidden`}
      >
        {/* Native Mobile Drag Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-11 h-1.5 rounded-full bg-[#594943]/20" />
        </div>

        {/* Sheet Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-[#E8D6CB] bg-white shrink-0">
          <div className="min-w-0">
            <h2 className="font-editorial text-2xl sm:text-[26px] font-semibold text-[#594943] leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs sm:text-sm text-[#95847C] leading-snug">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-full text-[#95847C] hover:text-[#594943] hover:bg-[#FAF6F1] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
          {children}
        </div>

        {/* Optional Pinned Footer */}
        {footer && (
          <div className="px-5 sm:px-6 pt-3.5 pb-safe sm:pb-5 bg-white border-t border-[#E8D6CB] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
