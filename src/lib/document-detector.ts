/**
 * Document Type Detection System
 * Uses rule-based heuristics to identify document types from OCR content
 */

export type DocumentType = 'government_letter' | 'office_letter' | 'legal_notice' | 'application' | 'general';

export interface DetectionResult {
  type: DocumentType;
  confidence: number; // 0-100
  detectedFeatures: string[];
}

interface OCRBlock {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

// Keywords and patterns for each document type
const GOVERNMENT_KEYWORDS = [
  'सरकार', 'Government', 'भारत सरकार', 'राज्य सरकार', 'मंत्रालय', 'Ministry',
  'विभाग', 'Department', 'कार्यालय', 'Office', 'सचिव', 'Secretary',
  'निदेशालय', 'Directorate', 'आयोग', 'Commission', 'प्राधिकरण', 'Authority',
  'जिला', 'District', 'तहसील', 'Block', 'पंचायत', 'नगर निगम', 'नगर पालिका',
  'राजपत्र', 'Gazette', 'अधिसूचना', 'Notification', 'परिपत्र', 'Circular',
  'शासनादेश', 'ज्ञापन', 'Memorandum', 'कार्यालय ज्ञापन', 'O.M.',
  'पत्रांक', 'संख्या', 'File No.', 'F.No.', 'Ref. No.',
];

const GOVERNMENT_PATTERNS = [
  /(?:पत्रांक|संख्या|F\.?\s*No\.?|Ref\.?\s*No\.?)\s*[:\-]?\s*[\w\d\/\-]+/i,
  /(?:दिनांक|Date)\s*[:\-]?\s*\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}/i,
  /सेवा में|To,?\s*The/i,
  /भवदीय|Yours? (?:faithfully|sincerely|truly)/i,
];

const OFFICE_KEYWORDS = [
  'Company', 'कंपनी', 'Limited', 'Ltd', 'Pvt', 'Private', 'Corporation',
  'प्राइवेट', 'लिमिटेड', 'Industries', 'उद्योग', 'Solutions', 'Services',
  'Technologies', 'Enterprises', 'Group', 'Holdings', 'Inc.',
  'Director', 'निदेशक', 'Manager', 'प्रबंधक', 'CEO', 'MD', 'Chairman',
  'HR', 'Human Resources', 'मानव संसाधन', 'Admin', 'प्रशासन',
  'Memo', 'Circular', 'Notice', 'सूचना', 'Subject', 'विषय',
  'Ref', 'Reference', 'संदर्भ', 'With reference to', 'के संदर्भ में',
];

const OFFICE_PATTERNS = [
  /(?:Subject|विषय)\s*[:\-]/i,
  /(?:Ref|Reference|संदर्भ)\s*[:\-]/i,
  /(?:To|प्रति)\s*[:\-]?\s*(?:All|सभी)/i,
  /Dear\s+(?:Sir|Madam|Team)/i,
  /प्रिय\s+(?:महोदय|सर|टीम)/i,
];

const LEGAL_KEYWORDS = [
  'Advocate', 'अधिवक्ता', 'वकील', 'Attorney', 'Counsel', 'Legal',
  'Notice', 'नोटिस', 'कानूनी', 'Court', 'न्यायालय', 'अदालत',
  'Tribunal', 'अधिकरण', 'Plaintiff', 'वादी', 'Defendant', 'प्रतिवादी',
  'Petitioner', 'याचिकाकर्ता', 'Respondent', 'प्रत्यर्थी',
  'Section', 'धारा', 'Act', 'अधिनियम', 'IPC', 'CrPC', 'CPC',
  'Under Section', 'धारा के तहत', 'Hereby', 'इसके द्वारा',
  'Affidavit', 'शपथ पत्र', 'Vakalatnama', 'वकालतनामा',
  'Without Prejudice', 'बिना पूर्वाग्रह', 'Legal Notice',
  'Cease and Desist', 'Reply', 'उत्तर', 'Rejoinder',
];

