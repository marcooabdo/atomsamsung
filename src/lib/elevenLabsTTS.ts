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
  } catch (err) {
    elevenlabsAvailable = false;
    return { ok: false, error: 'Falha ao conectar com ElevenLabs' };
  }
};

export const isElevenLabsAvailable = (): boolean | null => elevenlabsAvailable;

export const speakGia = async (text: string): Promise<{ ok: boolean; error?: string }> => {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return { ok: false, error: 'ElevenLabs nao configurado' };
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
      if (response.status === 401) {
        return { ok: false, error: 'Chave ElevenLabs invalida ou expirada' };
      }
      return { ok: false, error: `ElevenLabs erro: ${response.status}` };
    }

    elevenlabsAvailable = true;
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };

    await audio.play();
    return { ok: true };
  } catch (error) {
    elevenlabsAvailable = false;
    return { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
};

export const stopGiaSpeaking = (): void => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
};

export const isGiaSpeaking = (): boolean => {
  return currentAudio !== null && !currentAudio.paused;
};
