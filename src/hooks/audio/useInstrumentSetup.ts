
import { useCallback } from 'react';
import * as Tone from 'tone';
import { InstrumentType, InstrumentTrack } from './types';
import { useTrackSamples } from './useTrackSamples';

export function useInstrumentSetup() {
  const { getSampleUrlForInstrument } = useTrackSamples();

  // Set instrument volume with improved error handling
  const setInstrumentVolume = useCallback((
    instrumentsRef: React.MutableRefObject<Record<string, InstrumentTrack>>,
    setInstruments: React.Dispatch<React.SetStateAction<InstrumentTrack[]>>,
    instrumentId: InstrumentType, 
    volumeDb: number
  ) => {
    console.log(`Setting ${instrumentId} volume to ${volumeDb}dB`);
    
    const instrument = instrumentsRef.current[instrumentId];
    
    if (!instrument) {
      console.warn(`Instrument ${instrumentId} not found`);
      return;
    }
    
    // Always update the reference and state
    instrumentsRef.current[instrumentId].volume = volumeDb;
    
    // Update state to trigger UI update
    setInstruments(prev => prev.map(inst => 
      inst.id === instrumentId ? { ...inst, volume: volumeDb } : inst
    ));
    
    // Save to session storage (moved before the volumeNode check to ensure it's always saved)
    const stateKey = `trackAlchemy_${instrumentId}_volume`;
    sessionStorage.setItem(stateKey, volumeDb.toString());
    
    // If the volume node exists, update it
    if (instrument.volumeNode) {
      try {
        // Use the rampTo method for smoother volume changes (100ms ramp)
        instrument.volumeNode.volume.value = volumeDb;
        console.log(`Volume node for ${instrumentId} updated successfully`);
      } catch (err) {
        console.warn(`Error setting volume for ${instrumentId}:`, err);
      }
    } else {
      console.log(`Volume node for ${instrumentId} not available yet, value saved for later application`);
    }
  }, []);

  // Create and configure instrument player with improved error handling
  const setupInstrument = useCallback(async (
    instrumentId: InstrumentType,
    instrument: InstrumentTrack,
    masterVolume: Tone.Volume | null,
    setInstruments: React.Dispatch<React.SetStateAction<InstrumentTrack[]>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    currentContextId?: string | null
  ) => {
    console.log(`Setting up ${instrumentId} with context ID: ${currentContextId || 'unknown'}`);
    
    // Mark as loading immediately
    instrument.loadingState = 'loading';
    setInstruments(prev => prev.map(i => 
      i.id === instrumentId ? { ...i, loadingState: 'loading' } : i
    ));
    
    // If we have a saved sample path, use it, otherwise try to get a new one
    let url = instrument.samplePath;
    if (!url) {
      url = await getSampleUrlForInstrument(instrumentId);
      instrument.samplePath = url;
    }
    
    if (!url) {
      console.error(`Could not find a sample for ${instrumentId}`);
      setError(prev => prev || `No sample found for ${instrumentId}. Using fallback.`);
      
      // Update instrument state to show error
      instrument.loadingState = 'error';
      setInstruments(prev => prev.map(i => 
        i.id === instrumentId ? { ...i, loadingState: 'error', samplePath: null } : i
      ));
      
      return null;
    }
    
    try {
      // Restore volume from session storage before creating nodes
      const savedVolumeKey = `trackAlchemy_${instrumentId}_volume`;
      const savedVolume = sessionStorage.getItem(savedVolumeKey);
      if (savedVolume !== null) {
        const volumeValue = parseFloat(savedVolume);
        if (!isNaN(volumeValue)) {
          instrument.volume = volumeValue;
          console.log(`Restored ${instrumentId} volume: ${volumeValue}dB`);
        }
      }
      
      // Verify audio context is available and matches
      const currentContext = Tone.getContext();
      if (!currentContext) {
        throw new Error("Tone.js context not available");
      }
      
      // Check for context mismatch (but don't fail the operation)
      if (currentContextId && currentContext.toString() !== currentContextId) {
        console.warn(`Audio context mismatch detected for ${instrumentId}`);
        console.log(`Expected: ${currentContextId}, Got: ${currentContext.toString()}`);
      }
      
      // Create new audio nodes
      const volumeNode = new Tone.Volume(instrument.volume);
      const analyser = new Tone.Analyser('waveform', 128);
      
      console.log(`Loading ${instrumentId} sample from: ${url}`);
      
      // Set up player
      const player = new Tone.Player({
        url,
        loop: true,
        fadeIn: 0.01,
        fadeOut: 0.01,
        onload: () => {
          console.log(`${instrumentId} loaded successfully from ${url}`);
          
          // Connect audio nodes only after successful load
          try {
            player.connect(volumeNode);
            volumeNode.connect(analyser);
            
            if (masterVolume) {
              volumeNode.connect(masterVolume);
            } else {
              volumeNode.connect(Tone.getDestination());
            }
            
            // Update state to show this instrument is ready
            instrument.loadingState = 'loaded';
            instrument.player = player;
            instrument.volumeNode = volumeNode;
            instrument.analyser = analyser;
            
            setInstruments(prev => prev.map(i => 
              i.id === instrumentId ? { 
                ...i, 
                player, 
                volumeNode, 
                analyser, 
                loadingState: 'loaded',
                samplePath: url,
                volume: instrument.volume
              } : i
            ));
          } catch (connectionErr) {
            console.error(`Error connecting ${instrumentId}:`, connectionErr);
            handleLoadError(new Error(`Connection error: ${connectionErr.message}`));
          }
        },
        onerror: handleLoadError
      });
      
      function handleLoadError(e: Error) {
        console.error(`Error loading ${instrumentId} from ${url}:`, e);
        
        // Update instrument state to show error
        instrument.loadingState = 'error';
        setInstruments(prev => prev.map(i => 
          i.id === instrumentId ? { ...i, loadingState: 'error' } : i
        ));
        
        // Clean up any partial setup
        try {
          if (player && player.loaded) player.dispose();
          if (volumeNode) volumeNode.dispose();
          if (analyser) analyser.dispose();
        } catch (err) {
          console.warn(`Error cleaning up failed ${instrumentId} setup:`, err);
        }
        
        // Use fallback to a simple oscillator if sample fails to load
        setError(prev => prev || `Failed to load ${instrumentId} sample. Using fallback.`);
        
        // Fallback to a sine wave at appropriate pitch
        const fallbackFreq = instrumentId === 'bass' ? 55 : 
                        instrumentId === 'guitar' ? 196 :
                        instrumentId === 'keys' ? 261 : 200;
        
        try {
          // Create new nodes for fallback
          const fallbackVolumeNode = new Tone.Volume(instrument.volume);
          const fallbackAnalyser = new Tone.Analyser('waveform', 128);
          const fallbackOsc = new Tone.Oscillator({
            frequency: fallbackFreq,
            type: instrumentId === 'drums' ? 'square' : 'sine',
          });
          
          // Connect nodes
          fallbackOsc.connect(fallbackVolumeNode);
          fallbackVolumeNode.connect(fallbackAnalyser);
          
          if (masterVolume) {
            fallbackVolumeNode.connect(masterVolume);
          } else {
            fallbackVolumeNode.connect(Tone.getDestination());
          }
          
          // Replace the player with oscillator in the instrument object
          instrument.player = fallbackOsc as unknown as Tone.Player;
          instrument.volumeNode = fallbackVolumeNode;
          instrument.analyser = fallbackAnalyser;
          instrument.loadingState = 'error';
          
          setInstruments(prev => prev.map(i => 
            i.id === instrumentId ? { 
              ...i, 
              player: fallbackOsc as unknown as Tone.Player, 
              loadingState: 'error',
              volumeNode: fallbackVolumeNode, 
              analyser: fallbackAnalyser,
              volume: instrument.volume
            } : i
          ));
          
          console.log(`${instrumentId} fallback oscillator created successfully`);
        } catch (fallbackErr) {
          console.error(`Failed to create fallback for ${instrumentId}:`, fallbackErr);
        }
      }
      
      return { player, volumeNode, analyser };
    } catch (err) {
      console.error(`Error setting up ${instrumentId}:`, err);
      
      // Mark as error
      instrument.loadingState = 'error';
      setInstruments(prev => prev.map(i => 
        i.id === instrumentId ? { ...i, loadingState: 'error' } : i
      ));
      
      setError(prev => prev || `Failed to setup ${instrumentId}. Please try refreshing.`);
      return null;
    }
  }, [getSampleUrlForInstrument]);

  return {
    setInstrumentVolume,
    setupInstrument
  };
}
