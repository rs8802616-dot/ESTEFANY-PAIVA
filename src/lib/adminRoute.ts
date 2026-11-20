/**
 * Proteção criptográfica da rota administrativa via token secreto na URL.
 * O token real NUNCA fica no código-fonte nem no Git — apenas seu hash SHA-256
 * é configurado como variável de ambiente (VITE_ADMIN_TOKEN_HASH) na Vercel.
 */

const SESSION_UNLOCK_KEY = 'epn_admin_gate_unlocked_v1';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getExpectedTokenHash(): string {
  return (import.meta.env.VITE_ADMIN_TOKEN_HASH || '').trim().toLowerCase();
}

export function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname.toLowerCase();
  const h = window.location.hash.toLowerCase();
  return p.startsWith('/painel') || p.startsWith('/admin') || h.includes('painel') || h.includes('admin');
}

/**
 * Valida se o visitante tem autorização para sequer VER a tela de login do admin.
 * - Se VITE_ADMIN_TOKEN_HASH estiver definido na Vercel: exige ?k=<TOKEN> válido
 *   (ou sessão já desbloqueada nesta aba). Sem o token, o visitante cai no Portal da Cliente.
 * - Após validar ?k=<TOKEN>, remove o token da barra de endereços imediatamente.
 */
export async function resolveAdminRouteAccess(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!isAdminPath()) return false;

  const expectedHash = getExpectedTokenHash();

  // Se ainda não foi configurada a variável VITE_ADMIN_TOKEN_HASH na Vercel,
  // exige ao menos o caminho explícito /painel ou /admin (com login e senha Firebase).
  if (!expectedHash) {
    return true;
  }

  // Já validado nesta aba do navegador
  if (sessionStorage.getItem(SESSION_UNLOCK_KEY) === expectedHash) {
    return true;
  }

  // Lê parâmetro ?k=TOKEN da query string ou do hash (#/painel?k=TOKEN)
  let providedToken = new URLSearchParams(window.location.search).get('k') || '';
  if (!providedToken && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1] || '';
    providedToken = new URLSearchParams(hashQuery).get('k') || '';
  }

  if (!providedToken) {
    window.history.replaceState({}, '', '/');
    return false;
  }

  const computedHash = await sha256Hex(providedToken.trim());
  if (computedHash === expectedHash) {
    sessionStorage.setItem(SESSION_UNLOCK_KEY, expectedHash);
    // Limpa o token secreto da barra de endereços para não ficar exposto na tela
    window.history.replaceState({}, '', '/painel');
    return true;
  }

  // Token inválido: oculta a existência do painel e redireciona silenciosamente para a home
  window.history.replaceState({}, '', '/');
  return false;
}

export function clearAdminGateSession(): void {
  try {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  } catch {
    // ignore
  }
}
