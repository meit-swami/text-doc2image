/**
 * Document Templates System
 * Pre-defined smart templates for different document types
 */

import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TabStopType,
  TabStopPosition,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  IStylesOptions,
  convertInchesToTwip,
} from 'docx';
import { DocumentType } from './document-detector';

interface OCRBlock {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

interface LayoutRegion {
  header: OCRBlock[];
  addressBlock: OCRBlock[];
  subjectLine: OCRBlock[];
  salutation: OCRBlock[];
  body: OCRBlock[];
  closing: OCRBlock[];
  signature: OCRBlock[];
}

// Document-specific styles
export const getDocumentStyles = (type: DocumentType): IStylesOptions => {
  const baseStyles: IStylesOptions = {
    paragraphStyles: [
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
        id: 'SubHeader',
        name: 'SubHeader',
        basedOn: 'Normal',
        run: { size: 22 },
        paragraph: { spacing: { after: 60 } },
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
        paragraph: { 
          spacing: { after: 120, line: 276 },
          indent: { firstLine: 720 },
        },
      },
      {
        id: 'Salutation',
        name: 'Salutation',
        basedOn: 'Normal',
        run: { size: 24 },
        paragraph: { spacing: { before: 240, after: 120 } },
      },
      {
        id: 'Closing',
        name: 'Closing',
        basedOn: 'Normal',
        run: { size: 24 },
        paragraph: { spacing: { before: 360, after: 60 } },
      },
      {
        id: 'Signature',
        name: 'Signature',
        basedOn: 'Normal',
        run: { size: 24 },
        paragraph: { spacing: { after: 60 }, alignment: AlignmentType.RIGHT },
      },
    ],
  };

  // Customize based on document type
  switch (type) {
    case 'government_letter':
      return {
        ...baseStyles,
        paragraphStyles: [
          ...(baseStyles.paragraphStyles || []),
          {
            id: 'GovHeader',
            name: 'Government Header',
            run: { size: 32, bold: true, font: 'Times New Roman' },
            paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 100 } },
          },
          {
            id: 'RefNumber',
            name: 'Reference Number',
            run: { size: 22 },
            paragraph: { spacing: { after: 60 } },
          },
        ],
      };

    case 'legal_notice':
      return {
        ...baseStyles,
        paragraphStyles: [
          ...(baseStyles.paragraphStyles || []),
          {
            id: 'LegalHeader',
            name: 'Legal Header',
            run: { size: 28, bold: true, allCaps: true },
            paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 200 } },
          },
          {
            id: 'LegalBody',
            name: 'Legal Body',
            run: { size: 24 },
            paragraph: { 
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 120, line: 276 },
              indent: { firstLine: 720 },
            },
          },
        ],
      };

    default:
      return baseStyles;
  }
};

// Segment OCR blocks into logical regions based on position
export const segmentDocument = (
  blocks: OCRBlock[],
  pageWidth: number,
  pageHeight: number
): LayoutRegion => {
  const regions: LayoutRegion = {
    header: [],
    addressBlock: [],
    subjectLine: [],
    salutation: [],
    body: [],
    closing: [],
    signature: [],
  };

  // Sort blocks by Y position
  const sortedBlocks = [...blocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);

  // Define region boundaries (percentages of page height)
  const headerEnd = pageHeight * 0.15;
  const addressEnd = pageHeight * 0.30;
  const bodyEnd = pageHeight * 0.75;
  const closingEnd = pageHeight * 0.85;

  for (const block of sortedBlocks) {
    const text = block.text.trim();
    if (!text) continue;

    const y = block.bbox.y0;

    // Detect subject line patterns anywhere in address/body region
    if (y > headerEnd && y < bodyEnd) {
      const isSubject = /^(?:Subject|विषय|Re:|Ref:)\s*[:\-]/i.test(text) ||
        /^(?:विषय|Subject)\s*$/i.test(text);
      if (isSubject) {
        regions.subjectLine.push(block);
        continue;
      }
    }

    // Detect salutation patterns
    const isSalutation = /^(?:Dear|Respected|आदरणीय|प्रिय|महोदय|Sir|Madam|To Whomsoever)/i.test(text) ||
      /^(?:सेवा में|To,?)$/i.test(text);
    if (isSalutation && y < pageHeight * 0.4) {
      regions.salutation.push(block);
      continue;
    }

    // Detect closing patterns
    const isClosing = /^(?:Yours?|Thanking|With regards|सादर|भवदीय|धन्यवाद|आपका)/i.test(text);
    if (isClosing) {
      regions.closing.push(block);
      continue;
    }

    // Segment by position
    if (y < headerEnd) {
      regions.header.push(block);
    } else if (y < addressEnd && regions.body.length === 0) {
      // Address block before body starts
      regions.addressBlock.push(block);
    } else if (y < bodyEnd) {
      regions.body.push(block);
    } else if (y < closingEnd && !isClosing) {
      // Could be part of body or signature area
      const isRightAligned = block.bbox.x0 > pageWidth * 0.5;
      if (isRightAligned) {
        regions.signature.push(block);
      } else {
        regions.body.push(block);
      }
    } else {
      regions.signature.push(block);
    }
  }

  return regions;
};

