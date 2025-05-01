
import { useCallback } from 'react';
import * as Tone from 'tone';
import { InstrumentType, InstrumentTrack } from './types';
import { useTrackSamples } from './useTrackSamples';

export function useInstrumentSetup() {
  const { getSampleUrlForInstrument } = useTrackSamples();

  // Set instrument volume
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
    
    // Always update the reference and state regardless of volumeNode availability
    // This ensures the value persists even if the node isn't ready yet
    instrumentsRef.current[instrumentId].volume = volumeDb;
    
    // Update state to trigger UI update
    setInstruments(prev => prev.map(inst => 
      inst.id === instrumentId ? { ...inst, volume: volumeDb } : inst
    ));
    
    // Save the volume state to session storage immediately
    const stateKey = `trackAlchemy_${instrumentId}_volume`;
    sessionStorage.setItem(stateKey, volumeDb.toString());
    
    // If the volume node exists, update it
    if (instrument.volumeNode) {
      try {
        // Directly set the volume value
        instrument.volumeNode.volume.value = volumeDb;
      } catch (err) {
        console.warn(`Error setting volume for ${instrumentId}:`, err);
      }
    } else {
      console.log(`Volume node for ${instrumentId} not available yet, value saved for later application`);
    }
  }, []);

  // Create and configure instrument player
  const setupInstrument = useCallback(async (
    instrumentId: InstrumentType,
    instrument: InstrumentTrack,
    masterVolume: Tone.Volume | null,
    setInstruments: React.Dispatch<React.SetStateAction<InstrumentTrack[]>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    currentContextId?: string | null
  ) => {
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
    
    // Mark as loading
    setInstruments(prev => prev.map(i => 
      i.id === instrumentId ? { ...i, loadingState: 'loading' } : i
    ));
    
    try {
      // Restore volume from session storage before creating nodes
      const savedVolumeKey = `trackAlchemy_${instrumentId}_volume`;
      const savedVolume = sessionStorage.getItem(savedVolumeKey);
      if (savedVolume !== null) {
        const volumeValue = parseFloat(savedVolume);
        if (!isNaN(volumeValue)) {
          instrument.volume = volumeValue;
        }
      }
      
      // Create audio chain: Player -> Volume -> Analyser -> Master Volume
      const volumeNode = new Tone.Volume(instrument.volume);
      const analyser = new Tone.Analyser('waveform', 128);
      
      // Check if context matches current context
      const currentContext = Tone.getContext();
      if (currentContextId && currentContext.toString() !== currentContextId) {
        console.warn(`Audio context mismatch detected for ${instrumentId}`);
        throw new Error(`Audio context mismatch for ${instrumentId}`);
      }
      
      // Set up player with error handling
      const player = new Tone.Player({
        url,
        loop: true,
        onload: () => {
          console.log(`${instrumentId} loaded successfully from ${url}`);
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
              volume: instrument.volume // Ensure volume is preserved
            } : i
          ));
        },
        onerror: (e) => {
          console.error(`Error loading ${instrumentId} from ${url}:`, e);
          
          // Update instrument state to show error
          instrument.loadingState = 'error';
          setInstruments(prev => prev.map(i => 
            i.id === instrumentId ? { ...i, loadingState: 'error' } : i
          ));
          
          // Use fallback to a simple oscillator if sample fails to load
          setError(prev => prev || `Failed to load ${instrumentId} sample. Using fallback.`);
          
          // Fallback to a sine wave at appropriate pitch
          const fallbackFreq = instrumentId === 'bass' ? 55 : 
                          instrumentId === 'guitar' ? 196 :
                          instrumentId === 'keys' ? 261 : 200;
          
          const fallbackOsc = new Tone.Oscillator({
            frequency: fallbackFreq,
            type: instrumentId === 'drums' ? 'square' : 'sine',
          }).connect(volumeNode);
          
          // Replace the player with oscillator in the instrument object
          instrument.player = fallbackOsc as unknown as Tone.Player;
          instrument.volumeNode = volumeNode;
          instrument.analyser = analyser;
          instrument.loadingState = 'error';
          
          setInstruments(prev => prev.map(i => 
            i.id === instrumentId ? { 
              ...i, 
              player: fallbackOsc as unknown as Tone.Player, 
              loadingState: 'error',
              volumeNode, 
              analyser,
              volume: instrument.volume // Ensure volume is preserved 
            } : i
          ));
        },
      });
      
      // Connect nodes properly
      player.connect(volumeNode);
      volumeNode.connect(analyser);
      
      if (masterVolume) {
        volumeNode.connect(masterVolume);
      } else {
        volumeNode.connect(Tone.getDestination());
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
