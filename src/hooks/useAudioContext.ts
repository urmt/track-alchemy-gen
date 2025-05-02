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
    
    const initContext = async () => {
      try {
        console.log("Initializing audio context");
        
        // Clean up any existing nodes first
        if (masterVolumeRef.current) {
          masterVolumeRef.current.dispose();
          masterVolumeRef.current = null;
        }
        
        // Completely dispose any existing Tone.js context
        try {
          const existingContext = Tone.getContext();
          if (existingContext) {
            existingContext.dispose();
            console.log("Disposed existing Tone.js context");
          }
        } catch (err) {
          console.warn("No existing context to dispose:", err);
        }
        
        // Create a fresh context
        await Tone.start();
        await Tone.loaded();
        
        const toneContext = Tone.getContext();
        console.log("New Tone context created:", toneContext);
        
        // Store unique context identifier
        contextIdRef.current = toneContext.toString();
        
        // Create master volume node
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
          isStarted: true, // Mark as started since we called Tone.start() already
          isLoaded: true,
          error: null,
          masterVolume,
        });
        
        console.log("Audio context initialized with ID:", contextIdRef.current);
      } catch (err) {
        console.error("Failed to initialize audio context:", err);
        setState(prev => ({ 
          ...prev, 
          error: "Failed to initialize audio context. Please refresh the page.",
          isLoaded: false
        }));
      } finally {
        initializingRef.current = false;
      }
    };
    
    // Start initialization
    initContext();
    
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
        if (state.context) {
          state.context.dispose();
        }
        console.log("Disposed failed audio context");
      } catch (closeErr) {
        console.warn("Error while disposing context:", closeErr);
      }
      
      // Try to reset after error
      resetContext().catch(e => console.error("Failed to reset context after start error:", e));
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
      
      // Check if we have the current context
      const currentContext = Tone.getContext();
      
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
      
      // Try reset on failure
      resetContext().catch(e => console.error("Failed to reset after test tone error:", e));
    }
  }, [state.isStarted, startContext]);
  
  // Reset context - completely rebuild the audio context
  const resetContext = useCallback(async () => {
    try {
      console.log("Resetting audio context");
      initializingRef.current = true;
      
      // Mark as loading
      setState(prev => ({
        ...prev,
        isLoaded: false,
        error: null
      }));
      
      // Clean up existing context
      if (masterVolumeRef.current) {
        masterVolumeRef.current.dispose();
        masterVolumeRef.current = null;
      }
      
      // Close existing context
      if (state.context) {
        try {
          state.context.dispose();
          console.log("Disposed old context during reset");
        } catch (err) {
          console.warn("Error disposing old context:", err);
        }
      }
      
      // Clear Tone.js global references (if possible)
      try {
        // @ts-ignore - Using internal method to help reset
        if (typeof Tone.Transport.dispose === 'function') {
          // @ts-ignore
          Tone.Transport.dispose();
          console.log("Disposed Tone.Transport");
        }
      } catch (err) {
        console.warn("Error cleaning up Tone Transport:", err);
      }
      
      // Create new context
      await Tone.start();
      await Tone.loaded();
      
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
      
      // Clear session storage data that might reference old context
      // We keep the volume settings but clear any saved track state
      sessionStorage.removeItem('trackAlchemyState');
      
      return true;
    } catch (err) {
      console.error("Failed to reset audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to reset audio context. Please refresh the page."
      }));
      return false;
    } finally {
      initializingRef.current = false;
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
