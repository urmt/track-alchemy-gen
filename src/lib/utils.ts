import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility to convert between dB and linear gain
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const gainToDb = (gain: number): number => 20 * Math.log10(gain);

// Simple chord progression generator (placeholder for more sophisticated implementation)
export const generateChordProgression = (key: string, genre: string, mood: string, length: number = 4) => {
  // This function would be replaced with a more sophisticated implementation
  // that actually generates chord progressions based on music theory
  
  // Basic chord maps by key (actual implementation would be more sophisticated)
  const chordMaps: Record<string, string[]> = {
    'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
    'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
    'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'],
    // ...other keys would be defined similarly
  };
  
  // Default to C if key not found
  const chords = chordMaps[key] || chordMaps['C'];
  
  // Common chord progressions by genre (very simplified)
  const progressions: Record<string, number[][]> = {
    'rock': [[0, 3, 4], [0, 4, 5, 3], [0, 5, 3, 4]], // I-IV-V variations
    'pop': [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4]], // Common pop progressions
    'hip-hop': [[0, 5], [5, 3, 4], [0, 3, 0, 4]], // Loop-friendly
    'jazz': [[1, 4, 0], [1, 4, 0, 3], [0, 3, 6, 2, 5, 1, 4, 0]], // Jazz with ii-V-I
    'electronic': [[0, 5, 3, 4], [0, 0, 5, 5], [5, 5, 0, 0]], // Repetitive patterns
    'ambient': [[0, 5], [0, 3], [0, 5, 3]], // Simple and spacious
  };
  
  // Get progressions for the genre, or default to rock
  const genreProgressions = progressions[genre] || progressions['rock'];
  
  // Pick a progression based on the mood (simplified)
  let progressionIndex = 0;
  if (mood === 'energetic' || mood === 'intense') {
    progressionIndex = genreProgressions.length - 1; // More complex progression
  } else if (mood === 'relaxed' || mood === 'atmospheric') {
    progressionIndex = 0; // Simpler progression
  } else {
    progressionIndex = Math.floor(genreProgressions.length / 2); // Middle complexity
  }
  
  // Get the chord indices for this progression
  const chordIndices = genreProgressions[progressionIndex] || genreProgressions[0];
  
  // Create the chord progression with the requested length
  let progression = [];
  for (let i = 0; i < length; i++) {
    progression.push(chords[chordIndices[i % chordIndices.length]]);
  }
  
  return progression;
};

// Log an audio-related error
export const logAudioError = (context: string, error: unknown) => {
  console.error(`Audio error in ${context}:`, error);
  return error instanceof Error 
    ? error.message 
    : "An unknown error occurred with audio processing";
};
