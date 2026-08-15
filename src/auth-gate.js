import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://wlxrqqtvpqumvbbdfpuv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_aXH1aT3OZN2p0mMzfWLt0w_YGFBFaQl';
const LOGIN_USERNAME = 'PěšákVeStopě';
const LOGIN_EMAIL = 'pesak@vestope.cz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const app = document.querySelector('#app');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function renderLogin(error = '') {
  app.innerHTML = `<section class="welcome-card auth-card">
    <div class="online-badge"><span></span> ONLINE</div>
    <img class="brand-logo" src="https://raw.githubusercontent.com/Marks2099/vestope-groomer-app/main/logo_vestope.cz.png" alt="VeStope.cz">
    <div class="eyebrow">PŘIHLÁŠENÍ</div>
    <h1>Vítej zpátky.</h1>
    <p>Pro pokračování do aplikace VeStope.cz se přihlas.</p>
    <form id="loginForm" class="auth-form">
      <label>Uživatelské jméno<input id="loginUsername" type="text" value="${escapeHtml(LOGIN_USERNAME)}" autocomplete="username" required></label>
      <label>Heslo<input id="loginPassword" type="password" autocomplete="current-password" required></label>
      ${error ? `<div class="auth-error" role="alert">${escapeHtml(error)}</div>` : ''}
      <button class="phase-button" type="submit">PŘIHLÁSIT SE</button>
    </form>
  </section><footer>VeStope.cz – Evidence a monitoring rolbařů</footer>`;
  document.querySelector('#loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const username = document.querySelector('#loginUsername').value.trim();
  const password = document.querySelector('#loginPassword').value;
  button.disabled = true;
  button.textContent = 'PŘIHLAŠUJI…';
  const email = username.toLowerCase() === LOGIN_USERNAME.toLowerCase() ? LOGIN_EMAIL : username;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    button.disabled = false;
    button.textContent = 'PŘIHLÁSIT SE';
    renderLogin('Nesprávné uživatelské jméno nebo heslo.');
    return;
  }
  await bootApp();
}

async function bootApp() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return renderLogin();
  try {
    await import('../app.js');
    await import('./phase5-report-form.js').then(({ installPhase5ReportForm }) => installPhase5ReportForm());
    await import('./phase6-ride-photo.js').then(({ installPhase6RidePhoto }) => installPhase6RidePhoto());
  } catch (error) {
    renderLogin('Aplikaci se nepodařilo načíst. Zkuste stránku obnovit.');
    console.error(error);
  }
}

renderLogin();
bootApp();