// Helper to create borderless table cell
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

// Build paragraphs from blocks with alignment preservation
const buildParagraphsFromBlocks = (
  blocks: OCRBlock[],
  pageWidth: number,
  options: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    style?: string;
    bold?: boolean;
    fontSize?: number;
    spacing?: { before?: number; after?: number };
    indent?: { firstLine?: number; left?: number };
  } = {}
): Paragraph[] => {
  const paragraphs: Paragraph[] = [];

  // Group blocks into rows based on Y position
  interface Row {
    blocks: OCRBlock[];
    avgY: number;
  }
  
  const rows: Row[] = [];
  let currentRow: OCRBlock[] = [];
  let lastY = -Infinity;
  const rowThreshold = 15;

  const sortedBlocks = [...blocks].sort((a, b) => {
    const yDiff = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(yDiff) > rowThreshold) return yDiff;
    return a.bbox.x0 - b.bbox.x0;
  });

  for (const block of sortedBlocks) {
    if (currentRow.length === 0 || Math.abs(block.bbox.y0 - lastY) <= rowThreshold) {
      currentRow.push(block);
      lastY = currentRow.reduce((sum, b) => sum + b.bbox.y0, 0) / currentRow.length;
    } else {
      if (currentRow.length > 0) {
        rows.push({ 
          blocks: [...currentRow], 
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

  for (const row of rows) {
    row.blocks.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    
    // Check if row has left and right content (use tabs)
    const leftBlocks = row.blocks.filter(b => b.bbox.x0 < pageWidth * 0.4);
    const rightBlocks = row.blocks.filter(b => (b.bbox.x0 + b.bbox.x1) / 2 > pageWidth * 0.6);

    if (leftBlocks.length > 0 && rightBlocks.length > 0) {
      // Two-column row - use tab stop
      const leftText = leftBlocks.map(b => b.text.trim()).join(' ');
      const rightText = rightBlocks.map(b => b.text.trim()).join(' ');

      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: leftText, size: options.fontSize || 22 }),
          new TextRun({ text: '\t' }),
          new TextRun({ text: rightText, size: options.fontSize || 22 }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: options.spacing || { after: 120 },
      }));
    } else {
      // Single alignment row
      const text = row.blocks.map(b => b.text.trim()).join(' ');
      if (!text) continue;

      // Determine alignment from block positions if not specified
      let alignment = options.alignment || AlignmentType.LEFT;
      if (!options.alignment && row.blocks.length > 0) {
        const firstBlock = row.blocks[0];
        const blockCenter = (firstBlock.bbox.x0 + firstBlock.bbox.x1) / 2;
        
        if (blockCenter > pageWidth * 0.6) {
          alignment = AlignmentType.RIGHT;
        } else if (blockCenter > pageWidth * 0.35 && blockCenter < pageWidth * 0.65) {
          alignment = AlignmentType.CENTER;
        }
      }

      paragraphs.push(new Paragraph({
        children: [
          new TextRun({
            text,
            bold: options.bold,
            size: options.fontSize || 22,
          }),
        ],
        style: options.style,
        alignment,
        spacing: options.spacing || { after: 120 },
        indent: options.indent,
      }));
    }
  }

  return paragraphs;
};

/**
 * Apply Government Letter template
 */
