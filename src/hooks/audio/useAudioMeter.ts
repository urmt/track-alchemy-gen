
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

  // Start meter monitoring - always run regardless of playback state
  const startMeterMonitoring = useCallback((
    instrumentsRef: React.MutableRefObject<Record<string, InstrumentTrack>>,
    setInstruments: React.Dispatch<React.SetStateAction<InstrumentTrack[]>>
  ) => {
    // Clear any existing interval to prevent duplicates
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    
    console.log("Starting meter monitoring");
    
    // Set up a new interval for meter updates
    meterIntervalRef.current = window.setInterval(() => {
      let hasActiveMeters = false;
      
      // Update each instrument meter
      Object.values(instrumentsRef.current).forEach(instrument => {
        if (instrument.analyser) {
          try {
            const waveform = instrument.analyser.getValue();
            // Calculate RMS volume
            const rms = Math.sqrt(
              (waveform as Float32Array).reduce((sum, val) => sum + val * val, 0) / 
              waveform.length
            );
            
            // Convert to a better visual range (0-100)
            const meterValue = Math.min(100, Math.max(0, rms * 400)); // Increased multiplier for better visibility
            
            if (meterValue > 1) {
              hasActiveMeters = true;
            }
            
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
          const masterWaveform = masterAnalyserRef.current.getValue();
          const masterRms = Math.sqrt(
            (masterWaveform as Float32Array).reduce((sum, val) => sum + val * val, 0) / 
            masterWaveform.length
          );
          // Increased multiplier for better visibility
          const masterMeterVal = Math.min(100, Math.max(0, masterRms * 400));
          
          if (masterMeterVal > 1) {
            hasActiveMeters = true;
          }
          
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
      
      // Log activity periodically for debugging
      if (hasActiveMeters) {
        console.log("Meter activity detected");
      }
    }, 50); // Update every 50ms for smooth meter movement
    
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
