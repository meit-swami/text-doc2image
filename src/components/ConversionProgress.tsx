import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Download, RefreshCw } from 'lucide-react';
import { saveAs } from 'file-saver';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

interface ConversionProgressProps {
  progress: number;
  status: string;
  isComplete: boolean;
  isError: boolean;
  outputBlob?: Blob;
  outputFileName?: string;
  onReset: () => void;
}

export const ConversionProgress: React.FC<ConversionProgressProps> = ({
  progress,
  status,
  isComplete,
  isError,
  outputBlob,
  outputFileName,
  onReset,
}) => {
  const { t } = useLanguage();

  const handleDownload = () => {
    if (outputBlob && outputFileName) {
      saveAs(outputBlob, outputFileName);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-8"
    >
      {!isComplete && !isError && (
        <div className="flex flex-col items-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="mb-6"
          >
            <Loader2 className="h-16 w-16 text-primary" />
          </motion.div>
          
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            {t.conversion.processing}
          </h3>
          <p className="mb-6 text-muted-foreground">{status}</p>

          <div className="w-full max-w-md">
            <div className="progress-bar">
              <motion.div
                className="progress-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {Math.round(progress)}%
            </p>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="mb-6"
          >
            <CheckCircle2 className="h-20 w-20 text-excel" />
          </motion.div>

          <h3 className="mb-2 text-2xl font-bold text-foreground">
            {t.conversion.complete}
          </h3>
          <p className="mb-6 text-muted-foreground">{outputFileName}</p>

          <div className="flex gap-4">
            <Button onClick={handleDownload} size="lg" className="gap-2">
              <Download className="h-5 w-5" />
              {t.conversion.download}
            </Button>
            <Button onClick={onReset} variant="outline" size="lg" className="gap-2">
              <RefreshCw className="h-5 w-5" />
              {t.conversion.convertAnother}
            </Button>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="mb-6"
          >
            <XCircle className="h-20 w-20 text-destructive" />
          </motion.div>

          <h3 className="mb-2 text-2xl font-bold text-foreground">
            {t.conversion.error}
          </h3>
          <p className="mb-6 text-muted-foreground">{status}</p>

          <Button onClick={onReset} variant="outline" size="lg" className="gap-2">
            <RefreshCw className="h-5 w-5" />
            {t.conversion.retry}
          </Button>
        </div>
      )}
    </motion.div>
  );
};