export const applyGovernmentTemplate = (
  regions: LayoutRegion,
  pageWidth: number
): (Paragraph | Table)[] => {
  const children: (Paragraph | Table)[] = [];

  // Header as centered or two-column layout
  if (regions.header.length > 0) {
    const leftHeader = regions.header.filter(b => b.bbox.x0 < pageWidth * 0.4);
    const rightHeader = regions.header.filter(b => (b.bbox.x0 + b.bbox.x1) / 2 > pageWidth * 0.5);
    const centerHeader = regions.header.filter(b => {
      const center = (b.bbox.x0 + b.bbox.x1) / 2;
      return center >= pageWidth * 0.35 && center <= pageWidth * 0.65;
    });

    if (centerHeader.length > 0 && leftHeader.length === 0 && rightHeader.length === 0) {
      // Centered header
      for (const block of centerHeader) {
        children.push(new Paragraph({
          children: [new TextRun({ text: block.text.trim(), bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }));
      }
    } else if (leftHeader.length > 0 || rightHeader.length > 0) {
      // Two-column header table
      const leftParagraphs = leftHeader.map(b => new Paragraph({
        children: [new TextRun({ text: b.text.trim(), size: 20 })],
        spacing: { after: 40 },
      }));
      const rightParagraphs = rightHeader.map(b => new Paragraph({
        children: [new TextRun({ text: b.text.trim(), size: 20 })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
      }));

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createNoBorderCell(leftParagraphs.length > 0 ? leftParagraphs : [new Paragraph({})]),
              createNoBorderCell(rightParagraphs.length > 0 ? rightParagraphs : [new Paragraph({})]),
            ],
          }),
        ],
      }));
    }
    
    // Add spacing after header
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Address block (left-aligned)
  if (regions.addressBlock.length > 0) {
    const addressParagraphs = buildParagraphsFromBlocks(regions.addressBlock, pageWidth, {
      fontSize: 22,
      spacing: { after: 60 },
    });
    children.push(...addressParagraphs);
    children.push(new Paragraph({ spacing: { after: 120 } }));
  }

  // Subject line (bold, underlined)
  if (regions.subjectLine.length > 0) {
    const subjectText = regions.subjectLine.map(b => b.text.trim()).join(' ');
    children.push(new Paragraph({
      children: [new TextRun({ text: subjectText, bold: true, underline: {}, size: 24 })],
      spacing: { before: 120, after: 200 },
    }));
  }

  // Salutation
  if (regions.salutation.length > 0) {
    const salutationText = regions.salutation.map(b => b.text.trim()).join(' ');
    children.push(new Paragraph({
      children: [new TextRun({ text: salutationText, size: 24 })],
      spacing: { before: 120, after: 120 },
    }));
  }

  // Body paragraphs with proper indentation
  if (regions.body.length > 0) {
    const bodyParagraphs = buildParagraphsFromBlocks(regions.body, pageWidth, {
      fontSize: 24,
      spacing: { after: 120 },
      indent: { firstLine: 720 }, // First line indent for paragraphs
    });
    children.push(...bodyParagraphs);
  }

  // Closing
  if (regions.closing.length > 0) {
    children.push(new Paragraph({ spacing: { after: 240 } })); // Extra space before closing
    const closingParagraphs = buildParagraphsFromBlocks(regions.closing, pageWidth, {
      alignment: AlignmentType.RIGHT,
      fontSize: 24,
      spacing: { after: 60 },
    });
    children.push(...closingParagraphs);
  }

  // Signature block (right-aligned)
  if (regions.signature.length > 0) {
    const signatureParagraphs = buildParagraphsFromBlocks(regions.signature, pageWidth, {
      alignment: AlignmentType.RIGHT,
      fontSize: 24,
      spacing: { after: 60 },
    });
    children.push(...signatureParagraphs);
  }

  return children;
};

/**
 * Apply Office Letter template
 */
export const applyOfficeTemplate = (
  regions: LayoutRegion,
  pageWidth: number
): (Paragraph | Table)[] => {
  // Similar to government but with company branding focus
  return applyGovernmentTemplate(regions, pageWidth);
};

/**
 * Apply Legal Notice template
 */
