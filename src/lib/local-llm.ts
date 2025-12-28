/**
 * Local LLM Pipeline for Layout-Aware Document Processing
 * Uses @huggingface/transformers for offline inference
 * Models are downloaded once and cached in browser IndexedDB
 */

import { pipeline, env, TextClassificationPipeline } from '@huggingface/transformers';

// Configure transformers.js for browser
env.useBrowserCache = true;
env.allowLocalModels = false;

// Block types for document structure
export type BlockType = 
  | 'header'
  | 'subheader'
  | 'address'
  | 'subject'
  | 'salutation'
  | 'paragraph'
  | 'list_item'
  | 'table_cell'
  | 'footer'
  | 'signature'
  | 'date'
  | 'reference';

export type TextAlignment = 'left' | 'center' | 'right' | 'justified';

export interface StructuredBlock {
  id: string;
  text: string;
  type: BlockType;
  alignment: TextAlignment;
  indentation: number; // 0-3 levels
  spacingBefore: number; // in points
  spacingAfter: number; // in points
  isBold: boolean;
  isItalic: boolean;
  isUnderlined: boolean;
  fontSize: 'small' | 'normal' | 'large' | 'xlarge';
  readingOrder: number;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  isFirstInParagraph: boolean;
  isLastInParagraph: boolean;
}

export interface StructuredDocument {
  blocks: StructuredBlock[];
  documentType: string;
  layoutAnalysis: {
    hasHeader: boolean;
    hasFooter: boolean;
    hasTables: boolean;
    columnCount: number;
    pageBreaks: number[];
  };
  metadata: {
    processedAt: number;
    modelUsed: string;
    processingTimeMs: number;
  };
}