const LEGAL_PATTERNS = [
  /(?:Under|u\/s)\s*(?:Section|Sec\.?|धारा)\s*\d+/i,
  /(?:IPC|CrPC|CPC|भादस|दंप्रस)/i,
  /(?:High Court|Supreme Court|District Court)/i,
  /(?:उच्च न्यायालय|सर्वोच्च न्यायालय|जिला न्यायालय)/i,
  /(?:Advocate|अधिवक्ता|वकील)\s*[:\-]?\s*\w+/i,
  /(?:Bar Council|बार काउंसिल)/i,
];

const APPLICATION_KEYWORDS = [
  'Application', 'आवेदन', 'प्रार्थना', 'Request', 'अनुरोध',
  'Respected', 'आदरणीय', 'महोदय', 'Sir', 'Madam',
  'Applicant', 'आवेदक', 'Undersigned', 'अधोहस्ताक्षरी',
  'Leave', 'छुट्टी', 'अवकाश', 'Permission', 'अनुमति',
  'Request for', 'के लिए प्रार्थना', 'Kindly', 'कृपया',
  'I beg to', 'निवेदन है कि', 'This is to request',
  'May I request', 'I hereby apply', 'आवेदन करता/करती हूँ',
  'Humbly', 'विनम्रता से', 'Obediently', 'आज्ञाकारी',
  'Your obedient', 'आपका आज्ञाकारी', 'Thanking you',
];

const APPLICATION_PATTERNS = [
  /(?:To|प्रति|सेवा में),?\s*\n?\s*(?:The|श्री|श्रीमान)/i,
  /(?:Subject|विषय)\s*[:\-]\s*(?:Application|Request|Leave|आवेदन|अनुरोध|अवकाश)/i,
  /(?:Respected|आदरणीय|महोदय)\s+(?:Sir|Madam|महोदय|महोदया)/i,
  /(?:I|मैं)\s+(?:beg|request|apply|प्रार्थना|निवेदन|आवेदन)/i,
  /(?:Thanking you|धन्यवाद)/i,
  /(?:Your (?:obedient|humble)|आपका आज्ञाकारी)/i,
];

// Calculate match score for a set of keywords and patterns
const calculateScore = (
  text: string,
  keywords: string[],
  patterns: RegExp[]
): { score: number; features: string[] } => {
  const features: string[] = [];
  let score = 0;
  const lowerText = text.toLowerCase();

  // Check keywords
  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 5;
      features.push(`keyword: ${keyword}`);
    }
  }

  // Check patterns (weighted higher)
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      score += 15;
      features.push(`pattern: ${pattern.source.substring(0, 30)}...`);
    }
  }

  return { score, features };
};

// Analyze layout characteristics
const analyzeLayout = (
  blocks: OCRBlock[],
  pageWidth: number,
  pageHeight: number
): { score: number; features: string[]; layoutType: string } => {
  const features: string[] = [];
  let layoutType = 'standard';

  if (blocks.length === 0) {
    return { score: 0, features: [], layoutType };
  }

  // Check for header region (top 15% with content)
  const headerBlocks = blocks.filter(b => b.bbox.y0 < pageHeight * 0.15);
  if (headerBlocks.length > 0) {
    features.push('has_header_region');
  }

  // Check for dual-column header
  const headerLeft = headerBlocks.filter(b => b.bbox.x0 < pageWidth * 0.4);
  const headerRight = headerBlocks.filter(b => b.bbox.x0 > pageWidth * 0.6);
  if (headerLeft.length > 0 && headerRight.length > 0) {
    features.push('dual_column_header');
    layoutType = 'formal';
  }

  // Check for centered title
  const centeredBlocks = blocks.filter(b => {
    const center = (b.bbox.x0 + b.bbox.x1) / 2;
    return center > pageWidth * 0.35 && center < pageWidth * 0.65 && b.bbox.y0 < pageHeight * 0.25;
  });
  if (centeredBlocks.length > 0) {
    features.push('centered_title');
  }

  // Check for right-aligned signature block
  const bottomBlocks = blocks.filter(b => b.bbox.y0 > pageHeight * 0.7);
  const rightSignature = bottomBlocks.filter(b => b.bbox.x0 > pageWidth * 0.5);
  if (rightSignature.length > 0) {
    features.push('right_signature_block');
  }

  // Check for indented paragraphs
  const bodyBlocks = blocks.filter(b => b.bbox.y0 > pageHeight * 0.2 && b.bbox.y0 < pageHeight * 0.7);
  const indentedBlocks = bodyBlocks.filter(b => b.bbox.x0 > pageWidth * 0.05 && b.bbox.x0 < pageWidth * 0.15);
  if (indentedBlocks.length > 0) {
    features.push('indented_paragraphs');
  }

  const score = features.length * 10;
  return { score, features, layoutType };
};

