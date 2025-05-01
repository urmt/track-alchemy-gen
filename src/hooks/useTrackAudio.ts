
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

// Key for storing track state in session storage
const TRACK_STATE_KEY = 'trackAlchemyState';

export function useTrackAudio({ masterVolume, isStarted, startContext }: UseTrackAudioProps) {
  const { getSamples, getSampleUrl } = useSampleManager();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTrackGenerated, setIsTrackGenerated] = useState(false);
  
  // Track settings with default values
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
  
  // Load track state from session storage on initial load
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const savedState = sessionStorage.getItem(TRACK_STATE_KEY);
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          
          // Restore track settings
          setTrackSettings(parsedState.trackSettings);
          
          // Set flag that track was generated before
          if (parsedState.isTrackGenerated) {
            setIsTrackGenerated(true);
          }
          
          // Load instrument settings
          Object.entries(parsedState.instruments).forEach(([id, data]: [string, any]) => {
            if (instrumentsRef.current[id as InstrumentType]) {
              instrumentsRef.current[id as InstrumentType].volume = data.volume;
              instrumentsRef.current[id as InstrumentType].samplePath = data.samplePath;
              instrumentsRef.current[id as InstrumentType].loadingState = 'idle'; // Will be reloaded
              
              // Update the instruments state with volume changes
              setInstruments(prev => prev.map(inst => 
                inst.id === id ? { 
                  ...inst, 
                  volume: data.volume, 
                  samplePath: data.samplePath, 
                  loadingState: 'idle'
                } : inst
              ));
            }
          });
          
          console.log("Restored track state from session storage");
          
          // If there was a track generated before, automatically reload samples
          if (parsedState.isTrackGenerated && isStarted) {
            console.log("Automatically reloading saved track");
            await regenerateTrackFromSavedState();
          }
        }
      } catch (err) {
        console.error("Failed to load saved track state:", err);
      }
    };
    
    if (isStarted) {
      loadSavedState();
    }
  }, [isStarted]); 
  
  // Save track state to session storage whenever critical state changes
  useEffect(() => {
    if (isTrackGenerated) {
      const stateToSave = {
        trackSettings,
        isTrackGenerated,
        instruments: Object.fromEntries(
          Object.values(instrumentsRef.current).map(inst => [
            inst.id, 
            {
              volume: inst.volume,
              samplePath: inst.samplePath,
            }
          ])
        )
      };
      
      sessionStorage.setItem(TRACK_STATE_KEY, JSON.stringify(stateToSave));
    }
  }, [trackSettings, isTrackGenerated, instruments]);
  
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
      
      // Set up players with saved sample paths
      for (const instrumentId of Object.keys(instrumentsRef.current) as InstrumentType[]) {
        const instrument = instrumentsRef.current[instrumentId];
        
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
          
          // Continue to next instrument
          continue;
        }
        
        // Create audio chain: Player -> Volume -> Analyser -> Master Volume
        const volumeNode = new Tone.Volume(instrument.volume);
        const analyser = new Tone.Analyser('waveform', 128);
        
        // Set up buffer error handling
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
      }
      
      setIsTrackGenerated(true);
      setIsLoading(false);
      
      // Start meter monitoring
      startMeterMonitoring();
      
      console.log("Track regenerated with saved settings:", trackSettings);
    } catch (err) {
      console.error("Failed to regenerate track:", err);
      setError("Failed to regenerate track. Please try again.");
      setIsLoading(false);
    }
  }, [isStarted, masterVolume, startContext, getSampleUrlForInstrument, trackSettings]);

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
      
      setIsTrackGenerated(true);
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
  
  // Function to download the current track
  const downloadTrack = useCallback(async () => {
    try {
      if (!isTrackGenerated) {
        return { success: false, error: "No track has been generated yet" };
      }
      
      // Create an offline context to render the track
      console.log("Starting track rendering process...");
      
      const duration = 16; // 16 bars
      const beatsPerBar = 4;
      const bpm = trackSettings.bpm;
      const trackDuration = (duration * beatsPerBar * 60) / bpm;
      
      // Create an offline context
      const offlineContext = new Tone.OfflineContext(2, trackDuration, 44100);
      Tone.setContext(offlineContext);
      
      // Create a master volume node
      const offlineMaster = new Tone.Volume(-6).toDestination();
      
      // Re-create all instruments in the offline context
      const offlineInstruments: Record<string, any> = {};
      
      // Add each instrument to the offline context
      for (const instrument of Object.values(instrumentsRef.current)) {
        if (!instrument.samplePath) continue;
        
        const volumeNode = new Tone.Volume(instrument.volume);
        
        // Create a player for each instrument
        const player = new Tone.Player({
          url: instrument.samplePath,
          loop: true,
        }).connect(volumeNode);
        
        // Connect to the master volume
        volumeNode.connect(offlineMaster);
        
        offlineInstruments[instrument.id] = {
          player,
          volumeNode
        };
      }
      
      // Start all players
      for (const inst of Object.values(offlineInstruments)) {
        if (inst.player) {
          inst.player.start();
        }
      }
      
      // Render the full track
      console.log(`Rendering ${trackDuration} seconds of audio...`);
      const buffer = await offlineContext.render();
      console.log("Rendering complete.");
      
      // Convert the buffer to a WAV file
      const wav = toWav(buffer);
      
      // Create a download link
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Create a filename based on track settings
      const filename = `track-${trackSettings.genre}-${trackSettings.key}-${trackSettings.bpm}bpm.wav`;
      
      // Create and click a download link
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log("Track downloaded successfully");
      return { success: true };
    } catch (err) {
      console.error("Error downloading track:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    } finally {
      // Restore the main context
      Tone.setContext(Tone.getContext());
    }
  }, [isTrackGenerated, trackSettings]);
  
  // Helper function to convert AudioBuffer to WAV format
  const toWav = (audioBuffer: Tone.ToneAudioBuffer | AudioBuffer) => {
    // Get the actual AudioBuffer
    const buffer = 'get' in audioBuffer ? audioBuffer.get() : audioBuffer;
    
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2; // 2 bytes per sample
    const sampleRate = buffer.sampleRate;
    
    // Create the WAV file buffer
    const buffer1 = new ArrayBuffer(44 + length);
    const data = new DataView(buffer1);
    
    // WAV header
    // "RIFF" chunk descriptor
    writeString(data, 0, 'RIFF');
    data.setUint32(4, 36 + length, true);
    writeString(data, 8, 'WAVE');
    
    // "fmt " sub-chunk
    writeString(data, 12, 'fmt ');
    data.setUint32(16, 16, true); // subchunk size
    data.setUint16(20, 1, true); // PCM format
    data.setUint16(22, numOfChannels, true); // channels
    data.setUint32(24, sampleRate, true); // sample rate
    data.setUint32(28, sampleRate * numOfChannels * 2, true); // byte rate
    data.setUint16(32, numOfChannels * 2, true); // block align
    data.setUint16(34, 16, true); // bits per sample
    
    // "data" sub-chunk
    writeString(data, 36, 'data');
    data.setUint32(40, length, true);
    
    // Write the PCM samples
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        data.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Uint8Array(buffer1);
  };
  
  // Helper function to write a string to a DataView
  const writeString = (dataview: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      dataview.setUint8(offset + i, str.charCodeAt(i));
    }
  };

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
    downloadTrack,
  };
}
