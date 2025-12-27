# AI-Enhanced Document Converter

A powerful document conversion tool with AI-powered formatting and layout preservation.

## Features

### 🔄 Core Conversion Tools
- **Image to DOCX** - Convert scanned documents/images to editable Word documents
- **PDF to DOCX** - Convert PDF files to editable Word documents
- **PDF to Excel** - Extract tabular data from PDFs to spreadsheets

### 🧠 AI-Enhanced Formatting Mode

When "Preserve original formatting (AI enhanced)" is enabled, the system prioritizes visual and structural accuracy over raw text extraction.

---

## 📋 Document Type Detection (Automatic)

After OCR, the system automatically detects document type based on:
- Heading patterns
- Alignment (centered titles, left-aligned body)
- Keywords (Subject, Respected, Notice, Applicant, etc.)
- Spacing and margin patterns

### Supported Document Types:
| Type | Detection Keywords |
|------|-------------------|
| **Government Letter** | government, ministry, department, official, circular, memo |
| **Office/Corporate Letter** | company, corporation, pvt, ltd, office, HR, management |
| **Legal Notice** | advocate, legal, notice, court, plaintiff, defendant, jurisdiction |
| **Application/Request** | application, request, respected sir, dear sir, kindly, thanking you |

If confidence is low, manual override is available.

---

## 📄 Smart Templates (Auto-Applied)

Once document type is detected, a structural template is applied:

### Government Letter Template
- Centered or left-aligned department name
- Reference number & date alignment
- Subject line with proper spacing
- Formal paragraph spacing
- Signature block at bottom

### Office Letter Template
- Company header formatting
- Subject highlighted
- Consistent paragraph spacing
- Signature + designation block

### Legal Notice Template
- Advocate header
- Clear paragraph separation
- Justified body text
- Structured sender/receiver blocks

### Application Template
- Proper salutation
- Short paragraph spacing
- Clearly separated closing & signature

> **Note:** Templates organize and space content correctly without overwriting it.

---

## 📐 Layout Reconstruction Rules

Using OCR layout data (bounding boxes & line positions), the system preserves:

- ✅ Original line breaks
- ✅ Paragraph separation
- ✅ Indentation (left/right margins)
- ✅ Alignment (center / left / justified)
- ✅ Page breaks

**Never merges all text into one paragraph.**

---

## 📏 Auto Spacing & Indentation Rules

Spacing is applied dynamically based on detected document type:

| Element | Spacing Rule |
|---------|-------------|
| Heading | Extra top & bottom spacing |
| Subject line | Spacing before body |
| Paragraphs | Consistent line height |
| Signature block | Pushed toward bottom |
| Address blocks | Left aligned with indentation |

Spacing visually matches the original document as closely as possible.

---

## 🧾 DOCX Output Requirements

Generated DOCX files use:
- **Paragraph styles** (Heading, Body, Signature)
- **Real margins and tabs** (not spaces)
- **Line spacing controls**
- **Page break handling**

Output looks professionally typed, not OCR-dumped.

---

## 🚫 Explicit Restrictions

| ❌ Don't | ✅ Do |
|----------|-------|
| Output plain text | Use structured paragraphs |
| Collapse spacing | Preserve original spacing |
| Ignore indentation | Maintain visual layout |
| Prioritize speed over accuracy | Prioritize formatting accuracy |

---

## 🌐 Multi-Language OCR Support

- English
- Hindi  
- English + Hindi (bilingual documents)

---

## 🛠️ Technology Stack

- **React** + **TypeScript** + **Vite**
- **Tesseract.js** - OCR engine
- **docx** - DOCX generation
- **xlsx** - Excel generation
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components

---

## 📱 PWA Support

Install as a Progressive Web App for offline document conversion.

---

## Usage

1. Upload an image or PDF
2. Select OCR language
3. Enable "Preserve original formatting (AI enhanced)" for best results
4. Click Convert
5. Download your formatted DOCX file

---

## License

MIT
