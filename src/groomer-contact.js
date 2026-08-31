const CONTACT_STYLE_ID = 'groomer-contact-style';

export function installGroomerContact() {
  installStyles();

  const observer = new MutationObserver(() => {
    const summary = document.querySelector('.profile-modal #profileTitle');
    const modal = summary?.closest('.profile-modal');
    if (!modal || modal.querySelector('#groomerContactCard')) return;
    mountContactCard(modal);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

async function mountContactCard(modal) {
  const anchor = modal.querySelector('.profile-stats') || modal.querySelector('.profile-subtitle');
  if (!anchor) return;

  const section = document.createElement('section');
  section.id = 'groomerContactCard';
  section.className = 'contact-card';
  section.innerHTML = `
    <div class="contact-card-head">
      <div>
        <h3>Kontaktní údaje</h3>
        <small>Volitelné údaje. Můžeš je kdykoliv doplnit nebo smazat.</small>
      </div>
      <button id="editContactButton" type="button" disabled>NAČÍTÁM…</button>
    </div>
    <div class="contact-card-body">
      <div class="contact-row"><span>Jméno</span><strong id="contactName">—</strong></div>
      <div class="contact-row"><span>Uživatelské jméno</span><strong id="contactUsername">—</strong></div>
      <div class="contact-row"><span>E-mail</span><strong id="contactEmail">—</strong></div>
      <div class="contact-row"><span>Telefon</span><strong id="contactPhone">—</strong></div>
    </div>
    <p id="contactMessage" class="contact-message" hidden></p>
  `;

  anchor.insertAdjacentElement('afterend', section);

  const editButton = section.querySelector('#editContactButton');

  if (navigator.onLine === false) {
    section.querySelector('#contactMessage').hidden = false;
    section.querySelector('#contactMessage').textContent = 'Kontaktní údaje lze upravovat po připojení k internetu.';
    editButton.textContent = 'OFFLINE';
    return;
  }

  try {
    const profile = await getProfile();
    renderProfile(section, profile);
    editButton.disabled = false;
    editButton.textContent = 'UPRAVIT';
    editButton.addEventListener('click', () => openContactEditor(modal, profile));
  } catch (error) {
    console.error('Nepodařilo se načíst kontaktní údaje rolbaře:', error);
    editButton.textContent = 'CHYBA';
    const message = section.querySelector('#contactMessage');
    message.hidden = false;
    message.textContent = 'Kontaktní údaje se nepodařilo načíst.';
  }
}

async function getProfile() {
  if (typeof window.__vestopeGetGroomerProfile !== 'function') {
    throw new Error('Profil rolbaře není dostupný.');
  }
  return await window.__vestopeGetGroomerProfile();
}

function renderProfile(section, profile) {
  section.querySelector('#contactName').textContent = profile?.name || '—';
  section.querySelector('#contactUsername').textContent = profile?.username || '—';
  section.querySelector('#contactEmail').textContent = profile?.email || 'Není vyplněn';
  section.querySelector('#contactPhone').textContent = profile?.phone || 'Není vyplněn';
}

function openContactEditor(parentModal, profile) {
  const overlay = document.createElement('div');
  overlay.className = 'profile-overlay nested';
  overlay.innerHTML = `
    <div class="profile-modal contact-editor" role="dialog" aria-modal="true" aria-labelledby="contactEditorTitle">
      <button class="profile-close" type="button" aria-label="Zavřít">×</button>
      <div class="eyebrow">MŮJ PROFIL</div>
      <h2 id="contactEditorTitle">Kontaktní údaje</h2>
      <p class="profile-subtitle">E-mail a telefon jsou volitelné. Uživatelské jméno měnit nelze.</p>

      <label>
        Jméno
        <input type="text" value="${escapeAttr(profile?.name || '')}" disabled>
      </label>

      <label>
        Uživatelské jméno
        <input type="text" value="${escapeAttr(profile?.username || '')}" disabled>
      </label>

      <label>
        E-mail
        <input id="contactEmailInput" type="email" inputmode="email" autocomplete="email" value="${escapeAttr(profile?.email || '')}" placeholder="např. jmeno@email.cz">
      </label>

      <label>
        Telefon
        <input id="contactPhoneInput" type="tel" inputmode="tel" autocomplete="tel" value="${escapeAttr(profile?.phone || '')}" placeholder="např. +420 777 123 456">
      </label>

      <p id="contactEditorMessage" class="contact-message" hidden></p>
      <button id="saveContactButton" class="profile-primary" type="button">ULOŽIT</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.profile-close').addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  overlay.querySelector('#saveContactButton').addEventListener('click', async () => {
    const button = overlay.querySelector('#saveContactButton');
    const message = overlay.querySelector('#contactEditorMessage');
    const email = overlay.querySelector('#contactEmailInput').value.trim();
    const phone = overlay.querySelector('#contactPhoneInput').value.trim();

    if (email && !isValidEmail(email)) {
      message.hidden = false;
      message.textContent = 'Zkontroluj prosím formát e-mailu.';
      return;
    }

    button.disabled = true;
    button.textContent = 'UKLÁDÁM…';
    message.hidden = true;

    try {
      if (typeof window.__vestopeUpdateGroomerContacts !== 'function') {
        throw new Error('Uložení profilu není dostupné.');
      }

      const updated = await window.__vestopeUpdateGroomerContacts({ email, phone });
      const card = parentModal.querySelector('#groomerContactCard');
      if (card) renderProfile(card, updated);
      close();
    } catch (error) {
      console.error('Nepodařilo se uložit kontaktní údaje rolbaře:', error);
      button.disabled = false;
      button.textContent = 'ULOŽIT';
      message.hidden = false;
      message.textContent = 'Kontaktní údaje se nepodařilo uložit. Zkus to znovu.';
    }
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeAttr(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function installStyles() {
  if (document.querySelector(`#${CONTACT_STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = CONTACT_STYLE_ID;
  style.textContent = `
    .contact-card{margin-top:18px;padding:16px;border:1px solid #dbe7f0;border-radius:18px;background:#fff}
    .contact-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
    .contact-card-head h3{margin:0;color:#172235;font-size:16px}
    .contact-card-head small{display:block;margin-top:4px;color:#6b7c90;line-height:1.35}
    .contact-card-head button{border:0;background:#1769aa;color:#fff;border-radius:11px;padding:9px 12px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}
    .contact-card-head button:disabled{opacity:.55;cursor:default}
    .contact-card-body{margin-top:12px;border-top:1px solid #e4edf4}
    .contact-row{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid #e4edf4}
    .contact-row span{color:#6b7c90;font-size:13px}
    .contact-row strong{color:#172235;font-size:13px;text-align:right;overflow-wrap:anywhere}
    .contact-message{margin:12px 0 0;color:#8b5e12;font-size:12px;font-weight:700;line-height:1.4}
    .contact-editor label{display:block;margin-top:16px;color:#42556b;font-size:13px;font-weight:800}
    .contact-editor input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:13px 14px;border:1px solid #d5e3ef;border-radius:13px;background:#fff;color:#172235;font:inherit;outline:none}
    .contact-editor input:focus{border-color:#73aee0;box-shadow:0 0 0 3px rgba(23,105,170,.10)}
    .contact-editor input:disabled{background:#f3f6f8;color:#718297}
    @media(max-width:520px){.contact-card-head{align-items:center}.contact-row{display:block}.contact-row strong{display:block;margin-top:4px;text-align:left}}
  `;

  document.head.appendChild(style);
}
