import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFPage {
  pageNumber: number;
  width: number;
  height: number;
  imageData: ImageData;
  canvas: HTMLCanvasElement;
}

export interface PDFInfo {
  numPages: number;
  title?: string;
  author?: string;
}

export const loadPDF = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf;
};

export const getPDFInfo = async (pdf: pdfjsLib.PDFDocumentProxy): Promise<PDFInfo> => {
  const metadata = await pdf.getMetadata();
  return {
    numPages: pdf.numPages,
    title: (metadata.info as any)?.Title,
    author: (metadata.info as any)?.Author,
  };
};

export const renderPDFPage = async (
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number = 2.0
): Promise<PDFPage> => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;
  
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  
  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    imageData,
    canvas,
  };
};

export const extractTextFromPDF = async (
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<{ text: string; items: Array<{ str: string; x: number; y: number; width: number; height: number }> }> => {
  const page = await pdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  
  const items = textContent.items
    .filter((item): item is { str: string; transform: number[]; width: number; height: number } => 'str' in item)
    .map(item => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    }));
  
  const text = items.map(item => item.str).join(' ');
  
  return { text, items };
};

export const detectTablesInPDF = async (
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<Array<{ rows: string[][]; x: number; y: number; width: number; height: number }>> => {
  const page = await pdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  
  const items = textContent.items
    .filter((item): item is { str: string; transform: number[]; width: number; height: number } => 'str' in item)
    .map(item => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    }));
  
  // Group items by y-position (rows)
  const tolerance = 5;
  const rows: Map<number, typeof items> = new Map();
  
  items.forEach(item => {
    let foundRow = false;
    for (const [y, rowItems] of rows) {
      if (Math.abs(item.y - y) < tolerance) {
        rowItems.push(item);
        foundRow = true;
        break;
      }
    }
    if (!foundRow) {
      rows.set(item.y, [item]);
    }
  });
  
  // Sort rows by y-position (descending for PDF coordinates)
  const sortedRows = Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([_, rowItems]) => {
      // Sort items in each row by x-position
      return rowItems.sort((a, b) => a.x - b.x).map(item => item.str);
    });
  
  // Simple table detection: if we have consistent column alignment
  if (sortedRows.length > 1) {
    return [{
      rows: sortedRows,
      x: 0,
      y: 0,
      width: page.view[2],
      height: page.view[3],
    }];
  }
  
  return [];
};
