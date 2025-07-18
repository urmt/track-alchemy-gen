
// Import MidiWriter correctly - it's a default export
import MidiWriter from 'midi-writer-js';
import { TrackSettings } from './types';

export function useMidiExporter() {
  const downloadMidiTrack = (
    isTrackGenerated: boolean,
    trackSettings: TrackSettings
  ) => {
    if (!isTrackGenerated) {
      return { success: false, error: "No track has been generated yet" };
    }

    try {
      // Create a new MIDI writer instance
      const tracks: MidiWriter.Track[] = [];

      // Create tracks for each instrument
      const instrumentTypes = ['drums', 'bass', 'guitar', 'keys'];
      
      // Define basic note patterns based on genre and mood
      const getNotesForInstrument = (instrument: string) => {
        const keyNotes: Record<string, string[]> = {
          'C': ['C4', 'E4', 'G4', 'C5'],
          'D': ['D4', 'F#4', 'A4', 'D5'],
          'E': ['E4', 'G#4', 'B4', 'E5'],
          'F': ['F4', 'A4', 'C5', 'F5'],
          'G': ['G4', 'B4', 'D5', 'G5'],
          'A': ['A4', 'C#5', 'E5', 'A5'],
          'B': ['B4', 'D#5', 'F#5', 'B5'],
        };
        
        // Get notes for the selected key (default to C if not found)
        const notes = keyNotes[trackSettings.key] || keyNotes['C'];
        
        // Create different patterns per instrument
        switch (instrument) {
          case 'drums':
            return [
              { pitch: 'C2', duration: '4' }, // Kick
              { pitch: 'D2', duration: '8' }, // Snare
              { pitch: 'F#2', duration: '16' }, // Hi-hat
              { pitch: 'D2', duration: '8' }, // Snare
            ];
          case 'bass':
            return [
              { pitch: notes[0].replace('4', '2'), duration: '4' },
              { pitch: notes[2].replace('4', '2'), duration: '4' },
              { pitch: notes[0].replace('4', '2'), duration: '2' },
            ];
          case 'guitar':
            return [
              { pitch: [notes[0], notes[2]], duration: '4' },
              { pitch: [notes[1], notes[3]], duration: '4' },
              { pitch: [notes[0], notes[2]], duration: '2' },
            ];
          case 'keys':
            return [
              { pitch: notes, duration: '1' },
            ];
          default:
            return [{ pitch: 'C4', duration: '4' }];
        }
      };

      // Create a MIDI track for each instrument
      instrumentTypes.forEach((instrument, i) => {
        const track = new MidiWriter.Track();
        
        // Set instrument based on general MIDI standards
        const instrumentGMNumber = {
          'drums': 118, // Synth Drum
          'bass': 33,   // Electric Bass
          'guitar': 27, // Clean Electric Guitar
          'keys': 0     // Acoustic Grand Piano
        };
        
        // Set the instrument voice
        track.addEvent(
          new MidiWriter.ProgramChangeEvent({
            instrument: instrumentGMNumber[instrument as keyof typeof instrumentGMNumber]
          })
        );

        // Calculate microseconds per quarter note (MPQN) for tempo
        // MPQN = 60,000,000 / BPM
        const mpqn = Math.round(60000000 / trackSettings.bpm);
        
        // Create a tempo event by directly passing bpm and mpqn values
        // Fix for the TS2554 error - setTempo expects 2 arguments in this version
        track.setTempo(trackSettings.bpm, mpqn);
        
        // Set channel using channel parameter on the note events
        // For drums, use channel 10 (9 in zero-based) as per MIDI standard
        let channel = instrument === 'drums' ? 9 : i % 8;
        
        // Generate notes based on instrument type
        const notesPattern = getNotesForInstrument(instrument);
        
        // Generate all notes synchronously to ensure they're added to the track
        // Repeat the pattern a few times
        for (let bar = 0; bar < trackSettings.duration / 4; bar++) {
          notesPattern.forEach(noteInfo => {
            const event = new MidiWriter.NoteEvent({
              pitch: noteInfo.pitch,
              duration: noteInfo.duration,
              velocity: 100,
              channel: channel // Set channel directly on note events
            });
            track.addEvent(event);
          });
        }
        
        tracks.push(track);
      });

      // Generate a writer and include all tracks
      const writer = new MidiWriter.Writer(tracks);
      
      // Create MIDI data and download
      const midiData = writer.buildFile();
      
      // Create a Blob for the MIDI data
      const blob = new Blob([midiData], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      
      // Create a filename based on track settings
      const filename = `midi-${trackSettings.genre}-${trackSettings.key}-${trackSettings.bpm}bpm.mid`;
      
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
      
      return { success: true };
    } catch (err) {
      console.error("Error creating MIDI file:", err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error creating MIDI file" 
      };
    }
  };

  return { downloadMidiTrack };
}
