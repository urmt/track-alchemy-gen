
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
  const initializingRef = useRef<boolean>(false);

  // Initialize audio context
  useEffect(() => {
    // Prevent multiple initializations
    if (initializingRef.current) return;
    initializingRef.current = true;
    
    try {
      // Clean up any existing nodes first
      if (masterVolumeRef.current) {
        masterVolumeRef.current.dispose();
      }
      
      // Tone.js automatically creates its context
      const toneContext = Tone.getContext();
      
      // Store unique context identifier
      contextIdRef.current = toneContext.toString(); 
      
      const masterVolume = new Tone.Volume(-12).toDestination();
      masterVolumeRef.current = masterVolume;
      
      // Restore master volume from session storage
      const savedMasterVolume = sessionStorage.getItem('trackAlchemy_master_volume');
      if (savedMasterVolume) {
        const volumeValue = parseFloat(savedMasterVolume);
        if (!isNaN(volumeValue)) {
          masterVolume.volume.value = volumeValue;
          console.log(`Restored master volume: ${volumeValue}dB`);
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
      
      // Auto-start context on Safari and iOS
      if (/iPhone|iPad|iPod|Safari/i.test(navigator.userAgent) && !(/Chrome/i.test(navigator.userAgent))) {
        console.log("Attempting auto-start for Safari/iOS");
        Tone.start().catch(err => console.warn("Auto-start failed:", err));
      }
    } catch (err) {
      console.error("Failed to initialize audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to initialize audio context" 
      }));
    } finally {
      initializingRef.current = false;
    }
    
    return () => {
      // Clean up
      if (masterVolumeRef.current) {
        masterVolumeRef.current.dispose();
        masterVolumeRef.current = null;
      }
    };
  }, []);

  // Start audio context with error handling and timeout
  const startContext = useCallback(async () => {
    try {
      if (state.isStarted) {
        console.log("Context already started");
        return;
      }
      
      console.log("Starting audio context...");
      
      // Set a timeout to prevent hanging
      const startPromise = Tone.start();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Context start timed out")), 5000);
      });
      
      await Promise.race([startPromise, timeoutPromise]);
      
      setState(prev => ({ ...prev, isStarted: true }));
      console.log("Audio context started successfully");
    } catch (err) {
      console.error("Failed to start audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to start audio context. Please try again." 
      }));
      
      // Force a context reset on error
      try {
        // Instead of calling close() directly, we'll dispose the context
        if (state.context) {
          state.context.dispose();
        }
        console.log("Closed failed audio context");
      } catch (closeErr) {
        console.warn("Error while closing context:", closeErr);
      }
    }
  }, [state.isStarted, state.context]);
  
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
  
  // Play a test tone with safety checks
  const playTestTone = useCallback(async () => {
    try {
      if (!state.isStarted) {
        await startContext();
      }
      
      if (!masterVolumeRef.current) {
        console.error("Master volume not initialized");
        return;
      }
      
      const osc = new Tone.Oscillator({
        frequency: 440,
        type: "sine",
        volume: -12 // Safe volume level
      }).connect(masterVolumeRef.current);
      
      osc.start().stop("+0.5");
      
      // Automatically dispose after playback
      setTimeout(() => {
        osc.dispose();
      }, 600);
      
      console.log("Test tone played successfully");
    } catch (err) {
      console.error("Error playing test tone:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to play test tone. Please try again." 
      }));
    }
  }, [state.isStarted, startContext]);
  
  // Reset context if needed
  const resetContext = useCallback(async () => {
    try {
      console.log("Resetting audio context");
      
      // Clean up existing context
      if (masterVolumeRef.current) {
        masterVolumeRef.current.dispose();
        masterVolumeRef.current = null;
      }
      
      // Close existing context
      if (state.context) {
        // Replace close() with dispose()
        state.context.dispose();
      }
      
      // Create new context
      Tone.start();
      const newContext = Tone.getContext();
      const newMasterVolume = new Tone.Volume(-12).toDestination();
      masterVolumeRef.current = newMasterVolume;
      contextIdRef.current = newContext.toString();
      
      setState({
        context: newContext,
        isStarted: true,
        isLoaded: true,
        error: null,
        masterVolume: newMasterVolume,
      });
      
      console.log("Audio context reset with new ID:", contextIdRef.current);
      return true;
    } catch (err) {
      console.error("Failed to reset audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to reset audio context" 
      }));
      return false;
    }
  }, [state.context]);

  return {
    ...state,
    startContext,
    setMasterVolume,
    playTestTone,
    getContextId,
    resetContext
  };
}
