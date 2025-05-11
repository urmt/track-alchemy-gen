
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { toast } from "@/components/ui/sonner";

export interface AudioContextState {
  context: Tone.BaseContext | null;
  isStarted: boolean;
  isLoaded: boolean;
  error: string | null;
  masterVolume: Tone.Volume | null;
}

/**
 * Helper function to wrap promises with a timeout
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) =>
    (timer = setTimeout(() => rej(new Error('Operation timed out')), ms))
  );
  try {
    const result = await Promise.race([promise, timeout]) as T;
    clearTimeout(timer!);
    return result;
  } catch (error) {
    clearTimeout(timer!);
    throw error;
  }
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
  const resetInProgressRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context - with improved handling for invalid state errors
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
        
        // Close any existing audio context to prevent multiple contexts
        try {
          const existingContext = Tone.getContext();
          if (existingContext) {
            // Only attempt to dispose if it's not already closed
            if (existingContext.state !== 'closed') {
              // Fix: Only close the context if it's a standard AudioContext
              if (existingContext.rawContext) {
                // Type guard for AudioContext (not OfflineAudioContext)
                const audioCtx = existingContext.rawContext as unknown;
                // Check if it has a close method before calling it
                if (audioCtx && typeof (audioCtx as AudioContext).close === 'function') {
                  await (audioCtx as AudioContext).close();
                  console.log("Closed existing Tone.js context");
                }
              }
            } else {
              console.log("Existing context already closed");
            }
          }
        } catch (err) {
          console.warn("No existing context to dispose or error closing:", err);
        }
        
        // Create a fresh AudioContext directly instead of using Tone.start()
        try {
          // Create a new Web Audio context
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log("AudioContext state after creation:", audioContextRef.current.state);
          
          // Try to resume the context if suspended (may require user interaction)
          if (audioContextRef.current.state === 'suspended') {
            console.log("AudioContext is suspended, attempting to resume");
            try {
              await audioContextRef.current.resume();
              console.log("AudioContext resumed successfully:", audioContextRef.current.state);
            } catch (resumeErr) {
              console.warn("Could not auto-resume AudioContext (may need user gesture):", resumeErr);
            }
          }
          
          // Initialize a new Tone context with this audio context
          Tone.setContext(new Tone.Context(audioContextRef.current));
          await withTimeout(Tone.loaded(), 2000);
          
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
              isStarted: toneContext.state === 'running', // Only mark as started if actually running
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
    
    // Add global click handler for resuming suspended context
    const handleGlobalInteraction = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log("Attempting to resume AudioContext from global interaction handler");
        audioContextRef.current.resume()
          .then(() => {
            console.log("AudioContext resumed via global interaction:", audioContextRef.current?.state);
            if (!state.isStarted) {
              setState(prev => ({ ...prev, isStarted: true }));
            }
          })
          .catch(err => console.warn("Failed to resume from global handler:", err));
      }
    };
    
    // Add multiple event listeners for maximum compatibility
    window.addEventListener('click', handleGlobalInteraction);
    window.addEventListener('touchend', handleGlobalInteraction);
    window.addEventListener('keydown', handleGlobalInteraction);
    
    return () => {
      // Clean up
      if (masterVolumeRef.current) {
        masterVolumeRef.current.dispose();
        masterVolumeRef.current = null;
      }
      
      // Remove global event listeners
      window.removeEventListener('click', handleGlobalInteraction);
      window.removeEventListener('touchend', handleGlobalInteraction);
      window.removeEventListener('keydown', handleGlobalInteraction);
    };
  }, []);

  // Force a context reset on error
  const startContext = useCallback(async () => {
    try {
      if (state.isStarted) {
        console.log("Context already started");
        return true;
      }
      
      console.log("Starting audio context...");
      
      if (state.context && state.context.rawContext) {
        // Try to resume the context directly
        const rawContext = state.context.rawContext as AudioContext;
        console.log("AudioContext state before resume:", rawContext.state);
        
        try {
          await withTimeout(rawContext.resume(), 2000);
          console.log("AudioContext state after resume:", rawContext.state);
          
          setState(prev => ({ ...prev, isStarted: true }));
          console.log("Audio context started successfully");
          return true;
        } catch (resumeErr) {
          console.error("Failed to resume audio context:", resumeErr);
          throw resumeErr; // Re-throw to trigger the outer catch block
        }
      } else {
        throw new Error("No audio context available");
      }
    } catch (err) {
      console.error("Failed to start audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to start audio context. Please try again." 
      }));
      
      // Force a context reset on error
      try {
        if (state.context && state.context.rawContext) {
          // Fix: Check if close method exists before calling
          const audioCtx = state.context.rawContext as unknown;
          if (audioCtx && typeof (audioCtx as AudioContext).close === 'function') {
            await withTimeout((audioCtx as AudioContext).close(), 1000);
          }
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
  
  // Play a test tone with safety checks, properly routed through master volume
  const playTestTone = useCallback(async () => {
    try {
      // Start context if not already started (this already handles user gesture requirement)
      if (!state.isStarted) {
        console.log("Test tone: Context not started, trying to start");
        const success = await startContext();
        if (!success) {
          console.error("Failed to start audio context for test tone");
          toast("Audio Context Error", {
            description: "Could not start audio context. Please check your browser's audio permissions.",
            dismissible: true,
            duration: 5000
          });
          return;
        }
      }
      
      // Safety check for master volume
      if (!masterVolumeRef.current) {
        console.error("Master volume not initialized for test tone");
        toast("Audio System Error", {
          description: "Audio system not ready. Please try again.",
          dismissible: true,
          duration: 5000
        });
        return;
      }
      
      console.log("Playing test tone through master volume");
      
      // Use current audio context from our refs
      try {
        // Get the raw AudioContext directly from Tone.js
        const audioCtx = (state.context?.rawContext as AudioContext) || audioContextRef.current;
        
        if (!audioCtx) {
          throw new Error("No AudioContext available for test tone");
        }
        
        console.log("Test tone AudioContext state:", audioCtx.state);
        
        // If context is suspended, try to resume it
        if (audioCtx.state === 'suspended') {
          console.log("AudioContext is suspended before test tone, trying to resume");
          await audioCtx.resume();
          console.log("AudioContext state after resume:", audioCtx.state);
        }
        
        // Create audio nodes
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); // Safe volume
        
        // Connect the oscillator to the gain node
        oscillator.connect(gainNode);
        
        // Connect to master volume node properly
        if (masterVolumeRef.current) {
          // For Tone.js Volume node, we need to connect to its input
          gainNode.connect(masterVolumeRef.current.input);
          console.log("Test tone connected to master volume node");
        } else {
          // Fallback direct connection if master volume not available
          gainNode.connect(audioCtx.destination);
          console.warn("Test tone connected directly to destination (fallback)");
        }
        
        // Start and stop the oscillator
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
        
        console.log("Test tone played successfully");
      } catch (toneError) {
        console.error("Test tone generation failed:", toneError);
        toast("Test Tone Error", {
          description: "Could not play test tone. Please check audio permissions and autoplay settings.",
          dismissible: true,
          duration: 5000
        });
      }
    } catch (err) {
      console.error("Error playing test tone:", err);
      toast("Audio Error", {
        description: "Failed to play test tone. Please check your browser's audio permissions.",
        dismissible: true,
        duration: 5000
      });
      
      // Try reset on failure
      resetContext().catch(e => console.error("Failed to reset after test tone error:", e));
    }
  }, [state.isStarted, state.context, startContext]);
  
  // Reset context - completely rebuild the audio context with timeout protection
  const resetContext = useCallback(async () => {
    // Guard against concurrent resets
    if (resetInProgressRef.current) {
      console.log("Reset already in progress, skipping duplicate request");
      return false;
    }
    
    resetInProgressRef.current = true;
    console.log("Starting audio context reset");
    
    try {
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
      
      // Close existing context with timeout protection
      if (state.context) {
        try {
          // Only attempt to dispose if it's not already closed
          if (state.context.state !== 'closed' && state.context.rawContext) {
            // Fix: Check if close method exists before calling
            const audioCtx = state.context.rawContext as unknown;
            if (audioCtx && typeof (audioCtx as AudioContext).close === 'function') {
              await withTimeout((audioCtx as AudioContext).close(), 1500);
              console.log("Disposed old context during reset");
            }
          }
        } catch (err) {
          console.warn("Error or timeout disposing old context (continuing anyway):", err);
          // Continue despite error - we'll create a new context anyway
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
      
      // Create new AudioContext directly with timeout protection
      try {
        // Create a new Web Audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        console.log("Created new AudioContext, state:", audioContext.state);
        
        // Try to resume the context if it's suspended
        if (audioContext.state === 'suspended') {
          try {
            await audioContext.resume();
            console.log("AudioContext resumed during reset:", audioContext.state);
          } catch (resumeErr) {
            console.warn("Could not resume AudioContext during reset (may need user gesture):", resumeErr);
          }
        }
        
        // Initialize a new Tone context with this audio context
        Tone.setContext(new Tone.Context(audioContext));
        
        // Use timeout to prevent hanging
        await withTimeout(Tone.loaded(), 2000);
        
        const newContext = Tone.getContext();
        
        // Verify the context is valid
        if (newContext && newContext.state !== 'closed') {
          const newMasterVolume = new Tone.Volume(-12).toDestination();
          masterVolumeRef.current = newMasterVolume;
          contextIdRef.current = newContext.toString();
          
          setState({
            context: newContext,
            isStarted: newContext.state === 'running',
            isLoaded: true,
            error: null,
            masterVolume: newMasterVolume,
          });
          
          console.log("Audio context reset with new ID:", contextIdRef.current);
          
          // Clear session storage data that might reference old context
          sessionStorage.removeItem('trackAlchemyState');
          
          return true;
        } else {
          throw new Error("Failed to create valid audio context on reset");
        }
      } catch (err) {
        console.error("Reset failed:", err);
        setState(prev => ({
          ...prev,
          isLoaded: false,
          error: "Failed to reset audio system. Please refresh the page."
        }));
        return false;
      }
    } catch (err) {
      console.error("Failed to reset audio context:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to reset audio context. Please refresh the page."
      }));
      return false;
    } finally {
      resetInProgressRef.current = false;
      console.log("Audio context reset process complete");
    }
  }, [state.context]);

  return {
    ...state,
    startContext,
    setMasterVolume,
    playTestTone,
    getContextId,
    resetContext,
    getAudioContext: useCallback(() => audioContextRef.current, [])
  };
}
