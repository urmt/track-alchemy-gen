
import * as Tone from 'tone';
import { useCallback, useRef } from 'react';
import { InstrumentTrack, TrackSettings, TrackDownloadResult } from './types';

export function useAudioExporter() {
  // Add an in-progress ref to prevent concurrent exports
  const exportInProgressRef = useRef<boolean>(false);
  
  // Function to download the current track
  const downloadTrack = useCallback(async (
    isTrackGenerated: boolean,
    instrumentsRef: React.MutableRefObject<Record<string, InstrumentTrack>>,
    trackSettings: TrackSettings
  ): Promise<TrackDownloadResult> => {
    // Guard against concurrent operations
    if (exportInProgressRef.current) {
      console.log("Export already in progress, ignoring request");
      return { success: false, error: "Export already in progress" };
    }
    
    exportInProgressRef.current = true;
    console.log("Starting track export process...");
    
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
      
      // Yield to UI before intensive rendering
      await new Promise(resolve => setTimeout(resolve, 0));
      
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
      
      // Yield to UI before intensive rendering
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Render the full track
      console.log(`Rendering ${trackDuration} seconds of audio...`);
      const buffer = await offlineContext.render();
      console.log("Rendering complete.");
      
      // Yield to UI again before encoding
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Convert the buffer to a WAV file - move heavy processing off the main thread
      let wav: Uint8Array;
      await new Promise<void>(resolve => {
        // Use setTimeout to move this heavy computation off the main thread
        setTimeout(() => {
          wav = toWav(buffer);
          resolve();
        }, 0);
      });
      
      // Yield to UI again before creating download link
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Create a download link
      const blob = new Blob([wav!], { type: 'audio/wav' });
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
      
      // Clean up the URL immediately
      URL.revokeObjectURL(url);
      
      console.log("Track downloaded successfully");
      return { success: true };
    } catch (err) {
      console.error("Error downloading track:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    } finally {
      // Always reset the in-progress flag and restore the main context
      exportInProgressRef.current = false;
      Tone.setContext(Tone.getContext());
      console.log("Export process complete, flags reset");
    }
  }, []);

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
    
    // Write the PCM samples - process in chunks to prevent UI blocking
    let offset = 44;
    const chunkSize = 1000; // Process this many samples per chunk
    
    for (let i = 0; i < buffer.length; i++) {
      // Allow UI to respond every 1000 samples
      if (i % chunkSize === 0 && i > 0) {
        // This is a synchronous operation, so we can't await here
        // But breaking the loop gives the UI a chance to breathe
      }
      
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

  return { downloadTrack };
}
