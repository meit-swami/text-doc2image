/**
 * Block-Aware DOCX Generator
 * Creates DOCX with one paragraph per detected block
 * Preserves original layout, alignment, spacing, and indentation
 */

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
  convertInchesToTwip,
  IStylesOptions,
} from 'docx';
import { StructuredBlock, StructuredDocument, BlockType } from './local-llm';
import { DocumentType, detectDocumentType, DetectionResult } from './document-detector';

// Map block type to heading level
const getHeadingLevel = (type: BlockType): typeof HeadingLevel[keyof typeof HeadingLevel] | undefined => {
  switch (type) {
    case 'header':
      return HeadingLevel.HEADING_1;
    case 'subheader':
      return HeadingLevel.HEADING_2;
    case 'subject':
      return HeadingLevel.HEADING_3;
    default:
      return undefined;
  }
};

// Map alignment to DOCX alignment
const getAlignment = (alignment: string): typeof AlignmentType[keyof typeof AlignmentType] => {
  switch (alignment) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justified':
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.LEFT;
  }
};

// Map font size to half-points (DOCX uses half-points)
const getFontSize = (size: string): number => {
  switch (size) {
    case 'small':
      return 20; // 10pt
    case 'large':
      return 28; // 14pt
    case 'xlarge':
      return 32; // 16pt
    default:
      return 24; // 12pt (normal)
  }
};

// Convert indentation level to twips
const getIndentation = (level: number): number => {
  return level * 720; // 720 twips = 0.5 inch per level
};

// Get document-specific styles
const getDocumentStyles = (docType: DocumentType): IStylesOptions => {
  const baseParagraphStyles: IStylesOptions['paragraphStyles'] = [
    {
      id: 'Normal',
      name: 'Normal',
      run: { size: 24, font: 'Times New Roman' },
      paragraph: { spacing: { after: 120, line: 276 } },
    },
    {
      id: 'Header',
      name: 'Header',
      basedOn: 'Normal',
      run: { size: 28, bold: true },
      paragraph: { spacing: { after: 200 }, alignment: AlignmentType.CENTER },
    },
    {
      id: 'Subject',
      name: 'Subject',
      basedOn: 'Normal',
      run: { size: 24, bold: true, underline: {} },
      paragraph: { spacing: { before: 240, after: 240 } },
    },
    {
      id: 'Body',
      name: 'Body',
      basedOn: 'Normal',
      run: { size: 24 },
      paragraph: { spacing: { after: 120, line: 276 } },
    },
    {
      id: 'Signature',
      name: 'Signature',
      basedOn: 'Normal',
      run: { size: 24 },
      paragraph: { spacing: { after: 60 }, alignment: AlignmentType.RIGHT },
    },
  ];

  // Type-specific customizations - create a mutable copy
  const paragraphStyles = [...(baseParagraphStyles || [])];
  
  if (docType === 'legal_notice') {
    paragraphStyles.push({
      id: 'LegalBody',
      name: 'Legal Body',
      basedOn: 'Normal',
      run: { size: 24 },
      paragraph: { 
        alignment: AlignmentType.LEFT,
        spacing: { after: 160, line: 300 },
      },
    });
  }

  return {
    paragraphStyles,
  };
};

export interface BlockAwareConversionResult {
  docxBlob: Blob;
  detectedType: DetectionResult;
  structuredDocument: StructuredDocument;
}

/**
 * Create borderless table cell for header layouts
 */
const createNoBorderCell = (children: Paragraph[], width: number = 50): TableCell => {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    children,
  });
};

/**
 * Group header blocks into left/right columns for table layout
 */
