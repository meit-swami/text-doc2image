import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileImage, FileText, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

interface FileDropzoneProps {
  accept: string;
  acceptedFormats: string[];
  onFileSelect: (file: File) => void;
  colorClass?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  accept,
  acceptedFormats,
  onFileSelect,
  colorClass = 'icon-pdf',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { t } = useLanguage();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const clearFile = () => {
    setSelectedFile(null);
  };

  const isPDF = accept.includes('pdf');
  const FileIcon = isPDF ? FileText : FileImage;

  if (selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6"
      >
        <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${colorClass}`}>
          <FileIcon className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-foreground">{selectedFile.name}</p>
          <p className="text-sm text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={clearFile}>
          <X className="h-5 w-5" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.label
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`dropzone ${isDragging ? 'drag-active' : ''}`}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="sr-only"
      />
      
      <motion.div
        animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
        className={`mb-4 flex h-20 w-20 items-center justify-center rounded-2xl ${colorClass}`}
      >
        <Upload className="h-10 w-10 text-primary-foreground" />
      </motion.div>

      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {t.dropzone.title}
      </h3>
      <p className="mb-4 text-muted-foreground">{t.dropzone.subtitle}</p>

      <div className="flex flex-wrap justify-center gap-2">
        <span className="text-sm text-muted-foreground">{t.dropzone.formats}:</span>
        {acceptedFormats.map((format) => (
          <span
            key={format}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
          >
            {format}
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{t.dropzone.maxSize}</p>
    </motion.label>
  );
};
