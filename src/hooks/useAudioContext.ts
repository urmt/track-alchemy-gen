import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';

export interface AudioContextState {
  context: Tone.Context | null;
  isStarted: boolean;
  isLoaded: boolean;
  error: string | null;
  masterVolume: Tone.Volume | null;
}

export function useAudioContext() {
  const [state, setState] = useState<AudioContextState>({
    context: null,
    isStarted: false,
    isLoaded: false,
    error: null,
    masterVolume: null,
  });
  
  const masterVolumeRef = useRef<Tone.Volume | null>(null);

  // Initialize audio context
  useEffect(() => {
    try {
      // Tone.js automatically creates its context
      const toneContext = Tone.getContext();
      const masterVolume = new Tone.Volume(-12).toDestination();
      masterVolumeRef.current = masterVolume;
      
      setState({
        context: toneContext,
        isStarted: false,
        isLoaded: true,
        error: null,
        masterVolume,
      });
      
      console.log("Audio context initialized");
    } catch (err) {
      console.error("Failed to initialize audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to initialize audio context" 
      }));
    }
    
    return () => {
      // Clean up
      if (masterVolumeRef.current) {
        masterVolumeRef.current.dispose();
      }
    };
  }, []);

  // Start audio context
  const startContext = useCallback(async () => {
    try {
      await Tone.start();
      setState(prev => ({ ...prev, isStarted: true }));
      console.log("Audio context started");
    } catch (err) {
      console.error("Failed to start audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to start audio context. Please try again." 
      }));
    }
  }, []);
  
  // Set master volume in dB (-60 to 0)
  const setMasterVolume = useCallback((volume: number) => {
    if (masterVolumeRef.current) {
      masterVolumeRef.current.volume.value = volume;
    }
  }, []);
  
  // Play a test tone
  const playTestTone = useCallback(async () => {
    if (!state.isStarted) {
      await startContext();
    }
    
    const osc = new Tone.Oscillator(440, "sine").connect(masterVolumeRef.current || Tone.getDestination());
    osc.start().stop("+0.5");
    
    // Automatically dispose after playback
    setTimeout(() => {
      osc.dispose();
    }, 600);
  }, [state.isStarted, startContext]);
  
  return {
    ...state,
    startContext,
    setMasterVolume,
    playTestTone,
  };
}
