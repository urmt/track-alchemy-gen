import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { useSampleManager } from './useSampleManager';

export type InstrumentType = 'drums' | 'bass' | 'guitar' | 'keys';

export interface TrackSettings {
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  duration: number;
}

export interface InstrumentTrack {
  id: InstrumentType;
  name: string;
  volume: number;
  meterValue: number;
  player: Tone.Player | null;
  volumeNode: Tone.Volume | null;
  analyser: Tone.Analyser | null;
  samplePath: string | null;
  loadingState: 'idle' | 'loading' | 'loaded' | 'error';
}

interface UseTrackAudioProps {
  masterVolume: Tone.Volume | null;
  isStarted: boolean;
  startContext: () => Promise<void>;
}

export function useTrackAudio({ masterVolume, isStarted, startContext }: UseTrackAudioProps) {
  const { getSamples, getSampleUrl } = useSampleManager();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackSettings, setTrackSettings] = useState<TrackSettings>({
    genre: 'rock',
    mood: 'energetic',
    bpm: 120,
    key: 'C',
    duration: 16, // in bars
  });
  
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
  
  const masterAnalyserRef = useRef<Tone.Analyser | null>(null);
  const [masterMeterValue, setMasterMeterValue] = useState(0);
  const meterIntervalRef = useRef<number | null>(null);
  
  // Set up master analyser
  useEffect(() => {
    if (masterVolume && !masterAnalyserRef.current) {
      const analyser = new Tone.Analyser('waveform', 128);
      masterVolume.connect(analyser);
      masterAnalyserRef.current = analyser;
    }
    
    return () => {
      if (masterAnalyserRef.current) {
        masterAnalyserRef.current.dispose();
        masterAnalyserRef.current = null;
      }
    };
  }, [masterVolume]);
  
  // Get sample URL for an instrument type, preferring user uploads
  const getSampleUrlForInstrument = useCallback(async (instrumentType: InstrumentType): Promise<string | null> => {
    try {
      // Try to get user uploaded samples for this instrument
      const result = await getSamples();
      
      if (result.success && result.data && result.data.length > 0) {
        // Filter samples by instrument type
        const instrumentSamples = result.data.filter(
          sample => sample.instrument_type === instrumentType
        );
        
        if (instrumentSamples.length > 0) {
          // Use the most recently uploaded sample
          const latestSample = instrumentSamples.reduce((latest, current) => {
            return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
          }, instrumentSamples[0]);
          
          console.log(`Using uploaded ${instrumentType} sample: ${latestSample.name}`);
          return getSampleUrl(latestSample.file_path);
        }
      }
      
      // Fallback to default samples if no user samples found
      console.log(`No uploaded ${instrumentType} samples found, using default`);
      return `/samples/${instrumentType}.mp3`;
    } catch (err) {
      console.error(`Error getting ${instrumentType} sample:`, err);
      return null;
    }
  }, [getSamples, getSampleUrl]);

  const generateTrack = useCallback(async (settings: TrackSettings) => {
    if (!isStarted) {
      await startContext();
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      Tone.Transport.bpm.value = settings.bpm;
      
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
      
      // Set up new players with the selected settings
      for (const instrumentId of Object.keys(instrumentsRef.current) as InstrumentType[]) {
        // Update instrument loading state
        instrumentsRef.current[instrumentId].loadingState = 'loading';
        setInstruments(prev => prev.map(i => 
          i.id === instrumentId ? { ...i, loadingState: 'loading' } : i
        ));
        
        // Try to get a user uploaded sample or fall back to default
        const url = await getSampleUrlForInstrument(instrumentId);
        instrumentsRef.current[instrumentId].samplePath = url;
        
        if (!url) {
          console.error(`Could not find a sample for ${instrumentId}`);
          setError(prev => prev || `No sample found for ${instrumentId}. Using fallback.`);
          
          // Update instrument state to show error
          instrumentsRef.current[instrumentId].loadingState = 'error';
          setInstruments(prev => prev.map(i => 
            i.id === instrumentId ? { ...i, loadingState: 'error', samplePath: null } : i
          ));
          
          // Continue to next instrument
          continue;
        }
        
        // Create audio chain: Player -> Volume -> Analyser -> Master Volume
        const volumeNode = new Tone.Volume(instrumentsRef.current[instrumentId].volume);
        const analyser = new Tone.Analyser('waveform', 128);
        
        // Set up buffer error handling
        const player = new Tone.Player({
          url,
          loop: true,
          onload: () => {
            console.log(`${instrumentId} loaded successfully from ${url}`);
            // Update state to show this instrument is ready
            instrumentsRef.current[instrumentId].loadingState = 'loaded';
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
            instrumentsRef.current[instrumentId].loadingState = 'error';
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
            instrumentsRef.current[instrumentId] = {
              ...instrumentsRef.current[instrumentId],
              player: fallbackOsc as unknown as Tone.Player,
              loadingState: 'error'
            };
            
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
      }
      
      setTrackSettings(settings);
      setIsLoading(false);
      
      // Start meter monitoring
      startMeterMonitoring();
      
      console.log("Track generated with settings:", settings);
    } catch (err) {
      console.error("Failed to generate track:", err);
      setError("Failed to generate track. Please try again.");
      setIsLoading(false);
    }
  }, [isStarted, masterVolume, startContext, getSampleUrlForInstrument]);
  
  const startMeterMonitoring = useCallback(() => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
    }
    
    meterIntervalRef.current = window.setInterval(() => {
      // Update each instrument meter
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.analyser && instrument.player?.state === 'started') {
          const waveform = instrument.analyser.getValue();
          // Calculate RMS volume
          const rms = Math.sqrt(
            (waveform as Float32Array).reduce((sum, val) => sum + val * val, 0) / 
            waveform.length
          );
          
          // Convert to a better visual range (0-100)
          const meterValue = Math.min(100, Math.max(0, rms * 200));
          
          // Update state
          setInstruments(prev => prev.map(i => 
            i.id === instrument.id ? { ...i, meterValue } : i
          ));
        } else if (!isPlaying) {
          // Reset meter when not playing
          setInstruments(prev => prev.map(i => 
            i.id === instrument.id ? { ...i, meterValue: 0 } : i
          ));
        }
      });
      
      // Update master meter
      if (masterAnalyserRef.current) {
        const masterWaveform = masterAnalyserRef.current.getValue();
        const masterRms = Math.sqrt(
          (masterWaveform as Float32Array).reduce((sum, val) => sum + val * val, 0) / 
          masterWaveform.length
        );
        const masterMeterVal = Math.min(100, Math.max(0, masterRms * 200));
        setMasterMeterValue(masterMeterVal);
      }
    }, 50); // Update every 50ms for smooth meter movement
    
    return () => {
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
        meterIntervalRef.current = null;
      }
    };
  }, [isPlaying]);
  
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
      }
      
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) instrument.player.dispose();
        if (instrument.volumeNode) instrument.volumeNode.dispose();
        if (instrument.analyser) instrument.analyser.dispose();
      });
      
      if (masterAnalyserRef.current) {
        masterAnalyserRef.current.dispose();
      }
    };
  }, []);

  const togglePlayback = useCallback(async () => {
    if (!isStarted) {
      await startContext();
    }
    
    if (isPlaying) {
      // Stop all instruments
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) {
          instrument.player.stop();
        }
      });
      setIsPlaying(false);
    } else {
      // Start all instruments
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.player) {
          instrument.player.start();
        }
      });
      setIsPlaying(true);
    }
  }, [isPlaying, isStarted, startContext]);
  
  const setInstrumentVolume = useCallback((instrumentId: InstrumentType, volumeDb: number) => {
    console.log(`Setting ${instrumentId} volume to ${volumeDb}dB`);
    
    if (instrumentsRef.current[instrumentId].volumeNode) {
      // Directly set the volume value
      instrumentsRef.current[instrumentId].volumeNode!.volume.value = volumeDb;
      
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

  return {
    instruments,
    isPlaying,
    isLoading,
    error,
    trackSettings,
    masterMeterValue,
    generateTrack,
    togglePlayback,
    setInstrumentVolume,
    setTrackSettings,
  };
}