const processHeaderBlocks = (
  blocks: StructuredBlock[],
  pageWidth: number
): (Paragraph | Table)[] => {
  const headerBlocks = blocks.filter(b => 
    b.type === 'header' || b.type === 'subheader' || b.type === 'reference' || b.type === 'date'
  );

  if (headerBlocks.length === 0) return [];

  // Separate left and right aligned blocks
  const leftBlocks = headerBlocks.filter(b => b.alignment !== 'right');
  const rightBlocks = headerBlocks.filter(b => b.alignment === 'right');
  const centerBlocks = headerBlocks.filter(b => b.alignment === 'center');

  const result: (Paragraph | Table)[] = [];

  // Handle centered headers first
  for (const block of centerBlocks) {
    result.push(new Paragraph({
      children: [
        new TextRun({
          text: block.text,
          bold: block.isBold,
          size: getFontSize(block.fontSize),
          font: 'Times New Roman',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: block.spacingAfter * 20 || 100 },
    }));
  }

  // Create two-column table for left/right header if both exist
  if (leftBlocks.length > 0 && rightBlocks.length > 0) {
    const leftParagraphs = leftBlocks.map(block => new Paragraph({
      children: [
        new TextRun({
          text: block.text,
          bold: block.isBold,
          size: getFontSize(block.fontSize),
          font: 'Times New Roman',
        }),
      ],
      spacing: { after: 60 },
    }));

    const rightParagraphs = rightBlocks.map(block => new Paragraph({
      children: [
        new TextRun({
          text: block.text,
          bold: block.isBold,
          size: getFontSize(block.fontSize),
          font: 'Times New Roman',
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
    }));

    result.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            createNoBorderCell(leftParagraphs),
            createNoBorderCell(rightParagraphs),
          ],
        }),
      ],
    }));
  } else {
    // Single column header
    for (const block of [...leftBlocks, ...rightBlocks]) {
      result.push(new Paragraph({
        children: [
          new TextRun({
            text: block.text,
            bold: block.isBold,
            size: getFontSize(block.fontSize),
            font: 'Times New Roman',
          }),
        ],
        alignment: getAlignment(block.alignment),
        spacing: { after: block.spacingAfter * 20 || 60 },
      }));
    }
  }

  // Add spacing after header section
  if (result.length > 0) {
    result.push(new Paragraph({ spacing: { after: 200 } }));
  }

  return result;
};

/**
 * Create a single DOCX paragraph from a structured block
 * Each block becomes exactly one paragraph - preserving original line breaks
 */
const createParagraphFromBlock = (
  block: StructuredBlock,
  prevBlock: StructuredBlock | null,
  documentType: DocumentType
): Paragraph => {
  const textRuns: TextRun[] = [];

  // Create the main text run with proper formatting
  textRuns.push(new TextRun({
    text: block.text,
    bold: block.isBold,
    italics: block.isItalic,
    underline: block.isUnderlined ? {} : undefined,
    size: getFontSize(block.fontSize),
    font: 'Times New Roman',
  }));

  // Calculate spacing in twips (1 point = 20 twips)
  // Use smaller default spacing to keep lines close together like original
  let spacingBefore = 0;
  let spacingAfter = 0;
  
  // Only add significant spacing at paragraph boundaries
  if (block.isFirstInParagraph && prevBlock) {
    // New paragraph - add visible gap
    spacingBefore = Math.max(block.spacingBefore * 20, 160); // At least 8pt
  } else if (prevBlock) {
    // Same paragraph - minimal spacing (just line height)
    spacingBefore = Math.min(block.spacingBefore * 20, 40); // Max 2pt between lines
  }
  
  if (block.isLastInParagraph) {
    // End of paragraph - small gap before next paragraph starts
    spacingAfter = Math.max(block.spacingAfter * 20, 80); // At least 4pt
  } else {
    // Within paragraph - minimal spacing
    spacingAfter = Math.min(block.spacingAfter * 20, 40);
  }

  // Apply type-specific spacing for special blocks
  if (block.type === 'header' || block.type === 'subheader') {
    spacingBefore = Math.max(spacingBefore, 120);
    spacingAfter = Math.max(spacingAfter, 100);
  } else if (block.type === 'subject') {
    spacingBefore = Math.max(spacingBefore, 240);
    spacingAfter = Math.max(spacingAfter, 200);
  } else if (block.type === 'salutation') {
    spacingBefore = Math.max(spacingBefore, 200);
    spacingAfter = Math.max(spacingAfter, 120);
  } else if (block.type === 'signature') {
    spacingBefore = Math.max(spacingBefore, 200);
    spacingAfter = Math.max(spacingAfter, 40);
  } else if (block.type === 'date' || block.type === 'reference') {
    spacingBefore = Math.max(spacingBefore, 60);
    spacingAfter = Math.max(spacingAfter, 60);
  } else if (block.type === 'address') {
    spacingAfter = 40; // Tight spacing for address lines
  }

  // Determine alignment - use block's detected alignment
  let alignment = getAlignment(block.alignment);
  
  // Override for specific block types
  if (block.type === 'signature') {
    alignment = AlignmentType.RIGHT;
  } else if (block.type === 'subject' && documentType === 'legal_notice') {
    alignment = AlignmentType.CENTER;
  }

  // Calculate indentation
  const indent: { firstLine?: number; left?: number } = {};
  
  if (block.indentation > 0) {
    indent.left = getIndentation(block.indentation);
  }
  
  // Don't auto-indent first lines - preserve original layout
  // Only add first line indent if explicitly detected

  return new Paragraph({
    children: textRuns,
    heading: getHeadingLevel(block.type),
    alignment,
    spacing: { 
      before: spacingBefore, 
      after: spacingAfter,
      line: 240, // Single line spacing (240 twips = 1.0)
    },
    indent: Object.keys(indent).length > 0 ? indent : undefined,
  });
};

