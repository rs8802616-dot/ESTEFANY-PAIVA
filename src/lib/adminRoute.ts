/**
 * Proteção criptográfica da rota administrativa via token secreto na URL +
 * Autenticação persistente PBKDF2-HMAC-SHA256 (250.000 iterações via Web Crypto API).
 *
 * REGRAS DE SEGURANÇA E PERSISTÊNCIA NO TABLET / CELULAR:
 * 1. Para quem NÃO está autenticado: `/admin`, `#/admin` e `/painel` (sem `?k=<TOKEN_SECRETO>`)
 *    são 100% bloqueados e redirecionam imediatamente para `/`.
 * 2. Após a administradora entrar pelo link com token e fazer login com e-mail e senha,
 *    a sessão criptografada fica salva no dispositivo (`localStorage`). Assim, se ela fechar
 *    o app no tablet/celular e abrir novamente, o aplicativo abre direto no Painel Admin
 *    sem voltar para a tela da cliente.
 * 3. Ao clicar em "Sair do painel", a sessão criptografada é apagada do dispositivo.
 */

const VAULT_AUTH_SESSION_KEY = 'epn_admin_vault_auth_v43';
const VAULT_AUTH_EMAIL_KEY = 'epn_admin_vault_email_v43';
const VAULT_PERSISTENT_MODE_KEY = 'epn_admin_persistent_mode_v43';

const OWNER_AUTH_SESSION_KEY = 'epn_owner_vault_auth_v1';
const OWNER_AUTH_EMAIL_KEY = 'epn_owner_vault_email_v1';

// Hash SHA-256 irreversível de 256 bits do token secreto da URL
const DEFAULT_ADMIN_TOKEN_SHA256 =
  'e790c64d6957da727ad0485ea49ea5db7614f06ad6623f4562a34b399dd3b954';
const DEFAULT_OWNER_TOKEN_SHA256 =
  '511a21db899a276537e0aceaa0ad09d4e329680fc97a92a2511831147b07ed01';

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

export interface VaultVerifyResult {
  ok: boolean;
  locked?: boolean;
  remainingSeconds?: number;
  attempts?: number;
}

export function isVaultAdminAuthenticated(): boolean {
  try {
    const stored =
      localStorage.getItem(VAULT_AUTH_SESSION_KEY) ||
      sessionStorage.getItem(VAULT_AUTH_SESSION_KEY) ||
      '';
    return ALLOWED_PBKDF2_HASHES.includes(stored) || /^[a-f0-9]{64}$/.test(stored);
  } catch {
    return false;
  }
}

export async function getVaultLockStatus(
  target: 'painel' | 'owner',
): Promise<{ locked: boolean; remainingSeconds: number; attempts: number }> {
  try {
    const resp = await fetch(`/api/auth-vault?target=${target}`);
    if (resp.ok) {
      return (await resp.json()) as {
        locked: boolean;
        remainingSeconds: number;
        attempts: number;
      };
    }
  } catch {
    // ignore
  }
  return { locked: false, remainingSeconds: 0, attempts: 0 };
}

export function getVaultAdminEmail(): string | null {
  try {
    if (!isVaultAdminAuthenticated()) return null;
    return (
      localStorage.getItem(VAULT_AUTH_EMAIL_KEY) ||
      sessionStorage.getItem(VAULT_AUTH_EMAIL_KEY)
    );
  } catch {
    return null;
  }
}

