
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileObject } from '@supabase/storage-js';

export type InstrumentType = 'drums' | 'bass' | 'guitar' | 'keys';

interface Sample {
  id: string;
  name: string;
  instrument_type: InstrumentType;
  file_path: string;
  created_at: string;
}

export function useSampleManager() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadSample = useCallback(async (file: File, instrumentType: InstrumentType) => {
    try {
      setIsUploading(true);
      setError(null);

      // Upload file to storage
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError, data } = await supabase.storage
        .from('audio_samples')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create sample metadata in database
      const { error: dbError } = await supabase
        .from('samples')
        .insert({
          name: file.name,
          instrument_type: instrumentType,
          file_path: fileName,
        });

      if (dbError) throw dbError;

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload sample';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsUploading(false);
    }
  }, []);

  const deleteSample = useCallback(async (id: string, filePath: string) => {
    try {
      setError(null);
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('audio_samples')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete metadata from database
      const { error: dbError } = await supabase
        .from('samples')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete sample';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const getSamples = useCallback(async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('samples')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch samples';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const getSampleUrl = useCallback((filePath: string) => {
    const { data } = supabase.storage
      .from('audio_samples')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  }, []);

  return {
    uploadSample,
    deleteSample,
    getSamples,
    getSampleUrl,
    isUploading,
    error
  };
}
