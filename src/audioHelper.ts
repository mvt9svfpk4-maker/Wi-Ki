// Web Audio & TTS Speech helpers for the Accessibility Kiosk Assistant

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

// Custom Synthisized Audio Feedback
export const playSound = (type: 'right' | 'left' | 'up' | 'down' | 'connected' | 'disconnected' | 'beep') => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'right') {
      // 1 high pulse
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5 note
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'left') {
      // 2 sliding-down low pulses
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(330, now + 0.15);
      gainNode.gain.setValueAtTime(0.15, now);
      
      // Second tap simulated in audio
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(330, ctx.currentTime);
          osc2.frequency.linearRampToValueAtTime(260, ctx.currentTime + 0.15);
          gain2.gain.setValueAtTime(0.15, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.16);
        } catch (e) {}
      }, 100);

      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'up') {
      // Ascending pleasant sweep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.2); // E5
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'down') {
      // Descending pleasant sweep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.2); // C5
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'connected') {
      // Elegant futuristic melody
      const notes = [440, 554, 659, 880]; // A major arpeggio
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + idx * 0.1);
        g.gain.setValueAtTime(0.1, now + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.2);
        o.start(now + idx * 0.1);
        o.stop(now + idx * 0.1 + 0.25);
      });
    } else if (type === 'disconnected') {
      // Descending warning melody
      const notes = [440, 349, 293, 220]; 
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, now + idx * 0.12);
        g.gain.setValueAtTime(0.08, now + idx * 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.22);
        o.start(now + idx * 0.12);
        o.stop(now + idx * 0.12 + 0.25);
      });
    } else if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (error) {
    console.error("Audio Web Synth Error:", error);
  }
};

// Vibration API wrapper with simulation callbacks
export const triggerVibration = (
  direction: 'right' | 'left' | 'up' | 'down',
  onSimulationCallback?: (pulses: number) => void
) => {
  if (typeof navigator === 'undefined') return;

  let pattern: number[] = [];
  let pulseCount = 1;

  switch (direction) {
    case 'right':
      pattern = [100]; // 1 pulse
      pulseCount = 1;
      break;
    case 'left':
      pattern = [100, 100, 100]; // 2 pulses: vibrate, rest, vibrate
      pulseCount = 2;
      break;
    case 'up':
      pattern = [100, 100, 100, 100, 100]; // 3 pulses
      pulseCount = 3;
      break;
    case 'down':
      pattern = [100, 100, 100, 100, 100, 100, 100]; // 4 pulses
      pulseCount = 4;
      break;
  }

  // Trigger web vibration API
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Vibration not allowed or failed:", e);
    }
  }

  // Fallback sound indicator + feedback logs
  if (onSimulationCallback) {
    onSimulationCallback(pulseCount);
  }
};

// Text to Speech (TTS) Helper
export const speakText = (text: string, rate: number = 1.1) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    console.warn("Speech Synthesis not supported by this browser.");
    return;
  }

  try {
    // Cancel any ongoing speech instantly
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR"; // Korean
    utterance.rate = rate; // Speed factor. Slightly faster for accessibility efficiency
    utterance.pitch = 1.0;

    // Find a proper Korean voice if available
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find(v => v.lang.startsWith("ko"));
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error("TTS Speech Synthesis Error:", e);
  }
};

export const cancelSpeech = () => {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};