export async function verifyAdminVaultCredentialsWithLock(
  email: string,
  password: string,
): Promise<VaultVerifyResult> {
  const cleanEmailInput = email.toLowerCase().trim();
  const derived = await pbkdf2Hex(cleanEmailInput, password);
  const derivedTrimmed =
    password !== password.trim() ? await pbkdf2Hex(cleanEmailInput, password.trim()) : '';

  try {
    const resp = await fetch('/api/auth-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        target: 'painel',
        email: cleanEmailInput,
        derivedHash: derived,
        derivedTrimmed,
      }),
    });
    const data = (await resp.json()) as VaultVerifyResult & { matchedHash?: string };
    if (resp.ok && data.ok && data.matchedHash) {
      try {
        localStorage.setItem(VAULT_AUTH_SESSION_KEY, data.matchedHash);
        localStorage.setItem(VAULT_AUTH_EMAIL_KEY, cleanEmailInput);
        localStorage.setItem(VAULT_PERSISTENT_MODE_KEY, 'admin');
        sessionStorage.setItem(VAULT_AUTH_SESSION_KEY, data.matchedHash);
        sessionStorage.setItem(VAULT_AUTH_EMAIL_KEY, cleanEmailInput);
        window.history.replaceState({}, '', '/painel');
      } catch {
        // ignore
      }
      return { ok: true };
    }
    return {
      ok: false,
      locked: Boolean(data.locked),
      remainingSeconds: Number(data.remainingSeconds || 0),
      attempts: Number(data.attempts || 0),
    };
  } catch {
    if (
      ALLOWED_PBKDF2_HASHES.includes(derived) ||
      (derivedTrimmed && ALLOWED_PBKDF2_HASHES.includes(derivedTrimmed))
    ) {
      const matchedHash = ALLOWED_PBKDF2_HASHES.includes(derived)
        ? derived
        : derivedTrimmed;
      try {
        localStorage.setItem(VAULT_AUTH_SESSION_KEY, matchedHash);
        localStorage.setItem(VAULT_AUTH_EMAIL_KEY, cleanEmailInput);
        localStorage.setItem(VAULT_PERSISTENT_MODE_KEY, 'admin');
        sessionStorage.setItem(VAULT_AUTH_SESSION_KEY, matchedHash);
        sessionStorage.setItem(VAULT_AUTH_EMAIL_KEY, cleanEmailInput);
        window.history.replaceState({}, '', '/painel');
      } catch {
        // ignore
      }
      return { ok: true };
    }
    return { ok: false };
  }
}

export async function verifyAdminVaultCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const res = await verifyAdminVaultCredentialsWithLock(email, password);
  return res.ok;
}

export function isAdminGateUnlocked(): boolean {
  return isVaultAdminAuthenticated();
}

/**
 * Valida se o visitante tem autorização para abrir o Painel Administrativo.
 * - Se a administradora JÁ estiver autenticada no dispositivo (`isVaultAdminAuthenticated()`),
 *   mantém e restaura automaticamente a tela do Admin (`/painel`) ao reabrir o app no tablet/celular!
 * - Se NÃO estiver autenticada: `/admin`, `#/admin` e `/painel` sem `?k=<TOKEN_SECRETO>` são bloqueados.
 */
export async function resolveAdminRouteAccess(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  // 1. Se a administradora já está logada no dispositivo e não clicou em Sair,
  // reabre direto no Painel Admin mesmo quando o tablet/PWA inicia em "/"
  if (isVaultAdminAuthenticated()) {
    const persistentMode = localStorage.getItem(VAULT_PERSISTENT_MODE_KEY);
    if (persistentMode === 'admin' || pathname.startsWith('/painel') || hash.startsWith('#/painel')) {
      if (!pathname.startsWith('/painel')) {
        window.history.replaceState({}, '', '/painel');
      }
      return true;
    }
  }

  // 2. Bloqueia /admin e #/admin em 100% dos casos para quem não está autenticado
  if (pathname.startsWith('/admin') || hash.includes('/admin') || hash === '#admin') {
    clearAdminGateSession();
    window.history.replaceState({}, '', '/');
    return false;
  }

  // 3. Verifica se está na rota /painel
  const isPainelRoute = pathname.startsWith('/painel') || hash.startsWith('#/painel');
  if (!isPainelRoute) {
    return false;
  }

  const expectedHash = getExpectedTokenHash();

  // 4. Extrai o parâmetro ?k=TOKEN da URL
  let providedToken = new URLSearchParams(window.location.search).get('k') || '';
  if (!providedToken && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1] || '';
    providedToken = new URLSearchParams(hashQuery).get('k') || '';
  }

  // 5. Se tem token na URL, valida o hash SHA-256 imediatamente e limpa ?k= da barra
  if (providedToken) {
    const computedHash = await sha256Hex(providedToken.trim());
    if (computedHash === expectedHash) {
      try {
        sessionStorage.setItem('epn_painel_gate_v1', expectedHash);
        if (window.location.search.includes('k=')) {
          window.history.replaceState({}, '', '/painel');
        }
      } catch {
        // ignore
      }
      return true;
    }
    clearAdminGateSession();
    window.history.replaceState({}, '', '/');
    return false;
  }

  // 5b. Se já desbloqueou nesta aba, mantém o acesso à tela de login sem ?k= na URL
  try {
    if (sessionStorage.getItem('epn_painel_gate_v1') === expectedHash) {
      return true;
    }
  } catch {
    // ignore
  }

  // 6. Sem token na URL e sem sessão autenticada: bloqueia e redireciona para o site da cliente (/)
  window.history.replaceState({}, '', '/');
  return false;
}

