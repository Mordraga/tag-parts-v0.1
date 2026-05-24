// voice.js — Web Speech API wrapper
// Future upgrade: swap internals for @capacitor-community/speech-recognition (v7 compat pending)

const SILENCE_MS = 1800; // how long after last speech before auto-finalizing

// getUserMedia pre-flight: Capacitor's WebChromeClient handles this permission path correctly,
// whereas SpeechRecognition's own permission request goes through a path Capacitor can't forward.
async function ensureMicPermission() {
  if (!navigator.mediaDevices?.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function startVoice(onInterim, onFinal, onUnavailable) {
  const Recog = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recog) {
    onUnavailable();
    return null;
  }

  const permitted = await ensureMicPermission();
  if (!permitted) {
    onUnavailable();
    return null;
  }

  let finalTranscript = '';
  let active = true;      // false once silence timer fires or stopVoice() is called
  let silenceTimer = null;
  let r = null;

  function doStart() {
    if (!active) return;
    r = new Recog();
    r.continuous = false;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';

    r.onresult = (e) => {
      // Reset silence timer on every new speech chunk
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(finalize, SILENCE_MS);

      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interim += t;
        }
      }
      onInterim(finalTranscript + interim);
    };

    r.onend = () => {
      // The browser ended early (common on Android) — restart unless we're done
      if (active) {
        try { doStart(); } catch (_) {}
      }
    };

    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false;
        clearTimeout(silenceTimer);
        onUnavailable();
      }
      // Other errors (network, aborted): onend will fire and restart if still active
    };

    try { r.start(); } catch (_) {}
  }

  function finalize() {
    active = false;
    clearTimeout(silenceTimer);
    try { r?.stop(); } catch (_) {}
    onFinal(finalTranscript || null);
  }

  // Start silence timer immediately — if user never speaks, finalize after timeout
  silenceTimer = setTimeout(finalize, SILENCE_MS * 3);
  doStart();

  // Return a handle so stopVoice() can cancel early
  return { stop: finalize };
}

export function stopVoice(handle) {
  if (handle?.stop) handle.stop();
}
