/**
 * Proteção criptográfica da rota administrativa via token secreto na URL.
 * - As rotas óbvias `/admin` e `#/admin` são 100% bloqueadas e redirecionam para `/`.
 * - O token real NUNCA fica salvo no código nem no Git: apenas seu hash irreversível SHA-256
 *   é comparado no navegador via Web Crypto API.
 */

const SESSION_UNLOCK_KEY = 'epn_admin_gate_unlocked_v2';

// Hash SHA-256 irreversível de 256 bits (o token secreto real jamais fica no código-fonte)
const DEFAULT_ADMIN_TOKEN_SHA256 =
  'e790c64d6957da727ad0485ea49ea5db7614f06ad6623f4562a34b399dd3b954';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getExpectedTokenHash(): string {
  const fromEnv = (import.meta.env.VITE_ADMIN_TOKEN_HASH || '').trim().toLowerCase();
  return fromEnv || DEFAULT_ADMIN_TOKEN_SHA256;
}

export function isAdminGateUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_UNLOCK_KEY) === getExpectedTokenHash();
  } catch {
    return false;
  }
}

/**
 * Valida se o visitante tem autorização para abrir a tela de login administrativo.
 * - `/admin` e `#/admin` são SEMPRE bloqueados e redirecionados para `/` (Portal da Cliente).
 * - Apenas `/painel?k=<TOKEN_SECRETO>` (ou sessão já validada em `/painel`) libera o acesso.
 */
export async function resolveAdminRouteAccess(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  // Bloqueia explicitamente /admin e #/admin para ninguém descobrir a rota
  if (pathname.startsWith('/admin') || hash.includes('/admin') || hash === '#admin') {
    clearAdminGateSession();
    window.history.replaceState({}, '', '/');
    return false;
  }

  const isPainelRoute = pathname.startsWith('/painel') || hash.startsWith('#/painel');
  if (!isPainelRoute) {
    return false;
  }

  const expectedHash = getExpectedTokenHash();

  // Extrai o parâmetro ?k=TOKEN da query string ou do hash
  let providedToken = new URLSearchParams(window.location.search).get('k') || '';
  if (!providedToken && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1] || '';
    providedToken = new URLSearchParams(hashQuery).get('k') || '';
  }

  // Se enviou um token na URL, valida o hash SHA-256 imediatamente
  if (providedToken) {
    const computedHash = await sha256Hex(providedToken.trim());
    if (computedHash === expectedHash) {
      sessionStorage.setItem(SESSION_UNLOCK_KEY, expectedHash);
      // Limpa o token da barra de endereços após desbloquear
      window.history.replaceState({}, '', '/painel');
      return true;
    }
    clearAdminGateSession();
    window.history.replaceState({}, '', '/');
    return false;
  }

  // Sem token na URL: só permite se esta aba já tiver sido desbloqueada com o token
  if (isAdminGateUnlocked()) {
    return true;
  }

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