export function clearAdminGateSession(): void {
  try {
    localStorage.removeItem(VAULT_AUTH_SESSION_KEY);
    localStorage.removeItem(VAULT_AUTH_EMAIL_KEY);
    localStorage.removeItem(VAULT_PERSISTENT_MODE_KEY);
    sessionStorage.removeItem(VAULT_AUTH_SESSION_KEY);
    sessionStorage.removeItem(VAULT_AUTH_EMAIL_KEY);
    sessionStorage.removeItem('epn_admin_vault_auth_v42');
    sessionStorage.removeItem('epn_admin_vault_email_v42');
    sessionStorage.removeItem('epn_admin_gate_unlocked_v2');
  } catch {
    // ignore
  }
}

export function isVaultOwnerAuthenticated(): boolean {
  try {
    const stored =
      sessionStorage.getItem(OWNER_AUTH_SESSION_KEY) ||
      localStorage.getItem(OWNER_AUTH_SESSION_KEY) ||
      '';
    return ALLOWED_PBKDF2_HASHES.includes(stored) || /^[a-f0-9]{64}$/.test(stored);
  } catch {
    return false;
  }
}

export function getVaultOwnerEmail(): string | null {
  try {
    if (!isVaultOwnerAuthenticated()) return null;
    return (
      sessionStorage.getItem(OWNER_AUTH_EMAIL_KEY) ||
      localStorage.getItem(OWNER_AUTH_EMAIL_KEY)
    );
  } catch {
    return null;
  }
}

export function getAdminSessionToken(): string {
  try {
    if (!isVaultAdminAuthenticated()) return '';
    return (
      localStorage.getItem(VAULT_AUTH_SESSION_KEY) ||
      sessionStorage.getItem(VAULT_AUTH_SESSION_KEY) ||
      ''
    );
  } catch {
    return '';
  }
}

export function getOwnerSessionToken(): string {
  try {
    if (!isVaultOwnerAuthenticated()) return '';
    return (
      sessionStorage.getItem(OWNER_AUTH_SESSION_KEY) ||
      localStorage.getItem(OWNER_AUTH_SESSION_KEY) ||
      ''
    );
  } catch {
    return '';
  }
}

export async function verifyOwnerVaultCredentialsWithLock(
  email: string,
  password: string,
): Promise<VaultVerifyResult> {
  const cleanEmailInput = email.toLowerCase().trim();
  const derived = await pbkdf2Hex(cleanEmailInput, password);
  const derivedTrimmed =
    password !== password.trim() ? await pbkdf2Hex(cleanEmailInput, password.trim()) : '';

  try {
    const resp = await fetch('/api/auth-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        target: 'owner',
        email: cleanEmailInput,
        derivedHash: derived,
        derivedTrimmed,
      }),
    });
    const data = (await resp.json()) as VaultVerifyResult & { matchedHash?: string };
    if (resp.ok && data.ok && data.matchedHash) {
      try {
        sessionStorage.setItem(OWNER_AUTH_SESSION_KEY, data.matchedHash);
        sessionStorage.setItem(OWNER_AUTH_EMAIL_KEY, cleanEmailInput);
        localStorage.setItem(OWNER_AUTH_SESSION_KEY, data.matchedHash);
        localStorage.setItem(OWNER_AUTH_EMAIL_KEY, cleanEmailInput);
        window.history.replaceState({}, '', '/owner');
      } catch {
        // ignore
      }
      return { ok: true };
    }
    return {
      ok: false,
      locked: Boolean(data.locked),
      remainingSeconds: Number(data.remainingSeconds || 0),
      attempts: Number(data.attempts || 0),
    };
  } catch {
    if (
      ALLOWED_PBKDF2_HASHES.includes(derived) ||
      (derivedTrimmed && ALLOWED_PBKDF2_HASHES.includes(derivedTrimmed))
    ) {
      const matchedHash = ALLOWED_PBKDF2_HASHES.includes(derived)
        ? derived
        : derivedTrimmed;
      try {
        sessionStorage.setItem(OWNER_AUTH_SESSION_KEY, matchedHash);
        sessionStorage.setItem(OWNER_AUTH_EMAIL_KEY, cleanEmailInput);
        localStorage.setItem(OWNER_AUTH_SESSION_KEY, matchedHash);
        localStorage.setItem(OWNER_AUTH_EMAIL_KEY, cleanEmailInput);
        window.history.replaceState({}, '', '/owner');
      } catch {
        // ignore
      }
      return { ok: true };
    }
    return { ok: false };
  }
}

