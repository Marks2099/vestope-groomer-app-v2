import { openPhotoCamera, pickPhotoFromGallery } from './photo-capture.js';

let installedRows = new WeakSet();

function installRidePhotoControls() {
  document.querySelectorAll('.ride-photo-row').forEach((row) => {
    if (installedRows.has(row)) return;
    const input = row.querySelector('#ridePhotoInput');
    const originalButton = row.querySelector('#ridePhotoButton');
    if (!input || !originalButton) return;

    installedRows.add(row);
    const wasBusy = originalButton.disabled;
    input.removeAttribute('capture');
    originalButton.remove();

    const controls = document.createElement('div');
    controls.className = 'ride-photo-choice-grid';
    controls.innerHTML = `
      <button type="button" class="ride-photo-choice camera">📷 Vyfotit</button>
      <button type="button" class="ride-photo-choice gallery">🖼️ Z galerie</button>`;
    row.prepend(controls);

    const cameraButton = controls.querySelector('.camera');
    const galleryButton = controls.querySelector('.gallery');
    cameraButton.disabled = wasBusy;
    galleryButton.disabled = wasBusy;

    cameraButton.addEventListener('click', async () => {
      if (cameraButton.disabled) return;
      setBusy(true);
      try {
        await openPhotoCamera(async (file) => submitFileToOriginalInput(file, input));
      } catch (error) {
        showPhotoError(row, error?.message || 'Fotoaparát se nepodařilo otevřít.');
      } finally {
        setBusy(false);
      }
    });

    galleryButton.addEventListener('click', () => {
      if (galleryButton.disabled) return;
      input.removeAttribute('capture');
      pickPhotoFromGallery((file) => submitFileToOriginalInput(file, input));
    });

    function setBusy(busy) {
      cameraButton.disabled = busy;
      galleryButton.disabled = busy;
      if (busy) cameraButton.textContent = 'OTEVÍRÁM FOTOAPARÁT…';
      else cameraButton.textContent = '📷 Vyfotit';
    }
  });
}

function submitFileToOriginalInput(file, input) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } catch {
    const row = input.closest('.ride-photo-row');
    showPhotoError(row, 'Fotku se nepodařilo předat aplikaci ke zpracování. Zkus prosím galerii znovu.');
  }
}

function showPhotoError(row, message) {
  if (!row) return;
  let error = row.querySelector('.ride-photo-error');
  if (!error) {
    error = document.createElement('div');
    error.className = 'ride-photo-error';
    row.appendChild(error);
  }
  error.textContent = message;
}

export function installPhase6RidePhoto() {
  const observer = new MutationObserver(installRidePhotoControls);
  observer.observe(document.body, { childList: true, subtree: true });
  installRidePhotoControls();
}
