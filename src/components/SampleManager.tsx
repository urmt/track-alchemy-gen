
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useSampleManager, InstrumentType } from '@/hooks/useSampleManager';
import { FileAudio, Trash2, Upload, Play } from 'lucide-react';

export default function SampleManager() {
  const { toast } = useToast();
  const { uploadSample, deleteSample, getSamples, getSampleUrl, isUploading } = useSampleManager();
  const [samples, setSamples] = useState<any[]>([]);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  useEffect(() => {
    // Initialize audio player
    const player = new Audio();
    player.addEventListener('ended', () => setCurrentlyPlaying(null));
    setAudioPlayer(player);
    
    // Cleanup
    return () => {
      player.pause();
      player.src = '';
    };
  }, []);

  const loadSamples = async () => {
    const result = await getSamples();
    if (result.success) {
      setSamples(result.data || []);
    } else {
      toast({ 
        title: "Error", 
        description: result.error || "Failed to load samples",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, instrumentType: InstrumentType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadSample(file, instrumentType);
      if (result.success) {
        toast({ title: "Success", description: "Sample uploaded successfully" });
        await loadSamples();
      } else {
        toast({ 
          title: "Error", 
          description: result.error || "Failed to upload sample",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({ 
        title: "Error", 
        description: "An unexpected error occurred during upload",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    // Stop playing if this is the current sample
    if (currentlyPlaying === id && audioPlayer) {
      audioPlayer.pause();
      setCurrentlyPlaying(null);
    }

    const result = await deleteSample(id, filePath);
    if (result.success) {
      toast({ title: "Success", description: "Sample deleted successfully" });
      await loadSamples();
    } else {
      toast({ 
        title: "Error", 
        description: result.error || "Failed to delete sample",
        variant: "destructive"
      });
    }
  };

  const handlePlaySample = (id: string, filePath: string) => {
    if (!audioPlayer) return;

    // If already playing this sample, stop it
    if (currentlyPlaying === id) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      setCurrentlyPlaying(null);
      return;
    }

    // Play the selected sample
    const url = getSampleUrl(filePath);
    audioPlayer.src = url;
    audioPlayer.play().catch(error => {
      console.error("Error playing sample:", error);
      toast({ 
        title: "Playback Error", 
        description: "Could not play the sample",
        variant: "destructive"
      });
    });
    setCurrentlyPlaying(id);
  };

  return (
    <Sheet onOpenChange={(open) => { if (open) loadSamples(); }}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className="w-full mb-4">
          LOAD SAMPLES
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Sample Manager</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {(['drums', 'bass', 'guitar', 'keys'] as InstrumentType[]).map((type) => (
              <div key={type} className="space-y-2">
                <h3 className="text-lg font-semibold capitalize">{type}</h3>
                <div className="relative">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    id={`upload-${type}`}
                    onChange={(e) => handleFileUpload(e, type)}
                    disabled={isUploading}
                  />
                  <label
                    htmlFor={`upload-${type}`}
                    className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-6 h-6" />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {samples.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No samples uploaded yet
              </div>
            ) : (
              samples.map((sample) => (
                <div
                  key={sample.id}
                  className="flex items-center justify-between p-4 bg-secondary/10 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <FileAudio className="w-5 h-5" />
                    <div>
                      <p className="font-medium">{sample.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {sample.instrument_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlaySample(sample.id, sample.file_path)}
                      className="mr-1"
                    >
                      <Play className={`w-4 h-4 ${currentlyPlaying === sample.id ? 'text-green-500' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(sample.id, sample.file_path)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
