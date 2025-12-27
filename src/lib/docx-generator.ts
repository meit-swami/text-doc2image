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
  // Filter out low confidence and empty blocks
  const validBlocks = blocks.filter(b => b.confidence > 30 && b.text.trim().length > 0);
  
  // Sort blocks by position (top to bottom, then left to right)
  const sortedBlocks = [...validBlocks].sort((a, b) => {
    const yDiff = a.bbox.y0 - b.bbox.y0;
    // Use larger threshold for row grouping
    if (Math.abs(yDiff) > 15) return yDiff;
    return a.bbox.x0 - b.bbox.x0;
  });

  // Group blocks into rows based on Y position
  const rows: typeof sortedBlocks[] = [];
  let currentRow: typeof sortedBlocks = [];
  let lastY = -Infinity;
  const rowThreshold = 20;

  for (const block of sortedBlocks) {
    if (currentRow.length === 0 || Math.abs(block.bbox.y0 - lastY) <= rowThreshold) {
      currentRow.push(block);
      lastY = block.bbox.y0;
    } else {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [block];
      lastY = block.bbox.y0;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  const paragraphs: Paragraph[] = [];

  for (const row of rows) {
    // Sort row blocks left to right
    row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    
    // Check if this is a multi-column row (blocks are horizontally separated)
    const isMultiColumn = row.length > 1 && 
      row.some((block, i) => i > 0 && block.bbox.x0 - row[i-1].bbox.x1 > pageWidth * 0.1);
    
    if (isMultiColumn) {
      // Combine multi-column content with tab separator
      const combinedText = row.map(b => b.text.trim()).join('\t\t\t');
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({
            text: combinedText,
            size: 22,
          }),
        ],
        tabStops: [
          { type: 'right', position: 9000 }
        ],
        spacing: { after: 120, line: 276 },
      }));
    } else {
      // Single column or continuous row - combine text
      const combinedText = row.map(b => b.text.trim()).join(' ');
      const blockHeight = Math.max(...row.map(b => b.bbox.y1 - b.bbox.y0));
      const isLargeText = blockHeight > 25;
      const rowCenter = (row[0].bbox.x0 + row[row.length - 1].bbox.x1) / 2;
      const isCentered = rowCenter > pageWidth * 0.35 && rowCenter < pageWidth * 0.65;
      
      // Detect if this is a heading (short, possibly uppercase)
      const isHeading = isLargeText || 
        (combinedText.length < 60 && combinedText === combinedText.toUpperCase() && /[A-Z]/.test(combinedText));
      
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({
            text: combinedText,
            bold: isHeading,
            size: isHeading ? 26 : 22,
          }),
        ],
        heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
        alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: isHeading ? 200 : 120, line: 276 },
      }));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
};
