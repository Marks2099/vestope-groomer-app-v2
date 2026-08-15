let activeStream = null;
let activeFacingMode = 'environment';

export function pickPhotoFromGallery(onFile) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.addEventListener('change', () => {
    const file = input.files?.[0] || null;
    input.remove();
    if (file) onFile(file);
  }, { once: true });
  document.body.appendChild(input);
  input.click();
}

export async function openPhotoCamera(onFile) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Fotoaparát není v tomto prohlížeči dostupný. Zkus prosím galerii.');
  }

  activeFacingMode = 'environment';
  await renderCamera(onFile);
}

async function renderCamera(onFile) {
  closePhotoCamera();
  const modal = document.createElement('div');
  modal.className = 'photo-camera-modal';
  modal.innerHTML = `
    <div class="photo-camera-card" role="dialog" aria-modal="true" aria-label="Fotoaparát">
      <div class="photo-camera-header">
        <strong>Pořídit fotku</strong>
        <button type="button" class="photo-camera-close" aria-label="Zavřít">×</button>
      </div>
      <div class="photo-camera-preview-wrap">
        <video class="photo-camera-preview" autoplay playsinline muted></video>
      </div>
      <div class="photo-camera-actions">
        <button type="button" class="photo-camera-switch">↔ Přepnout kameru</button>
        <button type="button" class="photo-camera-capture">📷 Vyfotit</button>
      </div>
      <div class="photo-camera-hint">Můžeš použít zadní i přední kameru.</div>
    </div>`;
  document.body.appendChild(modal);

  const video = modal.querySelector('.photo-camera-preview');
  const closeButton = modal.querySelector('.photo-camera-close');
  const switchButton = modal.querySelector('.photo-camera-switch');
  const captureButton = modal.querySelector('.photo-camera-capture');

  closeButton.addEventListener('click', closePhotoCamera);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closePhotoCamera();
  });

  const startStream = async () => {
    stopStream();
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: activeFacingMode }, width: { ideal: 1600 }, height: { ideal: 1200 } },
      });
      video.srcObject = activeStream;
      await video.play();
    } catch (error) {
      closePhotoCamera();
      const message = error?.name === 'NotAllowedError'
        ? 'Přístup ke kameře byl zamítnut. Povol kameru pro tento web nebo použij galerii.'
        : 'Fotoaparát se nepodařilo otevřít. Zkus prosím galerii.';
      throw new Error(message);
    }
  };

  switchButton.addEventListener('click', async () => {
    switchButton.disabled = true;
    activeFacingMode = activeFacingMode === 'environment' ? 'user' : 'environment';
    try { await startStream(); } catch (error) { alert(error.message); }
    switchButton.disabled = false;
  });

  captureButton.addEventListener('click', async () => {
    if (!video.videoWidth || !video.videoHeight) return;
    captureButton.disabled = true;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
    closePhotoCamera();
    if (blob) {
      const file = new File([blob], `fotka-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
      await onFile(file);
    }
  });

  await startStream();
}

export function closePhotoCamera() {
  stopStream();
  document.querySelector('.photo-camera-modal')?.remove();
}

function stopStream() {
  if (!activeStream) return;
  activeStream.getTracks().forEach((track) => track.stop());
  activeStream = null;
}
