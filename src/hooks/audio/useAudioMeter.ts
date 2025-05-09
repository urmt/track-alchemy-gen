
import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { InstrumentTrack } from './types';

export function useAudioMeter(instruments: InstrumentTrack[], isPlaying: boolean) {
  const [masterMeterValue, setMasterMeterValue] = useState(0);
  const masterAnalyserRef = useRef<Tone.Analyser | null>(null);
  const meterIntervalRef = useRef<number | null>(null);

  // Set up master analyser
  const setupMasterAnalyser = useCallback((masterVolume: Tone.Volume | null) => {
    if (masterVolume) {
      // Always dispose of previous analyser to prevent leaks
      if (masterAnalyserRef.current) {
        masterAnalyserRef.current.dispose();
      }
      
      // Create waveform analyser instead of 'level' analyser (which is not a valid type)
      // Valid analyser types in Tone.js are 'waveform' or 'fft'
      const analyser = new Tone.Analyser('waveform', 128);
      masterVolume.connect(analyser);
      masterAnalyserRef.current = analyser;
      console.log("Master analyser connected");
    }
    
    return () => {
      if (masterAnalyserRef.current) {
        masterAnalyserRef.current.dispose();
        masterAnalyserRef.current = null;
        console.log("Master analyser disposed");
      }
    };
  }, []);

  // Start meter monitoring - responds to isPlaying changes
  const startMeterMonitoring = useCallback((
    instrumentsRef: React.MutableRefObject<Record<string, InstrumentTrack>>,
    setInstruments: React.Dispatch<React.SetStateAction<InstrumentTrack[]>>
  ) => {
    // Clear any existing interval to prevent duplicates
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    
    console.log("Starting meter monitoring, playback state:", isPlaying ? "playing" : "stopped");
    
    // Set up a new interval for meter updates
    meterIntervalRef.current = window.setInterval(() => {
      // Update each instrument meter
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.analyser) {
          try {
            // For waveform analysers, getValue() returns a Float32Array of values
            const waveform = instrument.analyser.getValue() as Float32Array;
            
            // Calculate RMS (root mean square) from waveform data to get amplitude
            let sum = 0;
            for (let i = 0; i < waveform.length; i++) {
              sum += waveform[i] * waveform[i];
            }
            const rms = Math.sqrt(sum / waveform.length);
            
            // Convert to a reasonable meter scale (0-100)
            const meterValue = Math.min(100, Math.max(0, rms * 400));
            
            // Only update if there's a significant change to reduce rerenders
            const currentValue = instrumentsRef.current[instrument.id].meterValue;
            if (Math.abs(currentValue - meterValue) > 0.5 || (meterValue < 1 && currentValue > 0)) {
              // Update instrument meter value in our ref object
              instrumentsRef.current[instrument.id].meterValue = meterValue;
              
              // Update state to trigger UI update
              setInstruments(prev => {
                const updated = prev.map(i => 
                  i.id === instrument.id ? { ...i, meterValue } : i
                );
                return updated;
              });
            }
          } catch (err) {
            console.warn(`Error reading meter for ${instrument.id}:`, err);
          }
        } else if (instrument.meterValue > 0) {
          // Reset meter when no analyser and value > 0
          instrumentsRef.current[instrument.id].meterValue = 0;
          setInstruments(prev => prev.map(i => 
            i.id === instrument.id ? { ...i, meterValue: 0 } : i
          ));
        }
      });
      
      // Update master meter
      if (masterAnalyserRef.current) {
        try {
          // Calculate master meter value from waveform data
          const masterWaveform = masterAnalyserRef.current.getValue() as Float32Array;
          
          // Calculate RMS from waveform data to get amplitude
          let sum = 0;
          for (let i = 0; i < masterWaveform.length; i++) {
            sum += masterWaveform[i] * masterWaveform[i];
          }
          const masterRms = Math.sqrt(sum / masterWaveform.length);
          
          // Convert to a reasonable meter scale (0-100)
          const masterMeterVal = Math.min(100, Math.max(0, masterRms * 400));
          setMasterMeterValue(masterMeterVal);
        } catch (err) {
          console.warn("Error reading master meter:", err);
          if (masterMeterValue > 0) {
            setMasterMeterValue(0);
          }
        }
      } else if (masterMeterValue > 0) {
        setMasterMeterValue(0);
      }
    }, 100); // Update every 100ms for responsive but efficient meter movement
    
    // Return cleanup function
    return () => {
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
        meterIntervalRef.current = null;
        console.log("Meter monitoring stopped");
      }
    };
  }, [isPlaying, masterMeterValue]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
        meterIntervalRef.current = null;
        console.log("Meter monitoring cleanup on unmount");
      }
      
      if (masterAnalyserRef.current) {
        masterAnalyserRef.current.dispose();
        masterAnalyserRef.current = null;
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
