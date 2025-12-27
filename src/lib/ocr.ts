import Tesseract, { createWorker, Worker, RecognizeResult } from 'tesseract.js';

export type OCRLanguage = 'eng' | 'hin' | 'eng+hin';

interface OCRResult {
  text: string;
  confidence: number;
  blocks: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    confidence: number;
  }>;
}

let worker: Worker | null = null;
let currentLang: OCRLanguage | null = null;

export const initOCR = async (
  lang: OCRLanguage = 'eng',
  onProgress?: (progress: number, status: string) => void
): Promise<Worker> => {
  if (worker && currentLang === lang) {
    return worker;
  }

  if (worker) {
    await worker.terminate();
    worker = null;
  }

  onProgress?.(0, 'Initializing OCR engine...');

  worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (m.status === 'loading language traineddata') {
        onProgress?.(10, `Loading ${lang} language data...`);
      } else if (m.status === 'initializing api') {
        onProgress?.(30, 'Initializing OCR API...');
      } else if (m.status === 'recognizing text') {
        const progress = 30 + (m.progress * 60);
        onProgress?.(progress, 'Recognizing text...');
      }
    },
  });

  currentLang = lang;
  onProgress?.(100, 'OCR engine ready');
  
  return worker;
};

export const recognizeImage = async (
  imageSource: File | Blob | string,
  lang: OCRLanguage = 'eng',
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> => {
  const ocrWorker = await initOCR(lang, onProgress);
  
  const result = await ocrWorker.recognize(imageSource);
  
  const blocks = result.data.blocks?.map(block => ({
    text: block.text,
    bbox: block.bbox,
    confidence: block.confidence,
  })) || [];

  return {
    text: result.data.text,
    confidence: result.data.confidence,
    blocks,
  };
};

export const terminateOCR = async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
    currentLang = null;
  }
};

export const getLanguageLabel = (lang: OCRLanguage): string => {
  const labels: Record<OCRLanguage, string> = {
    eng: 'English',
    hin: 'Hindi',
    'eng+hin': 'English + Hindi',
  };
  return labels[lang];
};
