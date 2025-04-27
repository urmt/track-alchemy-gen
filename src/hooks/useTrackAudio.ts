
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';

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
}

interface UseTrackAudioProps {
  masterVolume: Tone.Volume | null;
  isStarted: boolean;
  startContext: () => Promise<void>;
}

export function useTrackAudio({ masterVolume, isStarted, startContext }: UseTrackAudioProps) {
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
    drums: { id: 'drums', name: 'Drums', volume: -12, meterValue: 0, player: null, volumeNode: null, analyser: null },
    bass: { id: 'bass', name: 'Bass', volume: -15, meterValue: 0, player: null, volumeNode: null, analyser: null },
    guitar: { id: 'guitar', name: 'Guitar', volume: -18, meterValue: 0, player: null, volumeNode: null, analyser: null },
    keys: { id: 'keys', name: 'Keys', volume: -20, meterValue: 0, player: null, volumeNode: null, analyser: null },
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
  
  // Example dummy samples for development
  const dummySamples = {
    drums: '/samples/drums.mp3',
    bass: '/samples/bass.mp3',
    guitar: '/samples/guitar.mp3',
    keys: '/samples/keys.mp3',
  };

  // For development, we'll use placeholder audio URLs
  // In a real implementation, these would come from a database based on genre/mood
  const generatePlaceholderUrl = (instrument: InstrumentType): string => {
    // This would be replaced by a real sample selection function
    return dummySamples[instrument] || "https://tonejs.github.io/audio/berklee/gong_1.mp3";
  };

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
        const url = generatePlaceholderUrl(instrumentId);
        
        // Create audio chain: Player -> Volume -> Analyser -> Master Volume
        const volumeNode = new Tone.Volume(instrumentsRef.current[instrumentId].volume);
        const analyser = new Tone.Analyser('waveform', 128);
        
        // Set up buffer error handling
        const player = new Tone.Player({
          url,
          loop: true,
          onload: () => {
            console.log(`${instrumentId} loaded`);
            // Update state to show this instrument is ready
            setInstruments(prev => prev.map(i => 
              i.id === instrumentId ? { ...i, player, volumeNode, analyser } : i
            ));
          },
          onerror: (e) => {
            console.error(`Error loading ${instrumentId}:`, e);
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
            setInstruments(prev => prev.map(i => 
              i.id === instrumentId ? { ...i, player: fallbackOsc as unknown as Tone.Player } : i
            ));
          },
        }).connect(volumeNode);
        
        volumeNode.connect(analyser);
        volumeNode.connect(masterVolume || Tone.getDestination());
        
        // Store in our ref
        instrumentsRef.current[instrumentId] = {
          ...instrumentsRef.current[instrumentId],
          player,
          volumeNode,
          analyser
        };
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
  }, [isStarted, masterVolume, startContext]);
  
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
    if (instrumentsRef.current[instrumentId].volumeNode) {
      instrumentsRef.current[instrumentId].volumeNode!.volume.value = volumeDb;
      
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
