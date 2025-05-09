
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { InstrumentType, InstrumentTrack, TrackSettings, UseTrackAudioProps } from './types';
import { useAudioMeter } from './useAudioMeter';
import { useAudioExporter } from './useAudioExporter';
import { useMidiExporter } from './useMidiExporter';
import { useTrackSamples } from './useTrackSamples';
import { useTrackState } from './useTrackState';
import { useInstrumentSetup } from './useInstrumentSetup';

export type { InstrumentType, TrackSettings, InstrumentTrack } from './types';

export function useTrackAudio({ masterVolume, isStarted, startContext, getContextId, resetContext }: UseTrackAudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add concurrency guard refs
  const generationInProgressRef = useRef(false);
  const playbackInProgressRef = useRef(false);
  
  // Using a ref for instruments to maintain references across renders
  const instrumentsRef = useRef<Record<InstrumentType, InstrumentTrack>>({
    drums: { 
      id: 'drums', 
      name: 'Drums', 
      volume: -12, 
      meterValue: 0, 
      player: null, 
      volumeNode: null, 
      analyser: null,
      samplePath: null,
      loadingState: 'idle'
    },
    bass: { 
      id: 'bass', 
      name: 'Bass', 
      volume: -15, 
      meterValue: 0, 
      player: null, 
      volumeNode: null, 
      analyser: null,
      samplePath: null,
      loadingState: 'idle'
    },
    guitar: { 
      id: 'guitar', 
      name: 'Guitar', 
      volume: -18, 
      meterValue: 0, 
      player: null, 
      volumeNode: null, 
      analyser: null,
      samplePath: null,
      loadingState: 'idle'
    },
    keys: { 
      id: 'keys', 
      name: 'Keys', 
      volume: -20, 
      meterValue: 0, 
      player: null, 
      volumeNode: null, 
      analyser: null,
      samplePath: null,
      loadingState: 'idle'
    },
  });
  
  const [instruments, setInstruments] = useState<InstrumentTrack[]>(
    Object.values(instrumentsRef.current)
  );
  
  // Initialize hooks
  const { 
    masterMeterValue, 
    setupMasterAnalyser, 
    startMeterMonitoring 
  } = useAudioMeter(instruments, isPlaying);
  
  const { downloadTrack } = useAudioExporter();
  const { downloadMidiTrack } = useMidiExporter();
  const { getSampleUrlForInstrument } = useTrackSamples();
  const { setupInstrument, setInstrumentVolume: setVolume } = useInstrumentSetup();
  
  const {
    trackSettings,
    setTrackSettings,
    isTrackGenerated,
    setIsTrackGenerated,
    loadSavedState
  } = useTrackState(instrumentsRef, setInstruments);

  // Set up master analyser
  useEffect(() => {
    return setupMasterAnalyser(masterVolume);
  }, [masterVolume, setupMasterAnalyser]);
  
  // Clean up all instruments when unmounting or when audio context changes
  useEffect(() => {
    return () => {
      // Stop any playing audio first
      if (isPlaying) {
        Tone.Transport.stop();
        Object.values(instrumentsRef.current).forEach(instrument => {
          if (instrument.player) {
            try {
              instrument.player.stop();
            } catch (err) {
              console.error(`Error stopping ${instrument.id}:`, err);
            }
          }
        });
      }
      
      // Dispose of all audio nodes
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) instrument.player.dispose();
        if (instrument.volumeNode) instrument.volumeNode.dispose();
        if (instrument.analyser) instrument.analyser.dispose();
      });
    };
  }, [isPlaying]);
  
  // Function to reload track from saved state - with improved protection
  const regenerateTrackFromSavedState = useCallback(async () => {
    // Prevent concurrent regeneration
    if (generationInProgressRef.current) {
      console.log("Generation already in progress, skipping duplicate request");
      return;
    }
    
    generationInProgressRef.current = true;
    console.log("Starting track regeneration from saved state");
    
    try {
      if (!isStarted) {
        try {
          await startContext();
        } catch (err) {
          console.error("Failed to start context:", err);
          setError("Failed to start audio context. Please try again.");
          return;
        }
      }
      
      setIsLoading(true);
      setError(null);
      
      // Stop any playing audio first
      if (isPlaying) {
        setIsPlaying(false);
        Tone.Transport.stop();
        Object.values(instrumentsRef.current).forEach(instrument => {
          if (instrument.player) {
            try {
              instrument.player.stop();
            } catch (err) {
              console.error(`Error stopping ${instrument.id}:`, err);
            }
          }
        });
      }
      
      // Yield to UI thread before intensive operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Clean up any existing players
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) {
          try {
            if (instrument.player.state !== "stopped") {
              instrument.player.stop();
            }
            instrument.player.dispose();
            instrument.player = null;
          } catch (err) {
            console.warn(`Error disposing player for ${instrument.id}:`, err);
          }
        }
        if (instrument.volumeNode) {
          try {
            instrument.volumeNode.dispose();
            instrument.volumeNode = null;
          } catch (err) {
            console.warn(`Error disposing volume node for ${instrument.id}:`, err);
          }
        }
        if (instrument.analyser) {
          try {
            instrument.analyser.dispose();
            instrument.analyser = null;
          } catch (err) {
            console.warn(`Error disposing analyser for ${instrument.id}:`, err);
          }
        }
        
        // Reset loading state to loading
        instrument.loadingState = 'loading';
      });
      
      // Update instruments state to show loading state
      setInstruments(prev => prev.map(i => ({ ...i, loadingState: 'loading' })));
      
      const currentContextId = getContextId ? getContextId() : null;
      console.log("Regenerating with context ID:", currentContextId);
      
      // Cancel any existing scheduled events on the Transport
      Tone.Transport.cancel();
      
      // Set up players with saved sample paths
      let successCount = 0;
      let attemptCount = 0;
      
      for (const instrumentId of Object.keys(instrumentsRef.current) as InstrumentType[]) {
        attemptCount++;
        const instrument = instrumentsRef.current[instrumentId];
        const result = await setupInstrument(instrumentId, instrument, masterVolume, setInstruments, setError, currentContextId);
        if (result) successCount++;
      }
      
      if (successCount > 0) {
        setIsTrackGenerated(true);
        console.log(`Track regenerated with ${successCount}/${attemptCount} instruments successfully loaded`);
      } else {
        setError("Failed to load any instruments. Please try again.");
        console.error("No instruments were loaded successfully");
      }
      
      // Always start meter monitoring, even if generation wasn't fully successful
      startMeterMonitoring(instrumentsRef, setInstruments);
    } catch (err) {
      console.error("Failed to regenerate track:", err);
      setError("Failed to regenerate track. Please try again.");
      
      // Still start meter monitoring even with error
      startMeterMonitoring(instrumentsRef, setInstruments);
      
      // Try reset context on serious errors
      if (resetContext) {
        console.log("Attempting to reset audio context after regeneration failure");
        resetContext().catch(resetErr => console.error("Context reset failed:", resetErr));
      }
    } finally {
      setIsLoading(false);
      generationInProgressRef.current = false;
      console.log("Track regeneration process complete");
    }
  }, [isStarted, isPlaying, masterVolume, startContext, setupInstrument, trackSettings, startMeterMonitoring, setIsTrackGenerated, getContextId, resetContext]);

  // Load track state from session storage on initial load
  useEffect(() => {
    if (isStarted) {
      loadSavedState(isStarted, regenerateTrackFromSavedState);
    }
  }, [isStarted, loadSavedState, regenerateTrackFromSavedState]); 

  // Always start meter monitoring when track is generated, even when not playing
  useEffect(() => {
    if (isTrackGenerated) {
      const cleanup = startMeterMonitoring(instrumentsRef, setInstruments);
      return cleanup;
    }
  }, [isTrackGenerated, startMeterMonitoring]);

  // Generate a new track with improved error handling and concurrency protection
  const generateTrack = useCallback(async (settings: TrackSettings) => {
    console.debug('[TRACK AUDIO] generate start');
    // Prevent concurrent generation
    if (generationInProgressRef.current) {
      console.log("Generation already in progress, skipping duplicate request");
      return;
    }
    
    generationInProgressRef.current = true;
    console.log("Starting track generation with settings:", settings);
    
    try {
      if (!isStarted) {
        await startContext();
      }
      
      setIsLoading(true);
      setError(null);
      
      // Stop any playing audio first
      if (isPlaying) {
        setIsPlaying(false);
        Tone.Transport.stop();
        Object.values(instrumentsRef.current).forEach(instrument => {
          if (instrument.player) {
            try {
              instrument.player.stop();
            } catch (err) {
              console.error(`Error stopping ${instrument.id}:`, err);
            }
          }
        });
      }
      
      // Set the BPM
      Tone.Transport.bpm.value = settings.bpm;
      
      // Update track settings
      setTrackSettings(settings);
      
      // Yield to UI before intensive operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Clean up any existing players and nodes
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) {
          try {
            instrument.player.stop();
            instrument.player.dispose();
            instrument.player = null;
          } catch (err) {
            console.warn(`Error disposing player for ${instrument.id}:`, err);
          }
        }
        if (instrument.volumeNode) {
          try {
            instrument.volumeNode.dispose();
            instrument.volumeNode = null;
          } catch (err) {
            console.warn(`Error disposing volume for ${instrument.id}:`, err);
          }
        }
        if (instrument.analyser) {
          try {
            instrument.analyser.dispose();
            instrument.analyser = null;
          } catch (err) {
            console.warn(`Error disposing analyser for ${instrument.id}:`, err);
          }
        }
        
        // Update loading state
        instrument.loadingState = 'loading';
      });
      
      // Update UI to show loading
      setInstruments(prev => prev.map(i => ({ ...i, loadingState: 'loading', player: null, volumeNode: null, analyser: null })));
      
      const currentContextId = getContextId ? getContextId() : null;
      console.log("Generating track with context ID:", currentContextId);
      
      // Cancel any existing scheduled events on the Transport
      Tone.Transport.cancel();
      
      // Set up new players with the selected settings
      let successCount = 0;
      let attemptCount = 0;
      
      for (const instrumentId of Object.keys(instrumentsRef.current) as InstrumentType[]) {
        attemptCount++;
        const result = await setupInstrument(
          instrumentId, 
          instrumentsRef.current[instrumentId], 
          masterVolume, 
          setInstruments,
          setError,
          currentContextId
        );
        if (result) successCount++;
      }
      
      // Mark track as generated if at least one instrument loaded successfully
      if (successCount > 0) {
        setIsTrackGenerated(true);
        console.log(`Track generated with ${successCount}/${attemptCount} instruments loaded`);
      } else {
        console.error("No instruments were loaded successfully");
        setError("Failed to load any instruments. Please try again.");
      }
      
      // Always start meter monitoring
      startMeterMonitoring(instrumentsRef, setInstruments);
    } catch (err) {
      console.error("Failed to generate track:", err);
      setError("Failed to generate track. Please try again.");
      
      // Still start meter monitoring
      startMeterMonitoring(instrumentsRef, setInstruments);
      
      // Try reset context on serious errors
      if (resetContext) {
        console.log("Attempting to reset audio context after generation failure");
        resetContext().catch(resetErr => console.error("Context reset failed:", resetErr));
      }
    } finally {
      setIsLoading(false);
      generationInProgressRef.current = false;
      console.log("Track generation process complete");
      console.debug('[TRACK AUDIO] generate end');
    }
  }, [isStarted, isPlaying, masterVolume, startContext, setTrackSettings, setupInstrument, startMeterMonitoring, setIsTrackGenerated, getContextId, resetContext]);

  // Fixed toggle playback function with protection
  const togglePlayback = useCallback(async () => {
    console.debug('[TRACK AUDIO] toggle playback start');
    // Prevent concurrent playback operations
    if (playbackInProgressRef.current) {
      console.log("Playback operation already in progress, skipping");
      return;
    }
    
    playbackInProgressRef.current = true;
    console.log("Toggle playback requested, current state:", isPlaying ? "playing" : "stopped");
    
    try {
      if (!isStarted) {
        try {
          await startContext();
        } catch (err) {
          console.error("Failed to start context for playback:", err);
          setError("Failed to start audio context. Please try again.");
          return;
        }
      }
      
      // Yield to UI before intensive operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      if (isPlaying) {
        // Pause the transport instead of stopping individual players
        Tone.Transport.pause();
        setIsPlaying(false);
        console.log("Playback paused");
      } else {
        // First recreate any missing players if needed
        for (const instrument of Object.values(instrumentsRef.current)) {
          if (!instrument.player && instrument.samplePath && instrument.loadingState === 'loaded') {
            try {
              console.log(`Recreating player for ${instrument.id}`);
              // Recreate the player if needed
              await setupInstrument(
                instrument.id as InstrumentType, 
                instrument, 
                masterVolume, 
                setInstruments,
                setError,
                getContextId ? getContextId() : null
              );
            } catch (err) {
              console.error(`Error recreating player for ${instrument.id}:`, err);
            }
          }
        }
        
        // Use Tone.Transport for playback control
        try {
          // Start the transport - it will play all scheduled events
          Tone.Transport.start();
          setIsPlaying(true);
          console.log("Playback started");
        } catch (err) {
          console.error("Error starting transport:", err);
          setError(`Playback error: ${err instanceof Error ? err.message : "Unknown error"}`);
          
          // Try reset context on playback failure
          if (resetContext) {
            console.log("Attempting to reset audio context after playback failure");
            resetContext().catch(resetErr => console.error("Context reset failed:", resetErr));
          }
        }
      }
    } catch (err) {
      console.error("Playback toggle error:", err);
      setError(`Playback error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      playbackInProgressRef.current = false;
      console.log("Playback operation complete");
      console.debug('[TRACK AUDIO] toggle playback end');
    }
  }, [isPlaying, isStarted, masterVolume, startContext, resetContext, setupInstrument, getContextId, setInstruments]);
  
  // Wrapper for setInstrumentVolume to include instrumentsRef
  const setInstrumentVolume = useCallback((instrumentId: InstrumentType, volumeDb: number) => {
    setVolume(instrumentsRef, setInstruments, instrumentId, volumeDb);
  }, [setVolume]);
  
  // Wrapper for downloadTrack to include state
  const handleDownloadTrack = useCallback(async () => {
    console.debug('[TRACK AUDIO] download WAV start');
    const result = await downloadTrack(isTrackGenerated, instrumentsRef, trackSettings);
    console.debug('[TRACK AUDIO] download WAV end');
    return result;
  }, [downloadTrack, isTrackGenerated, trackSettings]);
  
  // Add handler for MIDI download
  const handleDownloadMidi = useCallback(() => {
    console.debug('[TRACK AUDIO] download MIDI start');
    const result = downloadMidiTrack(isTrackGenerated, trackSettings);
    console.debug('[TRACK AUDIO] download MIDI end');
    return result;
  }, [downloadMidiTrack, isTrackGenerated, trackSettings]);

  return {
    instruments,
    isPlaying,
    isLoading,
    error,
    trackSettings,
    isTrackGenerated,
    masterMeterValue,
    generateTrack,
    togglePlayback,
    setInstrumentVolume,
    setTrackSettings,
    downloadTrack: handleDownloadTrack,
    downloadMidi: handleDownloadMidi,
  };
}
