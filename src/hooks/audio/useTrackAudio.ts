
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { InstrumentType, InstrumentTrack, TrackSettings, UseTrackAudioProps } from './types';
import { useAudioMeter } from './useAudioMeter';
import { useAudioExporter } from './useAudioExporter';
import { useTrackSamples } from './useTrackSamples';
import { useTrackState } from './useTrackState';
import { useInstrumentSetup } from './useInstrumentSetup';

export type { InstrumentType, TrackSettings, InstrumentTrack } from './types';

export function useTrackAudio({ masterVolume, isStarted, startContext, getContextId }: UseTrackAudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) instrument.player.dispose();
        if (instrument.volumeNode) instrument.volumeNode.dispose();
        if (instrument.analyser) instrument.analyser.dispose();
      });
    };
  }, []);
  
  // Function to reload track from saved state
  const regenerateTrackFromSavedState = useCallback(async () => {
    if (!isStarted) {
      await startContext();
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      Tone.Transport.bpm.value = trackSettings.bpm;
      
      // Clean up any existing players
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) {
          instrument.player.stop();
          instrument.player.dispose();
        }
        if (instrument.volumeNode) {
          instrument.volumeNode.dispose();
        }
        if (instrument.analyser) {
          instrument.analyser.dispose();
        }
        
        // Reset loading state to loading
        instrument.loadingState = 'loading';
      });
      
      // Update instruments state to show loading state
      setInstruments(prev => prev.map(i => ({ ...i, loadingState: 'loading' })));
      
      const currentContextId = getContextId ? getContextId() : null;
      console.log("Regenerating with context ID:", currentContextId);
      
      // Set up players with saved sample paths
      for (const instrumentId of Object.keys(instrumentsRef.current) as InstrumentType[]) {
        const instrument = instrumentsRef.current[instrumentId];
        await setupInstrument(instrumentId, instrument, masterVolume, setInstruments, setError, currentContextId);
      }
      
      setIsTrackGenerated(true);
      
      // Always start meter monitoring, even if generation wasn't fully successful
      startMeterMonitoring(instrumentsRef, setInstruments);
      
      setIsLoading(false);
      console.log("Track regenerated with saved settings:", trackSettings);
    } catch (err) {
      console.error("Failed to regenerate track:", err);
      setError("Failed to regenerate track. Please try again.");
      setIsLoading(false);
      
      // Still start meter monitoring even with error
      startMeterMonitoring(instrumentsRef, setInstruments);
    }
  }, [isStarted, masterVolume, startContext, setupInstrument, trackSettings, startMeterMonitoring, setIsTrackGenerated, getContextId]);

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

  const generateTrack = useCallback(async (settings: TrackSettings) => {
    if (!isStarted) {
      await startContext();
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      Tone.Transport.bpm.value = settings.bpm;
      
      // Update track settings
      setTrackSettings(settings);
      
      // Clean up any existing players
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) {
          instrument.player.stop();
          instrument.player.dispose();
        }
        if (instrument.volumeNode) {
          instrument.volumeNode.dispose();
        }
        if (instrument.analyser) {
          instrument.analyser.dispose();
        }
      });
      
      const currentContextId = getContextId ? getContextId() : null;
      console.log("Generating with context ID:", currentContextId);
      
      // Set up new players with the selected settings
      for (const instrumentId of Object.keys(instrumentsRef.current) as InstrumentType[]) {
        // Update instrument loading state
        instrumentsRef.current[instrumentId].loadingState = 'loading';
        setInstruments(prev => prev.map(i => 
          i.id === instrumentId ? { ...i, loadingState: 'loading' } : i
        ));
        
        // Setup each instrument
        await setupInstrument(
          instrumentId, 
          instrumentsRef.current[instrumentId], 
          masterVolume, 
          setInstruments,
          setError,
          currentContextId
        );
      }
      
      setIsTrackGenerated(true);
      setIsLoading(false);
      
      // Start meter monitoring
      startMeterMonitoring(instrumentsRef, setInstruments);
      
      console.log("Track generated with settings:", settings);
    } catch (err) {
      console.error("Failed to generate track:", err);
      setError("Failed to generate track. Please try again.");
      setIsLoading(false);
    }
  }, [isStarted, masterVolume, startContext, setTrackSettings, setupInstrument, startMeterMonitoring, setIsTrackGenerated, getContextId]);

  const togglePlayback = useCallback(async () => {
    if (!isStarted) {
      await startContext();
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
      
      for (const instrument of Object.values(instrumentsRef.current)) {
        if (instrument.player && instrument.loadingState === 'loaded') {
          try {
            instrument.player.start();
            playedSuccessfully = true;
          } catch (err) {
            console.error(`Error starting ${instrument.id}:`, err);
          }
        }
      }
      
      setIsPlaying(playedSuccessfully);
      
      if (!playedSuccessfully) {
        setError("Could not play any instruments. Try regenerating the track.");
      }
    }
  }, [isPlaying, isStarted, startContext]);
  
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
    generateTrack: useCallback(async (settings: TrackSettings) => {
      if (!isStarted) {
        await startContext();
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        Tone.Transport.bpm.value = settings.bpm;
        
        // Update track settings
        setTrackSettings(settings);
        
        // Clean up any existing players
        Object.values(instrumentsRef.current).forEach(instrument => {
          if (instrument.player) {
            instrument.player.stop();
            instrument.player.dispose();
          }
          if (instrument.volumeNode) {
            instrument.volumeNode.dispose();
          }
          if (instrument.analyser) {
            instrument.analyser.dispose();
          }
        });
        
        const currentContextId = getContextId ? getContextId() : null;
        console.log("Generating with context ID:", currentContextId);
        
        // Set up new players with the selected settings
        for (const instrumentId of Object.keys(instrumentsRef.current) as InstrumentType[]) {
          // Update instrument loading state
          instrumentsRef.current[instrumentId].loadingState = 'loading';
          setInstruments(prev => prev.map(i => 
            i.id === instrumentId ? { ...i, loadingState: 'loading' } : i
          ));
          
          // Setup each instrument
          await setupInstrument(
            instrumentId, 
            instrumentsRef.current[instrumentId], 
            masterVolume, 
            setInstruments,
            setError,
            currentContextId
          );
        }
        
        setIsTrackGenerated(true);
        
        // Always start meter monitoring, even if there are some errors
        startMeterMonitoring(instrumentsRef, setInstruments);
        
        setIsLoading(false);
        console.log("Track generated with settings:", settings);
      } catch (err) {
        console.error("Failed to generate track:", err);
        setError("Failed to generate track. Please try again.");
        setIsLoading(false);
        
        // Still start meter monitoring even with error
        startMeterMonitoring(instrumentsRef, setInstruments);
      }
    }, [isStarted, masterVolume, startContext, setTrackSettings, setupInstrument, startMeterMonitoring, setIsTrackGenerated, getContextId]),
    togglePlayback: useCallback(async () => {
      if (!isStarted) {
        await startContext();
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
        
        for (const instrument of Object.values(instrumentsRef.current)) {
          if (instrument.player && instrument.loadingState === 'loaded') {
            try {
              instrument.player.start();
              playedSuccessfully = true;
            } catch (err) {
              console.error(`Error starting ${instrument.id}:`, err);
            }
          }
        }
        
        setIsPlaying(playedSuccessfully);
        
        if (!playedSuccessfully) {
          setError("Could not play any instruments. Try regenerating the track.");
        }
      }
    }, [isPlaying, isStarted, startContext]),
    setInstrumentVolume,
    setTrackSettings,
    downloadTrack: handleDownloadTrack,
  };
}
