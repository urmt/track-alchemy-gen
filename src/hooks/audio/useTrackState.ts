
import { useState, useEffect } from 'react';
import { TrackSettings, InstrumentTrack } from './types';

// Key for storing track state in session storage
const TRACK_STATE_KEY = 'trackAlchemyState';

export function useTrackState(
  instrumentsRef: React.MutableRefObject<Record<string, InstrumentTrack>>, 
  setInstruments: React.Dispatch<React.SetStateAction<InstrumentTrack[]>>
) {
  // Track settings with default values
  const [trackSettings, setTrackSettings] = useState<TrackSettings>({
    genre: 'rock',
    mood: 'energetic',
    bpm: 120,
    key: 'C',
    duration: 16, // in bars
  });
  
  const [isTrackGenerated, setIsTrackGenerated] = useState(false);

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
  }, [trackSettings, isTrackGenerated, instrumentsRef]);
  
  // Load track state from session storage
  const loadSavedState = async (isStarted: boolean, regenerateTrackCallback: () => Promise<void>) => {
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
          if (instrumentsRef.current[id as any]) {
            instrumentsRef.current[id as any].volume = data.volume;
            instrumentsRef.current[id as any].samplePath = data.samplePath;
            instrumentsRef.current[id as any].loadingState = 'idle'; // Will be reloaded
            
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
          await regenerateTrackCallback();
        }
      }
    } catch (err) {
      console.error("Failed to load saved track state:", err);
    }
  };

  return {
    trackSettings,
    setTrackSettings,
    isTrackGenerated,
    setIsTrackGenerated,
    loadSavedState
  };
}