/**
 * Detect document type from OCR blocks and content
 */
export const detectDocumentType = (
  blocks: OCRBlock[],
  pageWidth: number,
  pageHeight: number
): DetectionResult => {
  // Combine all text for keyword matching
  const fullText = blocks.map(b => b.text).join('\n');

  // Calculate scores for each document type
  const govScore = calculateScore(fullText, GOVERNMENT_KEYWORDS, GOVERNMENT_PATTERNS);
  const officeScore = calculateScore(fullText, OFFICE_KEYWORDS, OFFICE_PATTERNS);
  const legalScore = calculateScore(fullText, LEGAL_KEYWORDS, LEGAL_PATTERNS);
  const appScore = calculateScore(fullText, APPLICATION_KEYWORDS, APPLICATION_PATTERNS);

  // Analyze layout
  const layoutAnalysis = analyzeLayout(blocks, pageWidth, pageHeight);

  // Combine scores with layout analysis
  const scores: { type: DocumentType; score: number; features: string[] }[] = [
    { 
      type: 'government_letter', 
      score: govScore.score + (layoutAnalysis.layoutType === 'formal' ? 20 : 0),
      features: [...govScore.features, ...layoutAnalysis.features]
    },
    { 
      type: 'office_letter', 
      score: officeScore.score + (layoutAnalysis.features.includes('dual_column_header') ? 10 : 0),
      features: [...officeScore.features, ...layoutAnalysis.features]
    },
    { 
      type: 'legal_notice', 
      score: legalScore.score,
      features: [...legalScore.features, ...layoutAnalysis.features]
    },
    { 
      type: 'application', 
      score: appScore.score + (layoutAnalysis.features.includes('indented_paragraphs') ? 10 : 0),
      features: [...appScore.features, ...layoutAnalysis.features]
    },
  ];

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const topMatch = scores[0];
  const maxPossibleScore = 150; // Approximate max score

  // If no significant matches, return general
  if (topMatch.score < 20) {
    return {
      type: 'general',
      confidence: 50,
      detectedFeatures: layoutAnalysis.features,
    };
  }

  // Calculate confidence (capped at 95)
  const confidence = Math.min(95, Math.round((topMatch.score / maxPossibleScore) * 100) + 40);

  return {
    type: topMatch.type,
    confidence,
    detectedFeatures: [...new Set(topMatch.features)],
  };
};

/**
 * Get human-readable document type label
 */
export const getDocumentTypeLabel = (type: DocumentType): string => {
  const labels: Record<DocumentType, string> = {
    government_letter: 'Government Letter',
    office_letter: 'Office/Corporate Letter',
    legal_notice: 'Legal Notice',
    application: 'Application/Request',
    general: 'General Document',
  };
  return labels[type];
};

/**
 * Get Hindi label for document type
 */
export const getDocumentTypeLabelHindi = (type: DocumentType): string => {
  const labels: Record<DocumentType, string> = {
    government_letter: 'सरकारी पत्र',
    office_letter: 'कार्यालय पत्र',
    legal_notice: 'कानूनी नोटिस',
    application: 'आवेदन पत्र',
    general: 'सामान्य दस्तावेज़',
  };
  return labels[type];
};