export const applyLegalTemplate = (
  regions: LayoutRegion,
  pageWidth: number
): (Paragraph | Table)[] => {
  const children: (Paragraph | Table)[] = [];

  // Header (Advocate details) - typically centered
  if (regions.header.length > 0) {
    for (const block of regions.header) {
      children.push(new Paragraph({
        children: [new TextRun({ text: block.text.trim(), bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }));
    }
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Address/recipient blocks
  if (regions.addressBlock.length > 0) {
    const addressParagraphs = buildParagraphsFromBlocks(regions.addressBlock, pageWidth, {
      fontSize: 22,
      spacing: { after: 60 },
    });
    children.push(...addressParagraphs);
    children.push(new Paragraph({ spacing: { after: 160 } }));
  }

  // Subject as "LEGAL NOTICE" or similar
  if (regions.subjectLine.length > 0) {
    const subjectText = regions.subjectLine.map(b => b.text.trim()).join(' ');
    children.push(new Paragraph({
      children: [new TextRun({ text: subjectText, bold: true, allCaps: true, size: 26 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
    }));
  }

  // Body with justified text
  if (regions.body.length > 0) {
    const bodyParagraphs = buildParagraphsFromBlocks(regions.body, pageWidth, {
      alignment: AlignmentType.JUSTIFIED,
      fontSize: 24,
      spacing: { after: 160 },
      indent: { firstLine: 720 },
    });
    children.push(...bodyParagraphs);
  }

  // Closing
  if (regions.closing.length > 0) {
    children.push(new Paragraph({ spacing: { after: 240 } }));
    const closingParagraphs = buildParagraphsFromBlocks(regions.closing, pageWidth, {
      alignment: AlignmentType.RIGHT,
      fontSize: 24,
      spacing: { after: 60 },
    });
    children.push(...closingParagraphs);
  }

  // Signature
  if (regions.signature.length > 0) {
    const signatureParagraphs = buildParagraphsFromBlocks(regions.signature, pageWidth, {
      alignment: AlignmentType.RIGHT,
      fontSize: 24,
      spacing: { after: 60 },
    });
    children.push(...signatureParagraphs);
  }

  return children;
};

/**
 * Apply Application template
 */
export const applyApplicationTemplate = (
  regions: LayoutRegion,
  pageWidth: number
): (Paragraph | Table)[] => {
  const children: (Paragraph | Table)[] = [];

  // Header (minimal for applications)
  if (regions.header.length > 0) {
    const headerParagraphs = buildParagraphsFromBlocks(regions.header, pageWidth, {
      fontSize: 22,
      spacing: { after: 60 },
    });
    children.push(...headerParagraphs);
    children.push(new Paragraph({ spacing: { after: 160 } }));
  }

  // "To" block - left aligned
  if (regions.addressBlock.length > 0) {
    const addressParagraphs = buildParagraphsFromBlocks(regions.addressBlock, pageWidth, {
      fontSize: 24,
      spacing: { after: 60 },
    });
    children.push(...addressParagraphs);
    children.push(new Paragraph({ spacing: { after: 120 } }));
  }

  // Subject
  if (regions.subjectLine.length > 0) {
    const subjectText = regions.subjectLine.map(b => b.text.trim()).join(' ');
    children.push(new Paragraph({
      children: [new TextRun({ text: subjectText, bold: true, underline: {}, size: 24 })],
      spacing: { before: 120, after: 200 },
    }));
  }

  // Salutation
  if (regions.salutation.length > 0) {
    const salutationText = regions.salutation.map(b => b.text.trim()).join(' ');
    children.push(new Paragraph({
      children: [new TextRun({ text: salutationText, size: 24 })],
      spacing: { before: 120, after: 160 },
    }));
  }

  // Body with first-line indent
  if (regions.body.length > 0) {
    const bodyParagraphs = buildParagraphsFromBlocks(regions.body, pageWidth, {
      fontSize: 24,
      spacing: { after: 120 },
      indent: { firstLine: 720 },
    });
    children.push(...bodyParagraphs);
  }

  // Closing (right-aligned)
  if (regions.closing.length > 0) {
    children.push(new Paragraph({ spacing: { after: 200 } }));
    const closingParagraphs = buildParagraphsFromBlocks(regions.closing, pageWidth, {
      alignment: AlignmentType.RIGHT,
      fontSize: 24,
      spacing: { after: 60 },
    });
    children.push(...closingParagraphs);
  }

  // Signature
  if (regions.signature.length > 0) {
    const signatureParagraphs = buildParagraphsFromBlocks(regions.signature, pageWidth, {
      alignment: AlignmentType.RIGHT,
      fontSize: 24,
      spacing: { after: 60 },
    });
    children.push(...signatureParagraphs);
  }

  return children;
};

/**
 * Apply template based on document type
 */
export const applyTemplate = (
  type: DocumentType,
  regions: LayoutRegion,
  pageWidth: number
): (Paragraph | Table)[] => {
  switch (type) {
    case 'government_letter':
      return applyGovernmentTemplate(regions, pageWidth);
    case 'office_letter':
      return applyOfficeTemplate(regions, pageWidth);
    case 'legal_notice':
      return applyLegalTemplate(regions, pageWidth);
    case 'application':
      return applyApplicationTemplate(regions, pageWidth);
    default:
      // For general documents, use government template as base
      return applyGovernmentTemplate(regions, pageWidth);
  }
};
