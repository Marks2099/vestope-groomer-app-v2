import { installPwaSupport, hasOfflineAuthorization, setOfflineAuthorization } from './pwa-install.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://wlxrqqtvpqumvbbdfpuv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aXH1aT3OZN2p0mMzfWLt0w_YGFBFaQl';
const LOGIN_USERNAME = 'PěšákVeStopě';
const LOGIN_EMAIL = 'pesak@vestope.cz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

window.__vestopeLogout = async function () {
  try { await supabase.auth.signOut({ scope: 'local' }); } finally {
    setOfflineAuthorization(false);
    window.location.reload();
  }
};

window.__vestopeGetGroomerProfile = async function () {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from('groomers')
    .select('id,name,username,email,phone,role,active')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

window.__vestopeUpdateGroomerContacts = async function ({ email, phone } = {}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user?.id) throw new Error('Uživatel není přihlášen.');

  const normalizedEmail = String(email ?? '').trim() || null;
  const normalizedPhone = String(phone ?? '').trim() || null;

  const { data, error } = await supabase
    .from('groomers')
    .update({ email: normalizedEmail, phone: normalizedPhone })
    .eq('user_id', session.user.id)
    .select('id,name,username,email,phone,role,active')
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

const app = document.querySelector('#app');

function escapeHtml(value) { return String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' })[char]); }
function isOffline() { return navigator.onLine === false; }

function renderLogin(error = '') {
  const offlineMessage = isOffline() && hasOfflineAuthorization() ? 'Jsi offline. Ověřený přístup z tohoto zařízení je připraven.' : '';
  app.innerHTML = `<section class="welcome-card auth-card"><div class="online-badge"><span></span> ${isOffline() ? 'OFFLINE' : 'ONLINE'}</div><img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz"><div class="eyebrow">PŘIHLÁŠENÍ</div><h1>Vítej zpátky.</h1><p>${offlineMessage || 'Pro pokračování do aplikace VeStope.cz se přihlas.'}</p><form id="loginForm" class="auth-form"><label>Uživatelské jméno<input id="loginUsername" type="text" value="${escapeHtml(LOGIN_USERNAME)}" autocomplete="username" required></label><label>Heslo<span class="password-field"><input id="loginPassword" type="password" autocomplete="current-password" required><button id="togglePassword" type="button" aria-label="Zobrazit heslo" aria-pressed="false"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.6"/></svg></button></span></label>${error ? `<div class="auth-error" role="alert">${escapeHtml(error)}</div>` : ''}<button class="phase-button" type="submit">${isOffline() && hasOfflineAuthorization() ? 'POKRAČOVAT OFFLINE' : 'PŘIHLÁSIT SE'}</button></form><footer>VeStope.cz – Evidence a monitoring rolbařů</footer></section>`;
  document.querySelector('#loginForm').addEventListener('submit', handleLogin);
  document.querySelector('#togglePassword').addEventListener('click', togglePasswordVisibility);
}

function togglePasswordVisibility(){
  const input=document.querySelector('#loginPassword'); const button=document.querySelector('#togglePassword');
  if(!input||!button)return;
  const visible=input.type==='text'; input.type=visible?'password':'text';
  button.innerHTML=visible?'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.6"/></svg>':'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.9A10.5 10.5 0 0 1 12 7c6.2 0 9.5 5 9.5 5a17 17 0 0 1-3.1 3.3M6.1 6.9C3.8 8.2 2.5 12 2.5 12s3.3 5 9.5 5c1.1 0 2.1-.2 3-.5"/></svg>';
  button.setAttribute('aria-label',visible?'Zobrazit heslo':'Skrýt heslo'); button.setAttribute('aria-pressed',String(!visible));
}

async function handleLogin(event){
  event.preventDefault();
  if (isOffline()) {
    if (hasOfflineAuthorization()) return bootApp(true);
    renderLogin('Toto zařízení ještě nemá uložené offline přihlášení. Přihlas se jednou online a potom bude aplikace fungovat i bez signálu.');
    return;
  }
  const button=event.currentTarget.querySelector('button[type="submit"]');
  const username=document.querySelector('#loginUsername').value.trim(); const password=document.querySelector('#loginPassword').value;
  button.disabled=true; button.textContent='PŘIHLAŠUJI…';
  const email=username.toLowerCase()===LOGIN_USERNAME.toLowerCase()?LOGIN_EMAIL:username;
  try {
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    setOfflineAuthorization(true);
    await bootApp(false);
  } catch (error) {
    button.disabled=false; button.textContent='PŘIHLÁSIT SE';
    renderLogin(error?.message?.includes('fetch') ? 'Přihlášení se nepodařilo ověřit. Zkontroluj připojení k internetu.' : 'Nesprávné uživatelské jméno nebo heslo.');
  }
}

async function bootApp(forceOffline = false){
  let session = null;
  try { const result = await supabase.auth.getSession(); session = result?.data?.session || null; } catch (_) {}
  const offlineAllowed = forceOffline || (isOffline() && hasOfflineAuthorization());
  if(!session && !offlineAllowed) return renderLogin(isOffline() ? 'Offline přístup zatím není aktivovaný. Přihlas se jednou online.' : '');
  if(session) setOfflineAuthorization(true);
  try {
    await import('../app.js');
    await import('./phase5-report-form.js').then(({installPhase5ReportForm})=>installPhase5ReportForm());
    await import('./phase6-ride-photo.js').then(({installPhase6RidePhoto})=>installPhase6RidePhoto());
    await import('./groomer-profile.js').then(({installGroomerProfile})=>installGroomerProfile());
    await import('./groomer-contact.js').then(({installGroomerContact})=>installGroomerContact());
  } catch(error) {
    renderLogin(isOffline() ? 'Offline verze není ještě kompletně uložená v zařízení. Připoj se jednou online a otevři aplikaci znovu.' : 'Aplikaci se nepodařilo načíst. Zkuste stránku obnovit.');
    console.error(error);
  }
}

installPwaSupport();
window.addEventListener('online', () => { if (document.querySelector('.auth-card')) bootApp(); });
window.addEventListener('offline', () => { if (document.querySelector('.auth-card')) renderLogin(); });
renderLogin();
bootApp();