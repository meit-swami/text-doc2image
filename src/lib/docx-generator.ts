import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  TabStopType,
  TabStopPosition,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
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

interface OCRBlock {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

// Helper to detect if block is on the right side of page
const isRightAligned = (block: OCRBlock, pageWidth: number): boolean => {
  const blockCenter = (block.bbox.x0 + block.bbox.x1) / 2;
  return blockCenter > pageWidth * 0.6;
};

// Helper to detect if block is centered
const isCentered = (block: OCRBlock, pageWidth: number): boolean => {
  const blockCenter = (block.bbox.x0 + block.bbox.x1) / 2;
  return blockCenter > pageWidth * 0.35 && blockCenter < pageWidth * 0.65;
};

// Helper to detect if this looks like a signature line
const isSignatureLine = (text: string): boolean => {
  const signatureKeywords = ['सादर', 'आपका', 'भवदीय', 'Yours', 'Sincerely', 'Regards'];
  return signatureKeywords.some(kw => text.includes(kw));
};

// Helper to detect date patterns
const isDateLine = (text: string): boolean => {
  return /\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}|दिनांक|Date:/i.test(text);
};

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
  blocks: OCRBlock[],
  pageWidth: number,
  pageHeight: number
): Promise<Blob> => {
  // Filter out low confidence and empty blocks
  const validBlocks = blocks.filter(b => b.confidence > 25 && b.text.trim().length > 0);
  
  // Sort blocks by position (top to bottom, then left to right)
  const sortedBlocks = [...validBlocks].sort((a, b) => {
    const yDiff = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(yDiff) > 12) return yDiff;
    return a.bbox.x0 - b.bbox.x0;
  });

  // Group blocks into rows based on Y position
  interface Row {
    blocks: OCRBlock[];
    avgY: number;
  }
  
  const rows: Row[] = [];
  let currentRow: OCRBlock[] = [];
  let lastY = -Infinity;
  const rowThreshold = 15;

  for (const block of sortedBlocks) {
    if (currentRow.length === 0 || Math.abs(block.bbox.y0 - lastY) <= rowThreshold) {
      currentRow.push(block);
      lastY = currentRow.reduce((sum, b) => sum + b.bbox.y0, 0) / currentRow.length;
    } else {
      if (currentRow.length > 0) {
        rows.push({ 
          blocks: currentRow, 
          avgY: currentRow.reduce((sum, b) => sum + b.bbox.y0, 0) / currentRow.length 
        });
      }
      currentRow = [block];
      lastY = block.bbox.y0;
    }
  }
  if (currentRow.length > 0) {
    rows.push({ 
      blocks: currentRow, 
      avgY: currentRow.reduce((sum, b) => sum + b.bbox.y0, 0) / currentRow.length 
    });
  }

  const documentChildren: (Paragraph | Table)[] = [];
  
  // Detect header region (top 15% of page with multiple columns)
  const headerEndY = pageHeight * 0.15;
  const headerRows = rows.filter(r => r.avgY < headerEndY);
  const bodyRows = rows.filter(r => r.avgY >= headerEndY);

  // Process header rows - use table for dual-column layout
  if (headerRows.length > 0) {
    const leftBlocks: string[] = [];
    const rightBlocks: string[] = [];
    
    for (const row of headerRows) {
      row.blocks.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      for (const block of row.blocks) {
        if (isRightAligned(block, pageWidth)) {
          rightBlocks.push(block.text.trim());
        } else {
          leftBlocks.push(block.text.trim());
        }
      }
    }
    
    // Create header as a two-column table without borders
    if (leftBlocks.length > 0 || rightBlocks.length > 0) {
      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: leftBlocks.map(text => new Paragraph({
                  children: [new TextRun({ text, size: 20 })],
                  spacing: { after: 60 },
                })),
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: rightBlocks.map(text => new Paragraph({
                  children: [new TextRun({ text, size: 20 })],
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 60 },
                })),
              }),
            ],
          }),
        ],
      });
      documentChildren.push(headerTable);
      documentChildren.push(new Paragraph({ spacing: { after: 200 } }));
    }
  }

  // Process body rows
  for (const row of bodyRows) {
    row.blocks.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    
    const combinedText = row.blocks.map(b => b.text.trim()).join(' ');
    
    // Skip empty rows
    if (!combinedText.trim()) continue;
    
    // Determine alignment based on block positions
    let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
    const hasRightContent = row.blocks.some(b => isRightAligned(b, pageWidth));
    const hasLeftContent = row.blocks.some(b => b.bbox.x0 < pageWidth * 0.4);
    
    // Check for signature/date patterns that should be right-aligned
    if (isSignatureLine(combinedText) || 
        (hasRightContent && !hasLeftContent) ||
        combinedText.startsWith('आपका') ||
        combinedText.match(/^\(.*\)$/)) {
      alignment = AlignmentType.RIGHT;
    } else if (isCentered(row.blocks[0], pageWidth) && row.blocks.length === 1) {
      alignment = AlignmentType.CENTER;
    }
    
    // Check if this is a reference/date line (should use tabs for left-right separation)
    if (hasLeftContent && hasRightContent && row.blocks.length >= 2) {
      const leftText = row.blocks.filter(b => !isRightAligned(b, pageWidth)).map(b => b.text.trim()).join(' ');
      const rightText = row.blocks.filter(b => isRightAligned(b, pageWidth)).map(b => b.text.trim()).join(' ');
      
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({ text: leftText, size: 22 }),
          new TextRun({ text: '\t' }),
          new TextRun({ text: rightText, size: 22 }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { after: 120, line: 276 },
      }));
    } else {
      // Detect formatting
      const blockHeight = Math.max(...row.blocks.map(b => b.bbox.y1 - b.bbox.y0));
      const isLargeText = blockHeight > 25;
      const isHeading = isLargeText || 
        (combinedText.length < 60 && combinedText === combinedText.toUpperCase() && /[A-Z]/.test(combinedText));
      
      // Add indentation for paragraph text (longer lines that aren't headings)
      const indent = combinedText.length > 100 ? { firstLine: 720 } : undefined;
      
      documentChildren.push(new Paragraph({
        children: [
          new TextRun({
            text: combinedText,
            bold: isHeading,
            size: isHeading ? 24 : 22,
          }),
        ],
        heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
        alignment,
        indent,
        spacing: { after: isSignatureLine(combinedText) ? 60 : 120, line: 276 },
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
        children: documentChildren,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
};
