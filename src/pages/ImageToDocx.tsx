import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Image } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FileDropzone } from '@/components/FileDropzone';
import { OCRSettings } from '@/components/OCRSettings';
import { ConversionProgress } from '@/components/ConversionProgress';
import { useLanguage } from '@/contexts/LanguageContext';
import { recognizeImage, OCRLanguage } from '@/lib/ocr';
import { createDocxFromText } from '@/lib/docx-generator';
import { saveConversion } from '@/lib/storage';
import { Button } from '@/components/ui/button';

const ImageToDocx = () => {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<OCRLanguage>('eng');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | undefined>();
  const [outputFileName, setOutputFileName] = useState<string | undefined>();

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setIsComplete(false);
    setIsError(false);
  };

  const handleConvert = useCallback(async () => {
    if (!selectedFile) return;

    setIsConverting(true);
    setProgress(0);
    setIsError(false);

    try {
      // Read image file
      setStatus(t.conversion.extractingText);
      
      const result = await recognizeImage(
        selectedFile,
        ocrLanguage,
        (prog, stat) => {
          setProgress(prog * 0.8);
          setStatus(stat);
        }
      );

      setProgress(80);
      setStatus(t.conversion.creatingDocument);

      // Create DOCX
      const docxBlob = await createDocxFromText(result.text);
      
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '') + '.docx';
      
      // Save to local storage
      await saveConversion({
        id: crypto.randomUUID(),
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        outputType: 'docx',
        timestamp: Date.now(),
        outputBlob: docxBlob,
        originalSize: selectedFile.size,
        outputSize: docxBlob.size,
      });

      setOutputBlob(docxBlob);
      setOutputFileName(fileName);
      setProgress(100);
      setIsComplete(true);
    } catch (error) {
      console.error('Conversion error:', error);
      setIsError(true);
      setStatus(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsConverting(false);
    }
  }, [selectedFile, ocrLanguage, t]);

  const handleReset = () => {
    setSelectedFile(null);
    setIsConverting(false);
    setProgress(0);
    setStatus('');
    setIsComplete(false);
    setIsError(false);
    setOutputBlob(undefined);
    setOutputFileName(undefined);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-3xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl icon-image">
              <Image className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              {t.converters.imageToDocx.title}
            </h1>
            <p className="text-muted-foreground">
              {t.converters.imageToDocx.description}
            </p>
          </motion.div>

          {!isConverting && !isComplete && !isError && (
            <div className="space-y-6">
              <FileDropzone
                accept="image/*"
                acceptedFormats={['JPG', 'PNG', 'WEBP', 'GIF', 'BMP']}
                onFileSelect={handleFileSelect}
                colorClass="icon-image"
              />

              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <OCRSettings
                    language={ocrLanguage}
                    onLanguageChange={setOcrLanguage}
                  />

                  <Button
                    onClick={handleConvert}
                    size="lg"
                    className="w-full gap-2"
                  >
                    Convert to Word
                  </Button>
                </motion.div>
              )}
            </div>
          )}

          {(isConverting || isComplete || isError) && (
            <ConversionProgress
              progress={progress}
              status={status}
              isComplete={isComplete}
              isError={isError}
              outputBlob={outputBlob}
              outputFileName={outputFileName}
              onReset={handleReset}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ImageToDocx;
