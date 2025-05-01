
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';

export interface AudioContextState {
  context: Tone.BaseContext | null;
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
  const contextIdRef = useRef<string | null>(null);

  // Initialize audio context
  useEffect(() => {
    try {
      // Clean up any existing nodes first
      if (masterVolumeRef.current) {
        masterVolumeRef.current.dispose();
      }
      
      // Tone.js automatically creates its context
      const toneContext = Tone.getContext();
      contextIdRef.current = toneContext.toString(); // Store context identifier
      
      const masterVolume = new Tone.Volume(-12).toDestination();
      masterVolumeRef.current = masterVolume;
      
      // Restore master volume from session storage
      const savedMasterVolume = sessionStorage.getItem('trackAlchemy_master_volume');
      if (savedMasterVolume) {
        const volumeValue = parseFloat(savedMasterVolume);
        if (!isNaN(volumeValue)) {
          masterVolume.volume.value = volumeValue;
        }
      }
      
      setState({
        context: toneContext,
        isStarted: false,
        isLoaded: true,
        error: null,
        masterVolume,
      });
      
      console.log("Audio context initialized with ID:", contextIdRef.current);
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
      console.log(`Setting master volume to ${volume}dB`);
      masterVolumeRef.current.volume.value = volume;
      
      // Save to session storage
      sessionStorage.setItem('trackAlchemy_master_volume', volume.toString());
      
      // Update state to reflect the new volume
      setState(prev => ({
        ...prev,
        masterVolume: masterVolumeRef.current
      }));
    }
  }, []);
  
  // Get context ID for checking
  const getContextId = useCallback(() => {
    return contextIdRef.current;
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
    getContextId,
  };
}
