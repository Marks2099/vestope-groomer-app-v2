import { openPhotoCamera } from './photo-capture.js';

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

    const cameraButton = document.createElement('button');
    cameraButton.type = 'button';
    cameraButton.className = 'ride-photo-button';
    cameraButton.textContent = '📷 Vyfotit fotku';
    cameraButton.disabled = wasBusy;
    row.prepend(cameraButton);

    cameraButton.addEventListener('click', async () => {
      if (cameraButton.disabled) return;
      cameraButton.disabled = true;
      cameraButton.textContent = 'OTEVÍRÁM FOTOAPARÁT…';
      try {
        await openPhotoCamera(async (file) => submitFileToOriginalInput(file, input));
      } catch (error) {
        showPhotoError(row, error?.message || 'Fotoaparát se nepodařilo otevřít.');
      } finally {
        cameraButton.disabled = false;
        cameraButton.textContent = '📷 Vyfotit fotku';
      }
    });
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
    showPhotoError(row, 'Fotku se nepodařilo předat aplikaci ke zpracování.');
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
