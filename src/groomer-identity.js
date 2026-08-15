const GROOMER_USERNAME = 'PěšákVeStopě';
const STYLE_ID = 'groomer-identity-style';

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = '.profile-username{margin-top:2px;color:#1769aa;font-size:15px;font-weight:900;letter-spacing:.01em}';
  document.head.appendChild(style);
}

function injectUsername() {
  const title = document.querySelector('#profileTitle');
  if (!title || title.parentElement?.querySelector('.profile-username')) return;
  const username = document.createElement('div');
  username.className = 'profile-username';
  username.textContent = GROOMER_USERNAME;
  title.insertAdjacentElement('afterend', username);
}

installStyle();
new MutationObserver(injectUsername).observe(document.body, { childList: true, subtree: true });
injectUsername();
