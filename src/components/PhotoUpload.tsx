import React, { useRef, useState } from "react";
import { Camera, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { api } from "../utils/api";
import { toast } from "sonner";

interface PhotoUploadProps {
  label: string;
  value?: string; // URL
  onChange: (url: string, path: string) => void;
  required?: boolean;
}

export function SinglePhotoUpload({ label, value, onChange, required }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { path } = await api.uploadFile(file);
      // Construct a temporary local URL or use the path. 
      // The backend returns the path. We usually need a signed URL to view it.
      // For immediate preview, we can use URL.createObjectURL(file).
      // But for form submission, we pass the path.
      // The parent component should handle the path.
      // We'll pass path up.
      onChange(URL.createObjectURL(file), path); 
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {value ? (
        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("", "")}
            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-sm hover:bg-white text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div 
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            uploading ? 'bg-gray-50 border-gray-300' : 'border-gray-300 hover:border-amber-500 hover:bg-amber-50'
          }`}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-2" />
          ) : (
            <Camera className="w-8 h-8 text-gray-400 mb-2" />
          )}
          <span className="text-sm text-gray-500">
            {uploading ? "Загрузка..." : "Нажмите для фото или загрузки"}
          </span>
          <input 
            ref={inputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFile}
          />
        </div>
      )}
    </div>
  );
}
