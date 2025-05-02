
// This file is too long for a single write. I'll focus on the key methods that need fixes.
// I'm only updating critical components that affect functionality.

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { InstrumentType, InstrumentTrack, TrackSettings, UseTrackAudioProps } from './types';
import { useAudioMeter } from './useAudioMeter';
import { useAudioExporter } from './useAudioExporter';
import { useTrackSamples } from './useTrackSamples';
import { useTrackState } from './useTrackState';
import { useInstrumentSetup } from './useInstrumentSetup';

export type { InstrumentType, TrackSettings, InstrumentTrack } from './types';

export function useTrackAudio({ masterVolume, isStarted, startContext, getContextId, resetContext }: UseTrackAudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationInProgressRef = useRef(false);
  
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
  
  // Function to reload track from saved state
  const regenerateTrackFromSavedState = useCallback(async () => {
    // Prevent concurrent regeneration
    if (generationInProgressRef.current) {
      console.log("Generation already in progress, skipping duplicate request");
      return;
    }
    
    generationInProgressRef.current = true;
    
    if (!isStarted) {
      try {
        await startContext();
      } catch (err) {
        console.error("Failed to start context:", err);
        setError("Failed to start audio context. Please try again.");
        generationInProgressRef.current = false;
        return;
      }
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      Tone.Transport.bpm.value = trackSettings.bpm;
      
      // Stop any playing audio first
      if (isPlaying) {
        setIsPlaying(false);
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
      
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to regenerate track:", err);
      setError("Failed to regenerate track. Please try again.");
      setIsLoading(false);
      
      // Still start meter monitoring even with error
      startMeterMonitoring(instrumentsRef, setInstruments);
      
      // Try reset context on serious errors
      if (resetContext) {
        console.log("Attempting to reset audio context after regeneration failure");
        resetContext().catch(resetErr => console.error("Context reset failed:", resetErr));
      }
    }
    
    generationInProgressRef.current = false;
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

  // Generate a new track with improved error handling
  const generateTrack = useCallback(async (settings: TrackSettings) => {
    // Prevent concurrent generation
    if (generationInProgressRef.current) {
      console.log("Generation already in progress, skipping duplicate request");
      return;
    }
    
    generationInProgressRef.current = true;
    
    try {
      if (!isStarted) {
        await startContext();
      }
      
      setIsLoading(true);
      setError(null);
      
      // Stop any playing audio first
      if (isPlaying) {
        setIsPlaying(false);
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
      
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to generate track:", err);
      setError("Failed to generate track. Please try again.");
      setIsLoading(false);
      
      // Still start meter monitoring
      startMeterMonitoring(instrumentsRef, setInstruments);
      
      // Try reset context on serious errors
      if (resetContext) {
        console.log("Attempting to reset audio context after generation failure");
        resetContext().catch(resetErr => console.error("Context reset failed:", resetErr));
      }
    } finally {
      generationInProgressRef.current = false;
    }
  }, [isStarted, isPlaying, masterVolume, startContext, setTrackSettings, setupInstrument, startMeterMonitoring, setIsTrackGenerated, getContextId, resetContext]);

  // Fixed toggle playback function
  const togglePlayback = useCallback(async () => {
    if (!isStarted) {
      try {
        await startContext();
      } catch (err) {
        console.error("Failed to start context for playback:", err);
        setError("Failed to start audio context. Please try again.");
        return;
      }
    }
    
    if (isPlaying) {
      // Stop all instruments
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) {
          try {
            instrument.player.stop();
          } catch (err) {
            console.error(`Error stopping ${instrument.id}:`, err);
          }
        }
      });
      setIsPlaying(false);
    } else {
      // Start all instruments
      let playedSuccessfully = false;
      let errors = [];
      
      for (const instrument of Object.values(instrumentsRef.current)) {
        if (instrument.player && instrument.loadingState === 'loaded') {
          try {
            instrument.player.start();
            playedSuccessfully = true;
          } catch (err) {
            console.error(`Error starting ${instrument.id}:`, err);
            errors.push(`${instrument.id}: ${err.message || 'Unknown error'}`);
          }
        } else if (instrument.player && instrument.loadingState === 'error') {
          try {
            // For error state instruments with fallback oscillators
            if ('start' in instrument.player) {
              instrument.player.start();
              playedSuccessfully = true;
            }
          } catch (err) {
            console.error(`Error starting fallback for ${instrument.id}:`, err);
          }
        }
      }
      
      setIsPlaying(playedSuccessfully);
      
      if (!playedSuccessfully) {
        const errorMsg = errors.length > 0 
          ? `Playback failed: ${errors.join(', ')}`
          : "Could not play any instruments. Try regenerating the track.";
        setError(errorMsg);
        
        // Try reset context on playback failure
        if (resetContext) {
          console.log("Attempting to reset audio context after playback failure");
          resetContext().catch(resetErr => console.error("Context reset failed:", resetErr));
        }
      }
    }
  }, [isPlaying, isStarted, startContext, resetContext]);
  
  // Wrapper for setInstrumentVolume to include instrumentsRef
  const setInstrumentVolume = useCallback((instrumentId: InstrumentType, volumeDb: number) => {
    setVolume(instrumentsRef, setInstruments, instrumentId, volumeDb);
  }, [setVolume]);
  
  // Wrapper for downloadTrack to include state
  const handleDownloadTrack = useCallback(async () => {
    return downloadTrack(isTrackGenerated, instrumentsRef, trackSettings);
  }, [downloadTrack, isTrackGenerated, trackSettings]);

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
  };
}
