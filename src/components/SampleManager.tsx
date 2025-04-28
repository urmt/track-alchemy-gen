
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useSampleManager, InstrumentType } from '@/hooks/useSampleManager';
import { FileAudio, Trash2, Upload } from 'lucide-react';

export default function SampleManager() {
  const { toast } = useToast();
  const { uploadSample, deleteSample, getSamples, isUploading } = useSampleManager();
  const [samples, setSamples] = useState<any[]>([]);

  const loadSamples = async () => {
    const result = await getSamples();
    if (result.success) {
      setSamples(result.data || []);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, instrumentType: InstrumentType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await uploadSample(file, instrumentType);
    if (result.success) {
      toast({ title: "Success", description: "Sample uploaded successfully" });
      loadSamples();
    } else {
      toast({ 
        title: "Error", 
        description: result.error || "Failed to upload sample",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    const result = await deleteSample(id, filePath);
    if (result.success) {
      toast({ title: "Success", description: "Sample deleted successfully" });
      loadSamples();
    } else {
      toast({ 
        title: "Error", 
        description: result.error || "Failed to delete sample",
        variant: "destructive"
      });
    }
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

          <div className="space-y-4">
            {samples.map((sample) => (
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(sample.id, sample.file_path)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
