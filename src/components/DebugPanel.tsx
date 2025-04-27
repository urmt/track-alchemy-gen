
import React from 'react';
import { AudioContextState } from '@/hooks/useAudioContext';
import { TrackSettings } from '@/hooks/useTrackAudio';

interface DebugPanelProps {
  audioContextState: AudioContextState;
  trackSettings: TrackSettings;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ 
  audioContextState, 
  trackSettings, 
  isLoading, 
  isPlaying,
  error 
}) => {
  return (
    <div className="p-4 bg-studio-panel rounded-lg font-mono">
      <h3 className="text-lg font-semibold mb-2">Debug Panel</h3>
      <div className="text-xs space-y-1 max-h-40 overflow-auto">
        <div><span className="text-studio-accent">AudioContext:</span> {audioContextState.isLoaded ? "Loaded" : "Not Loaded"}</div>
        <div><span className="text-studio-accent">Context Started:</span> {audioContextState.isStarted ? "Yes" : "No"}</div>
        <div><span className="text-studio-accent">Loading Samples:</span> {isLoading ? "Yes" : "No"}</div>
        <div><span className="text-studio-accent">Playback:</span> {isPlaying ? "Playing" : "Stopped"}</div>
        <div><span className="text-studio-accent">BPM:</span> {trackSettings.bpm}</div>
        <div><span className="text-studio-accent">Key:</span> {trackSettings.key}</div>
        <div><span className="text-studio-accent">Genre:</span> {trackSettings.genre}</div>
        <div><span className="text-studio-accent">Mood:</span> {trackSettings.mood}</div>
        {error && <div className="text-destructive">{error}</div>}
      </div>
    </div>
  );
};

export default DebugPanel;
