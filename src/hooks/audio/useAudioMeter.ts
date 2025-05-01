
import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { InstrumentTrack } from './types';

export function useAudioMeter(instruments: InstrumentTrack[], isPlaying: boolean) {
  const [masterMeterValue, setMasterMeterValue] = useState(0);
  const masterAnalyserRef = useRef<Tone.Analyser | null>(null);
  const meterIntervalRef = useRef<number | null>(null);

  // Set up master analyser
  const setupMasterAnalyser = useCallback((masterVolume: Tone.Volume | null) => {
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
  }, []);

  // Start meter monitoring
  const startMeterMonitoring = useCallback((
    instrumentsRef: React.MutableRefObject<Record<string, InstrumentTrack>>,
    setInstruments: React.Dispatch<React.SetStateAction<InstrumentTrack[]>>
  ) => {
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

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
      }
      
      if (masterAnalyserRef.current) {
        masterAnalyserRef.current.dispose();
      }
    };
  }, []);

  return {
    masterMeterValue,
    masterAnalyserRef,
    setupMasterAnalyser,
    startMeterMonitoring
  };
}
