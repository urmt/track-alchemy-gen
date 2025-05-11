
import { useCallback, useState, useEffect } from 'react';
import { useSampleManager } from '../useSampleManager';
import { InstrumentType } from './types';
import { defaultSamples } from '@/audio/defaultSamples';

export function useTrackSamples() {
  const { getSamples, getSampleUrl } = useSampleManager();
  const [samplesLoaded, setSamplesLoaded] = useState(false);

  // Auto-load default samples on component mount
  useEffect(() => {
    // This will ensure the samples are ready to use
    console.log("Initializing default samples...");
    setSamplesLoaded(true);
  }, []);

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
      return defaultSamples[instrumentType];
    } catch (err) {
      console.error(`Error getting ${instrumentType} sample:`, err);
      
      // Fallback to defaults if there's an error
      console.log(`Error occurred, fallback to default ${instrumentType} sample`);
      return defaultSamples[instrumentType];
    }
  }, [getSamples, getSampleUrl]);

  return { 
    getSampleUrlForInstrument,
    samplesLoaded
  };
}
