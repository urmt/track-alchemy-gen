
import { useCallback } from 'react';
import { useSampleManager } from '../useSampleManager';
import { InstrumentType } from './types';

export function useTrackSamples() {
  const { getSamples, getSampleUrl } = useSampleManager();

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

  return { getSampleUrlForInstrument };
}
