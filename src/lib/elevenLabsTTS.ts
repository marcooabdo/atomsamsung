let currentAudio: HTMLAudioElement | null = null;
let elevenlabsAvailable: boolean | null = null;

export const checkElevenLabsConnection = async (): Promise<{ ok: boolean; error?: string }> => {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    elevenlabsAvailable = false;
    return { ok: false, error: 'ElevenLabs API key ou Voice ID nao configurado' };
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
    });

    if (response.ok) {
      elevenlabsAvailable = true;
      return { ok: true };
    }

    elevenlabsAvailable = false;
    if (response.status === 401) {
      return { ok: false, error: 'Chave ElevenLabs invalida ou expirada' };
    }
    return { ok: false, error: `ElevenLabs erro: ${response.status}` };
  } catch {
    elevenlabsAvailable = false;
    return { ok: false, error: 'Falha ao conectar com ElevenLabs' };
  }
};

export const isElevenLabsAvailable = (): boolean | null => elevenlabsAvailable;

function speakWithBrowserTTS(text: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve({ ok: false, error: 'Speech synthesis not available' });
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onend = () => resolve({ ok: true });
    utterance.onerror = () => resolve({ ok: false, error: 'Browser TTS error' });

    window.speechSynthesis.speak(utterance);
  });
}

export const speakGia = async (text: string): Promise<{ ok: boolean; error?: string }> => {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return speakWithBrowserTTS(text);
  }

  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        }
      }),
    });

    if (!response.ok) {
      elevenlabsAvailable = false;
      return speakWithBrowserTTS(text);
    }

    elevenlabsAvailable = true;
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    return new Promise((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve({ ok: true });
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve(speakWithBrowserTTS(text));
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve(speakWithBrowserTTS(text));
      });
    });
  } catch {
    elevenlabsAvailable = false;
    return speakWithBrowserTTS(text);
  }
};

export const stopGiaSpeaking = (): void => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
};

export const isGiaSpeaking = (): boolean => {
  return (currentAudio !== null && !currentAudio.paused) || window.speechSynthesis?.speaking;
};
