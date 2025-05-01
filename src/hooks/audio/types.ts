
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
  samplePath: string | null;
  loadingState: 'idle' | 'loading' | 'loaded' | 'error';
}

export interface UseTrackAudioProps {
  masterVolume: Tone.Volume | null;
  isStarted: boolean;
  startContext: () => Promise<void>;
  getContextId?: () => string | null;
}

export interface TrackDownloadResult {
  success: boolean;
  error?: string;
}
