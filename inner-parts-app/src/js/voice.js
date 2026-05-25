import { Filesystem, Directory } from '@capacitor/filesystem';

const AUDIO_DIR = 'audio';

export async function ensureMicPermission() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start(250);
  return {
    stop: () => new Promise(resolve => {
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.stop();
    }),
  };
}

export async function saveAudio(blob) {
  const ext = blob.type.split('/')[1]?.split(';')[0] || 'webm';
  const path = `${AUDIO_DIR}/rec_${Date.now()}.${ext}`;

  await Filesystem.mkdir({
    path: AUDIO_DIR,
    directory: Directory.Documents,
    recursive: true,
  }).catch(() => {});

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  await Filesystem.writeFile({ path, data: base64, directory: Directory.Documents });

  const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });
  return uri;
}

export function convertAudioSrc(nativeUri) {
  return window.Capacitor?.convertFileSrc(nativeUri) ?? nativeUri;
}