/**
 * Main function: Generate block-aware DOCX from structured document
 */
export const generateBlockAwareDocx = async (
  structuredDoc: StructuredDocument,
  pageWidth: number,
  pageHeight: number,
  overrideDocumentType?: DocumentType
): Promise<BlockAwareConversionResult> => {
  // Detect document type from blocks
  const ocrBlocks = structuredDoc.blocks.map(b => ({
    text: b.text,
    bbox: b.bbox,
    confidence: b.confidence * 100,
  }));
  
  const detectedType = detectDocumentType(ocrBlocks, pageWidth, pageHeight);
  const documentType = overrideDocumentType || detectedType.type;
  
  const documentChildren: (Paragraph | Table)[] = [];
  
  // Sort blocks by reading order
  const sortedBlocks = [...structuredDoc.blocks].sort((a, b) => a.readingOrder - b.readingOrder);
  
  // Separate header blocks for special processing
  const headerTypes: BlockType[] = ['header', 'subheader', 'reference', 'date'];
  const headerBlocks = sortedBlocks.filter(b => 
    headerTypes.includes(b.type) && 
    b.bbox.y0 / pageHeight < 0.18
  );
  const bodyBlocks = sortedBlocks.filter(b => 
    !headerTypes.includes(b.type) || 
    b.bbox.y0 / pageHeight >= 0.18
  );
  
  // Process header with special table layout
  const headerElements = processHeaderBlocks(headerBlocks, pageWidth);
  documentChildren.push(...headerElements);
  
  // Process body blocks - one paragraph per block
  for (let i = 0; i < bodyBlocks.length; i++) {
    const block = bodyBlocks[i];
    const prevBlock = i > 0 ? bodyBlocks[i - 1] : null;
    
    // Skip already processed header blocks
    if (headerBlocks.includes(block)) continue;
    
    const paragraph = createParagraphFromBlock(block, prevBlock, documentType);
    documentChildren.push(paragraph);
  }
  
  // Ensure we have content
  if (documentChildren.length === 0) {
    documentChildren.push(new Paragraph({
      children: [new TextRun({ text: 'No content detected', italics: true })],
    }));
  }
  
  // Create document with proper styles
  const doc = new Document({
    styles: getDocumentStyles(documentType),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: documentChildren,
      },
    ],
  });
  
  const docxBlob = await Packer.toBlob(doc);
  
  return {
    docxBlob,
    detectedType,
    structuredDocument: structuredDoc,
  };
};
