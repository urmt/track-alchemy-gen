
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
    
    if (instrumentsRef.current[instrumentId].volumeNode) {
      // Directly set the volume value
      instrumentsRef.current[instrumentId].volumeNode!.volume.value = volumeDb;
      
      // Update ref
      instrumentsRef.current[instrumentId].volume = volumeDb;
      
      // Update state
      setInstruments(prev => prev.map(inst => 
        inst.id === instrumentId ? { ...inst, volume: volumeDb } : inst
      ));
    } else {
      console.warn(`Volume node for ${instrumentId} not initialized`);
      
      // Still update the stored volume value even if node isn't ready
      instrumentsRef.current[instrumentId] = {
        ...instrumentsRef.current[instrumentId],
        volume: volumeDb
      };
      
      // Update state
      setInstruments(prev => prev.map(inst => 
        inst.id === instrumentId ? { ...inst, volume: volumeDb } : inst
      ));
    }
  }, []);

  // Create and configure instrument player
  const setupInstrument = useCallback(async (
    instrumentId: InstrumentType,
    instrument: InstrumentTrack,
    masterVolume: Tone.Volume | null,
    setInstruments: React.Dispatch<React.SetStateAction<InstrumentTrack[]>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>
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
    
    // Create audio chain: Player -> Volume -> Analyser -> Master Volume
    const volumeNode = new Tone.Volume(instrument.volume);
    const analyser = new Tone.Analyser('waveform', 128);
    
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
            samplePath: url
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
            analyser 
          } : i
        ));
      },
    }).connect(volumeNode);
    
    volumeNode.connect(analyser);
    volumeNode.connect(masterVolume || Tone.getDestination());
    
    return { player, volumeNode, analyser };
  }, [getSampleUrlForInstrument]);

  return {
    setInstrumentVolume,
    setupInstrument
  };
}
