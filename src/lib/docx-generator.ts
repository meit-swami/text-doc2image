import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} from 'docx';

interface TextBlock {
  text: string;
  isHeading?: boolean;
  headingLevel?: 1 | 2 | 3;
  isBold?: boolean;
  isItalic?: boolean;
  fontSize?: number;
}

interface PageContent {
  blocks: TextBlock[];
  pageNumber: number;
}

export const createDocxFromText = async (
  text: string,
  fileName: string = 'document'
): Promise<Blob> => {
  const paragraphs = text.split('\n').filter(line => line.trim()).map(line => {
    const trimmed = line.trim();
    
    // Detect potential headings (all caps, short lines, or lines ending with colon)
    const isHeading = 
      (trimmed === trimmed.toUpperCase() && trimmed.length < 100 && trimmed.length > 0) ||
      (trimmed.length < 80 && trimmed.endsWith(':'));
    
    return new Paragraph({
      children: [
        new TextRun({
          text: trimmed,
          bold: isHeading,
          size: isHeading ? 28 : 24,
        }),
      ],
      heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
      spacing: {
        after: 200,
        line: 276,
      },
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
};

export const createDocxFromPages = async (
  pages: PageContent[],
  fileName: string = 'document'
): Promise<Blob> => {
  const children: Paragraph[] = [];
  
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      children.push(new Paragraph({
        children: [new PageBreak()],
      }));
    }
    
    page.blocks.forEach(block => {
      const textRuns = [
        new TextRun({
          text: block.text,
          bold: block.isBold || block.isHeading,
          italics: block.isItalic,
          size: block.fontSize || (block.isHeading ? 28 : 24),
        }),
      ];
      
      let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
      if (block.isHeading) {
        switch (block.headingLevel) {
          case 1:
            headingLevel = HeadingLevel.HEADING_1;
            break;
          case 2:
            headingLevel = HeadingLevel.HEADING_2;
            break;
          case 3:
            headingLevel = HeadingLevel.HEADING_3;
            break;
        }
      }
      
      children.push(new Paragraph({
        children: textRuns,
        heading: headingLevel,
        spacing: {
          after: 200,
          line: 276,
        },
      }));
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
};

export const createDocxFromOCRBlocks = async (
  blocks: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    confidence: number;
  }>,
  pageWidth: number,
  pageHeight: number
): Promise<Blob> => {
  // Sort blocks by position (top to bottom, left to right)
  const sortedBlocks = [...blocks].sort((a, b) => {
    const yDiff = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(yDiff) > 20) return yDiff;
    return a.bbox.x0 - b.bbox.x0;
  });
  
  const paragraphs = sortedBlocks.map(block => {
    const blockWidth = block.bbox.x1 - block.bbox.x0;
    const isLargeText = (block.bbox.y1 - block.bbox.y0) > 30;
    const isCentered = block.bbox.x0 > pageWidth * 0.2 && block.bbox.x1 < pageWidth * 0.8;
    
    return new Paragraph({
      children: [
        new TextRun({
          text: block.text,
          bold: isLargeText,
          size: isLargeText ? 28 : 24,
        }),
      ],
      heading: isLargeText ? HeadingLevel.HEADING_2 : undefined,
      alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: {
        after: 200,
        line: 276,
      },
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
};
