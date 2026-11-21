import React, { useState } from 'react';
import { CheckCircle2, FileText, Lock, ShieldCheck } from 'lucide-react';

export const ADMIN_TERMS_VERSION = '2026-11-v1';
export const ADMIN_TERMS_LOCAL_KEY = `epn_admin_terms_accepted_${ADMIN_TERMS_VERSION}`;

export const ADMIN_TERMS_SECTIONS = [
  {
    title: '1. Objeto e Natureza da Plataforma',
    body: 'Este Termo regula o uso do Painel Administrativo do aplicativo de agendamento e gestão do estúdio. A plataforma fornece ferramentas de agenda, catálogo de serviços, controle financeiro interno, histórico de clientes e integração opcional com o Google Agenda.',
  },
  {
    title: '2. Proteção de Dados e Conformidade com a LGPD (Lei nº 13.709/2018)',
    body: 'Para fins da Lei Geral de Proteção de Dados (LGPD), a Administradora (Estúdio) atua como Controladora dos dados pessoais de suas clientes (nome completo, telefone/WhatsApp, histórico de atendimentos, observações técnicas e registros financeiros). O desenvolvedor/operador técnico da plataforma atua exclusivamente como Operador Técnico de infraestrutura, sem acesso a dados pessoais identificáveis (Zero PII), visualizando apenas métricas técnicas agregadas de estabilidade e desempenho.',
  },
  {
    title: '3. Finalidade, Sigilo e Direitos das Clientes (Art. 18 da LGPD)',
    body: 'A Administradora compromete-se a utilizar os dados cadastrados pelas clientes exclusivamente para agendamento, confirmação, atendimento e gestão do estúdio, sendo vedado o compartilhamento com terceiros não autorizados ou uso para spam. Caso alguma cliente solicite correção, confirmação ou exclusão de seus dados pessoais, a Administradora compromete-se a atender a solicitação pelos recursos de gestão do painel.',
  },
  {
    title: '4. Segurança da Conta, Criptografia e Bloqueio (Marco Civil · Lei nº 12.965/2014)',
    body: 'As credenciais de acesso ao Painel Administrativo são protegidas por criptografia PBKDF2-HMAC-SHA256 (250.000 iterações). Por medida de segurança contra acessos indevidos, 5 tentativas consecutivas de login com senha incorreta bloqueiam temporariamente o acesso por 15 minutos. A Administradora é responsável por manter o sigilo de seu link de acesso, e-mail e senha, podendo alterá-los a qualquer momento na aba Segurança da Conta.',
  },
  {
    title: '5. Relação com Consumidoras (CDC · Lei nº 8.078/1990) e Integrações',
    body: 'A Administradora é integralmente responsável pela veracidade dos preços, durações dos procedimentos, regras de sinal via Pix, horários de atendimento e políticas de remarcação/cancelamento exibidas na página pública. A conexão com o Google Agenda (OAuth) é opcional e autorizada diretamente pela Administradora, podendo ser desconectada a qualquer momento no topo do painel. Os disparos via WhatsApp utilizam o aplicativo oficial da Administradora mediante ação manual de confirmação.',
  },
  {
    title: '6. Registro de Aceite Eletrônico',
    body: 'Ao marcar a caixa de concordância e clicar em "Aceitar Termos e Continuar", fica registrado eletronicamente no banco de dados o aceite da versão vigente deste documento, contendo data, hora, e-mail administrativo e identificação técnica do navegador, com validade jurídica nos termos da legislação brasileira vigente.',
  },
];

interface AdminTermsModalProps {
  adminEmail: string;
  onAccepted: (acceptedAt: string) => void;
  readOnly?: boolean;
  acceptedAt?: string;
  onClose?: () => void;
}

export const AdminTermsModal: React.FC<AdminTermsModalProps> = ({
  adminEmail,
  onAccepted,
  readOnly = false,
  acceptedAt,
  onClose,
}) => {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!checked) return;
    setSaving(true);
    setError('');
    try {
      const callerAuthHash =
        localStorage.getItem('epn_admin_vault_auth_v43') ||
        sessionStorage.getItem('epn_admin_vault_auth_v43') ||
        '';
      const resp = await fetch('/api/auth-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept_terms',
          callerAuthHash,
          adminEmail,
          termsVersion: ADMIN_TERMS_VERSION,
          userAgent: navigator.userAgent,
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        acceptedAt?: string;
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        setError(data.error || 'Não foi possível registrar o aceite. Tente novamente.');
        return;
      }
      const ts = data.acceptedAt || new Date().toISOString();
      try {
        localStorage.setItem(ADMIN_TERMS_LOCAL_KEY, ts);
      } catch {
        // ignore
      }
      onAccepted(ts);
    } catch {
      setError('Erro de conexão ao registrar aceite. Verifique sua internet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#433631]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#FAF6F1] border border-[#E8D6CB] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 bg-white border-b border-[#E8D6CB] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F2EAE4] text-[#C4A477] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A477] block">
                Versão {ADMIN_TERMS_VERSION} · Conformidade Legal
              </span>
              <h2 className="font-editorial text-xl font-bold text-[#594943]">
                Termo de Uso, Privacidade (LGPD) e Segurança
              </h2>
            </div>
          </div>
          {readOnly && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[#F2EAE4] text-xs font-semibold text-[#594943] cursor-pointer"
            >
              Fechar
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-[#594943] leading-relaxed">
          <div className="rounded-2xl bg-white border border-[#E8D6CB] p-4 flex items-start gap-3">
            <FileText className="w-4 h-4 text-[#C4A477] shrink-0 mt-0.5" />
            <div className="text-xs text-[#95847C]">
              Leia atentamente as cláusulas abaixo antes de utilizar o Painel
              Administrativo (<strong>{adminEmail}</strong>).
            </div>
          </div>

          {ADMIN_TERMS_SECTIONS.map((sec) => (
            <div
              key={sec.title}
              className="rounded-2xl bg-white border border-[#E8D6CB] p-4 space-y-1.5"
            >
              <h3 className="text-xs sm:text-sm font-bold text-[#594943]">
                {sec.title}
              </h3>
              <p className="text-xs text-[#7B6B64] leading-relaxed">
                {sec.body}
              </p>
            </div>
          ))}

          {readOnly && acceptedAt && (
            <div className="rounded-2xl bg-[#4E7D5B]/10 border border-[#4E7D5B]/30 p-4 text-xs text-[#4E7D5B] font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Termo aceito eletronicamente em{' '}
                {new Date(acceptedAt).toLocaleString('pt-BR')}.
              </span>
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="px-6 py-4 bg-white border-t border-[#E8D6CB] space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#594943]">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#594943] rounded cursor-pointer"
              />
              <span>
                Li, compreendi e concordo integralmente com o{' '}
                <strong>Termo de Uso, Privacidade (LGPD) e Segurança</strong>{' '}
                para utilização do Painel Administrativo.
              </span>
            </label>

            {error && (
              <p className="text-xs text-rose-600 font-medium">{error}</p>
            )}

            <button
              type="button"
              disabled={!checked || saving}
              onClick={() => void handleConfirm()}
              className="w-full min-h-[46px] rounded-xl bg-[#594943] text-white text-sm font-semibold hover:bg-[#433631] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>
                {saving
                  ? 'Registrando aceite...'
                  : 'Aceitar Termos e Acessar Painel'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
