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
  const maxRetries = 3;
  const retryRef = useRef<number>(0);

  // Initialize audio context
  useEffect(() => {
    // Prevent multiple initializations
    if (initializingRef.current) return;
    
    const initContext = async () => {
      try {
        initializingRef.current = true;
        console.log("Initializing audio context");
        
        // Clean up any existing nodes first
        if (masterVolumeRef.current) {
          masterVolumeRef.current.dispose();
          masterVolumeRef.current = null;
        }
        
        // Safe cleanup of any existing Tone.js context
        try {
          const existingContext = Tone.getContext();
          if (existingContext) {
            // Only attempt to dispose if it's not already closed
            if (existingContext.state !== 'closed') {
              existingContext.dispose();
              console.log("Disposed existing Tone.js context");
            } else {
              console.log("Existing context already closed");
            }
          }
        } catch (err) {
          console.warn("No existing context to dispose:", err);
        }
        
        // Create a fresh context with proper error handling
        try {
          // Create a new audio context
          await Tone.start();
          await Tone.loaded();
          
          const toneContext = Tone.getContext();
          
          // If context creation succeeded, store info
          if (toneContext && toneContext.state !== 'closed') {
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
            
            // Reset retry counter on success
            retryRef.current = 0;
            
            setState({
              context: toneContext,
              isStarted: true, // Mark as started since we called Tone.start() already
              isLoaded: true,
              error: null,
              masterVolume,
            });
            
            console.log("Audio context initialized with ID:", contextIdRef.current);
          } else {
            throw new Error("Failed to create a valid audio context");
          }
        } catch (contextErr) {
          console.error("Error creating audio context:", contextErr);
          
          // Increment retry counter
          retryRef.current += 1;
          
          // Only retry a limited number of times
          if (retryRef.current < maxRetries) {
            console.log(`Retrying audio context creation (${retryRef.current}/${maxRetries})`);
            setTimeout(() => {
              initializingRef.current = false;
              initContext();
            }, 1000);
            return;
          }
          
          // If we've exhausted retries, report the error but keep app functional
          setState(prev => ({ 
            ...prev, 
            error: "Failed to initialize audio context. Some features may be limited.",
            isLoaded: false,
            isStarted: false
          }));
        }
      } catch (err) {
        console.error("Failed to initialize audio context:", err);
        setState(prev => ({ 
          ...prev, 
          error: "Failed to initialize audio context. Please refresh the page.",
          isLoaded: false,
          isStarted: false
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
      return true;
    } catch (err) {
      console.error("Failed to start audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to start audio context. Please try again." 
      }));
      
      // Force a context reset on error
      try {
        if (state.context && state.context.state !== 'closed') {
          state.context.dispose();
        }
        console.log("Disposed failed audio context");
      } catch (closeErr) {
        console.warn("Error while disposing context:", closeErr);
      }
      
      // Try to reset after error
      resetContext().catch(e => console.error("Failed to reset context after start error:", e));
      return false;
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
      // Start context if not already started
      if (!state.isStarted) {
        const success = await startContext();
        if (!success) {
          return;
        }
      }
      
      // Safety check for master volume
      if (!masterVolumeRef.current) {
        console.error("Master volume not initialized");
        setState(prev => ({
          ...prev,
          error: "Audio system not ready. Please try again."
        }));
        return;
      }
      
      // Safe tone generation
      try {
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
      } catch (toneError) {
        console.error("Tone generation failed:", toneError);
        
        // Try a fallback approach
        try {
          // Use Web Audio API directly as fallback
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);
          
          // Clean up
          setTimeout(() => {
            audioContext.close();
          }, 600);
          
          console.log("Test tone played with fallback method");
        } catch (fallbackError) {
          console.error("Fallback tone generation failed:", fallbackError);
          setState(prev => ({
            ...prev,
            error: "Could not play test tone. Please check audio permissions."
          }));
        }
      }
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
        try {
          masterVolumeRef.current.dispose();
        } catch (err) {
          console.warn("Error disposing master volume:", err);
        }
        masterVolumeRef.current = null;
      }
      
      // Close existing context
      if (state.context) {
        try {
          // Only attempt to dispose if it's not already closed
          if (state.context.state !== 'closed') {
            state.context.dispose();
            console.log("Disposed old context during reset");
          }
        } catch (err) {
          console.warn("Error disposing old context:", err);
        }
      }
      
      // Clear Tone.js global references (if possible)
      try {
        // @ts-ignore - Using internal method to help reset
        if (typeof Tone.Transport && typeof Tone.Transport.dispose === 'function') {
          // @ts-ignore
          Tone.Transport.dispose();
          console.log("Disposed Tone.Transport");
        }
      } catch (err) {
        console.warn("Error cleaning up Tone Transport:", err);
      }
      
      // Short delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create new context with exponential backoff retries
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!success && attempts < maxAttempts) {
        try {
          attempts++;
          
          // Create a new audio context
          await Tone.start();
          await Tone.loaded();
          
          const newContext = Tone.getContext();
          
          // Verify the context is valid
          if (newContext && newContext.state !== 'closed') {
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
            success = true;
          } else {
            throw new Error("Failed to create valid audio context on reset");
          }
        } catch (err) {
          console.error(`Reset attempt ${attempts} failed:`, err);
          
          // Wait longer between each retry
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempts)));
          }
        }
      }
      
      // Clear session storage data that might reference old context
      // We keep the volume settings but clear any saved track state
      sessionStorage.removeItem('trackAlchemyState');
      
      // If all attempts failed
      if (!success) {
        setState(prev => ({
          ...prev,
          isLoaded: false,
          error: "Failed to reset audio system after multiple attempts. Please refresh the page."
        }));
        return false;
      }
      
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
