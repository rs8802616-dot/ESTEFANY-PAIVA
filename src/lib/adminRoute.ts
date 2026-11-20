/**
 * Proteção criptográfica da rota administrativa via token secreto na URL +
 * Autenticação PBKDF2-HMAC-SHA256 (250.000 iterações via Web Crypto API).
 *
 * REGRAS DE SEGURANÇA:
 * 1. As rotas `/admin` e `#/admin` são 100% bloqueadas e redirecionam para `/`.
 * 2. A rota `/painel` SEM o parâmetro `?k=<TOKEN_SECRETO>` é 100% bloqueada enquanto
 *    a administradora não estiver autenticada com login e senha.
 * 3. Nenhum token, e-mail ou senha em texto puro fica salvo no código ou no Git:
 *    apenas hashes irreversíveis SHA-256 e chaves derivadas PBKDF2-HMAC-SHA256 (250.000 iterações).
 */

const VAULT_AUTH_SESSION_KEY = 'epn_admin_vault_auth_v42';
const VAULT_AUTH_EMAIL_KEY = 'epn_admin_vault_email_v42';

// Hash SHA-256 irreversível de 256 bits do token secreto da URL
const DEFAULT_ADMIN_TOKEN_SHA256 =
  'e790c64d6957da727ad0485ea49ea5db7614f06ad6623f4562a34b399dd3b954';

// Salt e Hashes PBKDF2-HMAC-SHA256 (250.000 iterações, 256-bit) das credenciais administrativas
const PBKDF2_SALT = 'epn-luxury-vault-salt-2026-v42';
const PBKDF2_ITERATIONS = 250000;
const ALLOWED_PBKDF2_HASHES = [
  '5abb7ec1e005098371ade6e7cf70bf6fba27195c9fe41c174c4ff9be28c15c43',
  'faba1bf7b3d55bc4fde03575c9d711c7f1a6210f9451b090e8b071032b0e4323',
];

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function pbkdf2Hex(email: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const payload = `${email.toLowerCase().trim()}:${password}`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(payload),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getExpectedTokenHash(): string {
  const fromEnv = (import.meta.env.VITE_ADMIN_TOKEN_HASH || '').trim().toLowerCase();
  return fromEnv || DEFAULT_ADMIN_TOKEN_SHA256;
}

export function isVaultAdminAuthenticated(): boolean {
  try {
    const stored = sessionStorage.getItem(VAULT_AUTH_SESSION_KEY) || '';
    return ALLOWED_PBKDF2_HASHES.includes(stored);
  } catch {
    return false;
  }
}

export function getVaultAdminEmail(): string | null {
  try {
    if (!isVaultAdminAuthenticated()) return null;
    return sessionStorage.getItem(VAULT_AUTH_EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function verifyAdminVaultCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const derived = await pbkdf2Hex(email, password);
  if (ALLOWED_PBKDF2_HASHES.includes(derived)) {
    try {
      sessionStorage.setItem(VAULT_AUTH_SESSION_KEY, derived);
      sessionStorage.setItem(VAULT_AUTH_EMAIL_KEY, email.toLowerCase().trim());
      // Remove o token secreto da barra de endereço somente APÓS o login concluído
      window.history.replaceState({}, '', '/painel');
    } catch {
      // ignore storage errors
    }
    return true;
  }
  return false;
}

export function isAdminGateUnlocked(): boolean {
  return isVaultAdminAuthenticated();
}

/**
 * Valida se o visitante tem autorização para abrir a rota administrativa.
 * - `/admin` e `#/admin` são SEMPRE bloqueados e redirecionados para `/`.
 * - `/painel` SEM `?k=<TOKEN_SECRETO>` é SEMPRE bloqueado se o usuário não estiver autenticado!
 */
export async function resolveAdminRouteAccess(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  // 1. Bloqueia /admin e #/admin em 100% dos casos
  if (pathname.startsWith('/admin') || hash.includes('/admin') || hash === '#admin') {
    clearAdminGateSession();
    window.history.replaceState({}, '', '/');
    return false;
  }

  // 2. Verifica se está na rota /painel
  const isPainelRoute = pathname.startsWith('/painel') || hash.startsWith('#/painel');
  if (!isPainelRoute) {
    return false;
  }

  const expectedHash = getExpectedTokenHash();

  // 3. Extrai o parâmetro ?k=TOKEN da URL
  let providedToken = new URLSearchParams(window.location.search).get('k') || '';
  if (!providedToken && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1] || '';
    providedToken = new URLSearchParams(hashQuery).get('k') || '';
  }

  // 4. Se tem token na URL, valida o hash SHA-256 imediatamente
  if (providedToken) {
    const computedHash = await sha256Hex(providedToken.trim());
    if (computedHash === expectedHash) {
      return true;
    }
    clearAdminGateSession();
    window.history.replaceState({}, '', '/');
    return false;
  }

  // 5. Sem token na URL: SÓ permite permanecer em /painel se JÁ estiver autenticado com login e senha!
  if (isVaultAdminAuthenticated()) {
    return true;
  }

  // Caso contrário, bloqueia /painel sem token e redireciona para o site da cliente (/)
  window.history.replaceState({}, '', '/');
  return false;
}

export function clearAdminGateSession(): void {
  try {
    sessionStorage.removeItem(VAULT_AUTH_SESSION_KEY);
    sessionStorage.removeItem(VAULT_AUTH_EMAIL_KEY);
    sessionStorage.removeItem('epn_admin_gate_unlocked_v2');
  } catch {
    // ignore
  }
}