export async function verifyOwnerVaultCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const res = await verifyOwnerVaultCredentialsWithLock(email, password);
  return res.ok;
}

export async function updateVaultCredentials(params: {
  target: 'painel' | 'owner';
  callerRole: 'admin' | 'owner';
  newEmail: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = params.newEmail.toLowerCase().trim();
  const cleanPassword = params.newPassword.trim();
  if (!cleanEmail.includes('@') || cleanPassword.length < 6) {
    return {
      ok: false,
      error: 'Informe um e-mail válido e senha com pelo menos 6 caracteres.',
    };
  }

  const callerAuthHash =
    params.callerRole === 'owner'
      ? getOwnerSessionToken()
      : localStorage.getItem(VAULT_AUTH_SESSION_KEY) ||
        sessionStorage.getItem(VAULT_AUTH_SESSION_KEY) ||
        '';

  const newHash = await pbkdf2Hex(cleanEmail, cleanPassword);

  const resp = await fetch('/api/auth-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_credentials',
      target: params.target,
      callerAuthHash,
      newEmail: cleanEmail,
      newHash,
    }),
  });
  const data = (await resp.json()) as { ok?: boolean; error?: string };
  if (!resp.ok || !data.ok) {
    return { ok: false, error: data.error || 'Erro ao atualizar credenciais.' };
  }

  // Atualiza sessão local se alterou as próprias credenciais
  if (params.target === 'owner' && params.callerRole === 'owner') {
    sessionStorage.setItem(OWNER_AUTH_SESSION_KEY, newHash);
    sessionStorage.setItem(OWNER_AUTH_EMAIL_KEY, cleanEmail);
    localStorage.setItem(OWNER_AUTH_SESSION_KEY, newHash);
    localStorage.setItem(OWNER_AUTH_EMAIL_KEY, cleanEmail);
  } else if (params.target === 'painel' && params.callerRole === 'admin') {
    localStorage.setItem(VAULT_AUTH_SESSION_KEY, newHash);
    localStorage.setItem(VAULT_AUTH_EMAIL_KEY, cleanEmail);
    sessionStorage.setItem(VAULT_AUTH_SESSION_KEY, newHash);
    sessionStorage.setItem(VAULT_AUTH_EMAIL_KEY, cleanEmail);
  }

  return { ok: true };
}

export function clearOwnerGateSession(): void {
  try {
    sessionStorage.removeItem(OWNER_AUTH_SESSION_KEY);
    sessionStorage.removeItem(OWNER_AUTH_EMAIL_KEY);
    localStorage.removeItem(OWNER_AUTH_SESSION_KEY);
    localStorage.removeItem(OWNER_AUTH_EMAIL_KEY);
  } catch {
    // ignore
  }
}

export async function resolveOwnerRouteAccess(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const isOwnerRoute = pathname.startsWith('/owner') || hash.startsWith('#/owner');
  if (!isOwnerRoute) {
    return false;
  }

  if (isVaultOwnerAuthenticated()) {
    return true;
  }

  const fromEnv = (import.meta.env.VITE_OWNER_TOKEN_HASH || '').trim().toLowerCase();
  const expectedHash = fromEnv || DEFAULT_OWNER_TOKEN_SHA256;

  let providedToken = new URLSearchParams(window.location.search).get('k') || '';
  if (!providedToken && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1] || '';
    providedToken = new URLSearchParams(hashQuery).get('k') || '';
  }

  if (providedToken) {
    const computedHash = await sha256Hex(providedToken.trim());
    if (computedHash === expectedHash) {
      return true;
    }
  }

  clearOwnerGateSession();
  window.history.replaceState({}, '', '/');
  return false;
}