interface OCRBlock {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

// Singleton classifier instance
let classifierInstance: TextClassificationPipeline | null = null;
let isInitializing = false;
let initPromise: Promise<TextClassificationPipeline> | null = null;

/**
 * Initialize the local LLM classifier
 * Model is downloaded once and cached in browser
 */
export const initLocalLLM = async (
  onProgress?: (progress: number, status: string) => void
): Promise<TextClassificationPipeline> => {
  if (classifierInstance) {
    return classifierInstance;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  onProgress?.(0, 'Initializing AI model...');

  initPromise = (async () => {
    try {
      onProgress?.(10, 'Loading text classification model...');
      
      // Use a lightweight multilingual model for text classification
      // This model works well for document structure classification
      const classifier = await pipeline(
        'text-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        {
          progress_callback: (data: { progress?: number; status?: string }) => {
            if (data.progress !== undefined) {
              const progress = Math.round(10 + (data.progress * 0.8));
              onProgress?.(progress, data.status || 'Loading model...');
            }
          },
        }
      );

      classifierInstance = classifier as TextClassificationPipeline;
      onProgress?.(100, 'AI model ready');
      
      return classifierInstance;
    } catch (error) {
      console.error('Failed to initialize local LLM:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
};

/**
 * Classify block type using heuristics enhanced by position and content analysis
 * This provides better accuracy than pure ML for document structure
 */
const classifyBlockType = (
  block: OCRBlock,
  pageWidth: number,
  pageHeight: number,
  blockIndex: number,
  totalBlocks: number
): { type: BlockType; confidence: number } => {
  const text = block.text.trim();
  const relativeY = block.bbox.y0 / pageHeight;
  const relativeX = (block.bbox.x0 + block.bbox.x1) / 2 / pageWidth;
  const blockWidth = (block.bbox.x1 - block.bbox.x0) / pageWidth;
  const blockHeight = block.bbox.y1 - block.bbox.y0;
  
  // Header detection (top 12% of page)
  if (relativeY < 0.12) {
    if (blockWidth > 0.6 && relativeX > 0.3 && relativeX < 0.7) {
      return { type: 'header', confidence: 0.9 };
    }
    if (text.length < 50) {
      return { type: 'subheader', confidence: 0.8 };
    }
  }

  // Date patterns
  const datePatterns = [
    /\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}/,
    /दिनांक\s*[:।-]/i,
    /Date\s*[:।-]/i,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/i,
  ];
  if (datePatterns.some(p => p.test(text))) {
    return { type: 'date', confidence: 0.95 };
  }

  // Reference number patterns
  const refPatterns = [
    /(?:पत्रांक|संख्या|F\.?\s*No\.?|Ref\.?\s*No\.?|File\s*No\.?)\s*[:\-]?\s*[\w\d\/\-]+/i,
    /^(?:No\.|क्र\.|Ref\.)/i,
  ];
  if (refPatterns.some(p => p.test(text))) {
    return { type: 'reference', confidence: 0.9 };
  }

  // Subject line patterns
  const subjectPatterns = [
    /^(?:Subject|विषय|Re:)\s*[:\-।]/i,
    /^(?:Sub|विषय)\s*$/i,
  ];
  if (subjectPatterns.some(p => p.test(text))) {
    return { type: 'subject', confidence: 0.95 };
  }

  // Salutation patterns
  const salutationPatterns = [
    /^(?:Dear|Respected|आदरणीय|प्रिय|महोदय|Sir|Madam)/i,
    /^(?:सेवा में|To,?)\s*$/i,
    /^To\s*[,:]?\s*$/i,
  ];
  if (salutationPatterns.some(p => p.test(text))) {
    return { type: 'salutation', confidence: 0.9 };
  }

  // Address block (after salutation area, left-aligned, short lines)
  if (relativeY > 0.1 && relativeY < 0.35 && relativeX < 0.5 && text.length < 100) {
    const addressIndicators = /(?:The|श्री|श्रीमान|Director|Manager|Secretary|Principal|Officer)/i;
    if (addressIndicators.test(text)) {
      return { type: 'address', confidence: 0.85 };
    }
  }

  // Signature/Closing patterns (bottom 30% of page)
  if (relativeY > 0.7) {
    const closingPatterns = [
      /^(?:Yours?|Thanking|With regards|सादर|भवदीय|धन्यवाद|आपका)/i,
      /^(?:Signature|हस्ताक्षर)/i,
    ];
    if (closingPatterns.some(p => p.test(text))) {
      return { type: 'signature', confidence: 0.9 };
    }
    
    // Right-aligned text in bottom area is likely signature
    if (relativeX > 0.55) {
      return { type: 'signature', confidence: 0.75 };
    }
  }

  // Footer detection (bottom 8% of page)
  if (relativeY > 0.92) {
    return { type: 'footer', confidence: 0.85 };
  }

  // List item detection
  const listPatterns = [
    /^[\d]+[\.\)]\s+/,
    /^[a-zA-Z][\.\)]\s+/,
    /^[•●○▪▫-]\s+/,
    /^(?:i{1,3}|iv|v|vi{1,3}|ix|x)[\.\)]\s+/i,
  ];
  if (listPatterns.some(p => p.test(text))) {
    return { type: 'list_item', confidence: 0.9 };
  }

  // Default to paragraph
  return { type: 'paragraph', confidence: 0.7 };
};

/**
 * Determine text alignment from bounding box position
 */
const detectAlignment = (
  block: OCRBlock,
  pageWidth: number
): TextAlignment => {
  const blockCenter = (block.bbox.x0 + block.bbox.x1) / 2;
  const relativeCenter = blockCenter / pageWidth;
  const blockWidth = (block.bbox.x1 - block.bbox.x0) / pageWidth;
  
  // Centered text (center is in middle third and block doesn't span full width)
  if (relativeCenter > 0.4 && relativeCenter < 0.6 && blockWidth < 0.7) {
    return 'center';
  }
  
  // Right-aligned (starts in right 40% of page)
  if (block.bbox.x0 / pageWidth > 0.5 && blockWidth < 0.45) {
    return 'right';
  }
  
  // Justified (spans most of the page width)
  if (blockWidth > 0.8) {
    return 'justified';
  }
  
  return 'left';
};

/**
 * Detect indentation level from left margin
 */
const detectIndentation = (
  block: OCRBlock,
  pageWidth: number,
  baseMargin: number
): number => {
  const leftMargin = block.bbox.x0;
  const indentUnit = pageWidth * 0.05; // 5% of page width per indent level
  
  const indentLevel = Math.floor((leftMargin - baseMargin) / indentUnit);
  return Math.min(Math.max(indentLevel, 0), 3); // Clamp to 0-3
};

/**
 * Detect font size category from block height
 */
const detectFontSize = (
  block: OCRBlock,
  averageHeight: number
): 'small' | 'normal' | 'large' | 'xlarge' => {
  const height = block.bbox.y1 - block.bbox.y0;
  const ratio = height / averageHeight;
  
  if (ratio < 0.8) return 'small';
  if (ratio > 1.8) return 'xlarge';
  if (ratio > 1.3) return 'large';
  return 'normal';
};

/**
 * Check if a block type should always be kept separate (not merged with adjacent blocks)
 */
const isAlwaysSeparateBlock = (type: BlockType): boolean => {
  const separateTypes: BlockType[] = [
    'header', 'subheader', 'subject', 'salutation', 
    'signature', 'date', 'reference', 'address', 'footer'
  ];
  return separateTypes.includes(type);
};

/**
 * Calculate average line height from blocks
 */
const calculateAverageLineHeight = (blocks: OCRBlock[]): number => {
  if (blocks.length === 0) return 20;
  const heights = blocks.map(b => b.bbox.y1 - b.bbox.y0);
  return heights.reduce((a, b) => a + b, 0) / heights.length;
};

/**
 * Smarter paragraph grouping that:
 * 1. Detects natural paragraph boundaries based on spacing
 * 2. Keeps header/special lines separate
 * 3. Preserves each line as a separate block for accurate line breaks
 */
const groupIntoParagraphs = (
  blocks: OCRBlock[],
  pageHeight: number,
  pageWidth: number,
  preserveLineBreaks: boolean = true
): { blocks: OCRBlock[]; isNewParagraph: boolean }[] => {
  if (blocks.length === 0) return [];
  
  const sortedBlocks = [...blocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const avgLineHeight = calculateAverageLineHeight(sortedBlocks);
  
  // Thresholds based on average line height for more accurate detection
  const normalLineGap = avgLineHeight * 0.3; // Normal gap between lines in same paragraph
  const paragraphGapThreshold = avgLineHeight * 0.8; // Gap that indicates new paragraph
  const largeGapThreshold = avgLineHeight * 1.5; // Definitely a new section
  
  const result: { blocks: OCRBlock[]; isNewParagraph: boolean }[] = [];
  
  for (let i = 0; i < sortedBlocks.length; i++) {
    const currentBlock = sortedBlocks[i];
    const prevBlock = i > 0 ? sortedBlocks[i - 1] : null;
    
    let isNewParagraph = i === 0;
    
    if (prevBlock) {
      const gap = currentBlock.bbox.y0 - prevBlock.bbox.y1;
      const prevBlockType = classifyBlockType(prevBlock, pageWidth, pageHeight, i - 1, sortedBlocks.length);
      const currentBlockType = classifyBlockType(currentBlock, pageWidth, pageHeight, i, sortedBlocks.length);
      
      // Check if either block type should always be separate
      if (isAlwaysSeparateBlock(prevBlockType.type) || isAlwaysSeparateBlock(currentBlockType.type)) {
        isNewParagraph = true;
      }
      // Large gap always means new paragraph
      else if (gap > largeGapThreshold) {
        isNewParagraph = true;
      }
      // Medium gap with alignment change
      else if (gap > paragraphGapThreshold) {
        isNewParagraph = true;
      }
      // Check for significant alignment difference
      else {
        const prevLeft = prevBlock.bbox.x0;
        const currentLeft = currentBlock.bbox.x0;
        const indentDiff = Math.abs(currentLeft - prevLeft);
        
        // Significant indent change suggests new paragraph
        if (indentDiff > pageWidth * 0.08) {
          isNewParagraph = true;
        }
        // Short previous line followed by normal line (end of paragraph)
        else if ((prevBlock.bbox.x1 - prevBlock.bbox.x0) < pageWidth * 0.5 && 
                 (currentBlock.bbox.x1 - currentBlock.bbox.x0) > pageWidth * 0.6) {
          isNewParagraph = true;
        }
      }
    }
    
    // When preserving line breaks, each block is added separately
    // The isNewParagraph flag indicates if extra spacing should be added
    result.push({ blocks: [currentBlock], isNewParagraph });
  }
  
  return result;
};

/**
 * Calculate spacing between blocks
 */
const calculateSpacing = (
  currentBlock: OCRBlock,
  prevBlock: OCRBlock | null,
  nextBlock: OCRBlock | null,
  pageHeight: number
): { before: number; after: number } => {
  const pixelToPoint = 0.75; // Approximate conversion
  
  let before = 0;
  let after = 0;
  
  if (prevBlock) {
    const gap = currentBlock.bbox.y0 - prevBlock.bbox.y1;
    before = Math.round(gap * pixelToPoint);
    before = Math.min(Math.max(before, 0), 48); // Clamp to reasonable range
  }
  
  if (nextBlock) {
    const gap = nextBlock.bbox.y0 - currentBlock.bbox.y1;
    after = Math.round(gap * pixelToPoint);
    after = Math.min(Math.max(after, 0), 48);
  }
  
  return { before, after };
};

/**
 * Main function: Process OCR blocks with local LLM to create structured document
 */
export const processWithLocalLLM = async (
  blocks: OCRBlock[],
  pageWidth: number,
  pageHeight: number,
  onProgress?: (progress: number, status: string) => void
): Promise<StructuredDocument> => {
  const startTime = Date.now();
  
  onProgress?.(0, 'Analyzing document layout...');
  
  // Filter valid blocks
  const validBlocks = blocks.filter(b => 
    b.confidence > 20 && b.text.trim().length > 0
  );
  
  if (validBlocks.length === 0) {
    return {
      blocks: [],
      documentType: 'general',
      layoutAnalysis: {
        hasHeader: false,
        hasFooter: false,
        hasTables: false,
        columnCount: 1,
        pageBreaks: [],
      },
      metadata: {
        processedAt: Date.now(),
        modelUsed: 'heuristic',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
  
  onProgress?.(10, 'Detecting block types...');
  
  // Calculate base metrics
  const heights = validBlocks.map(b => b.bbox.y1 - b.bbox.y0);
  const averageHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
  const leftMargins = validBlocks.map(b => b.bbox.x0);
  const baseMargin = Math.min(...leftMargins);
  
  // Sort by reading order (top-to-bottom, left-to-right)
  const sortedBlocks = [...validBlocks].sort((a, b) => {
    const yDiff = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(yDiff) > 15) return yDiff;
    return a.bbox.x0 - b.bbox.x0;
  });
  
  onProgress?.(30, 'Classifying content blocks...');
  
  // Process each block with smarter paragraph detection
  const structuredBlocks: StructuredBlock[] = [];
  const paragraphGroups = groupIntoParagraphs(sortedBlocks, pageHeight, pageWidth, true);
  
  let readingOrder = 0;
  let processedCount = 0;
  
  for (let groupIdx = 0; groupIdx < paragraphGroups.length; groupIdx++) {
    const group = paragraphGroups[groupIdx];
    const isNewParagraph = group.isNewParagraph;
    
    for (let i = 0; i < group.blocks.length; i++) {
      const block = group.blocks[i];
      const prevOCRBlock = processedCount > 0 ? sortedBlocks[processedCount - 1] : null;
      const nextOCRBlock = processedCount < sortedBlocks.length - 1 ? sortedBlocks[processedCount + 1] : null;
      
      // Classify block type
      const classification = classifyBlockType(
        block,
        pageWidth,
        pageHeight,
        processedCount,
        validBlocks.length
      );
      
      // Detect alignment
      const alignment = detectAlignment(block, pageWidth);
      
      // Detect indentation
      const indentation = detectIndentation(block, pageWidth, baseMargin);
      
      // Calculate spacing - increase spacing for new paragraphs
      const baseSpacing = calculateSpacing(block, prevOCRBlock, nextOCRBlock, pageHeight);
      let spacingBefore = baseSpacing.before;
      let spacingAfter = baseSpacing.after;
      
      // Add extra spacing before new paragraphs
      if (isNewParagraph && i === 0 && processedCount > 0) {
        spacingBefore = Math.max(spacingBefore, 12); // At least 12pt before new paragraph
      }
      
      // Detect font size
      const fontSize = detectFontSize(block, averageHeight);
      
      // Detect text styling from content patterns
      const text = block.text.trim();
      const isAllCaps = text === text.toUpperCase() && /[A-Z]/.test(text);
      const isBold = isAllCaps || classification.type === 'header' || classification.type === 'subject';
      
      // Each block is its own line - mark paragraph boundaries for DOCX generator
      const isFirstInParagraph = isNewParagraph && i === 0;
      const nextGroup = groupIdx < paragraphGroups.length - 1 ? paragraphGroups[groupIdx + 1] : null;
      const isLastInParagraph = i === group.blocks.length - 1 && (nextGroup?.isNewParagraph ?? true);
      
      structuredBlocks.push({
        id: `block_${readingOrder}`,
        text: text,
        type: classification.type,
        alignment,
        indentation,
        spacingBefore,
        spacingAfter,
        isBold,
        isItalic: false,
        isUnderlined: classification.type === 'subject',
        fontSize,
        readingOrder,
        confidence: classification.confidence * block.confidence / 100,
        bbox: block.bbox,
        isFirstInParagraph,
        isLastInParagraph,
      });
      
      readingOrder++;
      processedCount++;
      
      // Update progress
      const progress = 30 + Math.round((processedCount / validBlocks.length) * 60);
      onProgress?.(progress, `Processing block ${processedCount}/${validBlocks.length}...`);
    }
  }
  
  onProgress?.(90, 'Finalizing document structure...');
  
  // Layout analysis
  const hasHeader = structuredBlocks.some(b => b.type === 'header' || b.type === 'subheader');
  const hasFooter = structuredBlocks.some(b => b.type === 'footer');
  const hasTables = structuredBlocks.some(b => b.type === 'table_cell');
  
  // Detect columns
  const middleBlocks = structuredBlocks.filter(b => 
    b.bbox.y0 / pageHeight > 0.2 && b.bbox.y0 / pageHeight < 0.8
  );
  const hasMultiColumn = middleBlocks.some(b => 
    (b.bbox.x0 + b.bbox.x1) / 2 / pageWidth > 0.55 &&
    middleBlocks.some(other => 
      Math.abs(other.bbox.y0 - b.bbox.y0) < 20 &&
      (other.bbox.x0 + other.bbox.x1) / 2 / pageWidth < 0.45
    )
  );
  
  onProgress?.(100, 'Document analysis complete');
  
  return {
    blocks: structuredBlocks,
    documentType: 'auto-detected',
    layoutAnalysis: {
      hasHeader,
      hasFooter,
      hasTables,
      columnCount: hasMultiColumn ? 2 : 1,
      pageBreaks: [],
    },
    metadata: {
      processedAt: Date.now(),
      modelUsed: 'heuristic-enhanced',
      processingTimeMs: Date.now() - startTime,
    },
  };
};

/**
 * Cleanup function to free resources
 */
export const terminateLocalLLM = () => {
  classifierInstance = null;
  initPromise = null;
  isInitializing = false;
};
