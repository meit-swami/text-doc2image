import * as XLSX from 'xlsx';

interface TableData {
  rows: string[][];
  sheetName?: string;
}

export const createExcelFromTables = (
  tables: TableData[],
  fileName: string = 'spreadsheet'
): Blob => {
  const workbook = XLSX.utils.book_new();
  
  tables.forEach((table, index) => {
    const sheetName = table.sheetName || `Sheet${index + 1}`;
    const worksheet = XLSX.utils.aoa_to_sheet(table.rows);
    
    // Auto-size columns
    const colWidths = table.rows[0]?.map((_, colIndex) => {
      const maxWidth = Math.max(
        ...table.rows.map(row => (row[colIndex]?.length || 0))
      );
      return { wch: Math.min(Math.max(maxWidth, 10), 50) };
    }) || [];
    
    worksheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const createExcelFromText = (
  text: string,
  fileName: string = 'spreadsheet'
): Blob => {
  const lines = text.split('\n').filter(line => line.trim());
  
  // Try to detect delimiter (tab, comma, pipe)
  const detectDelimiter = (line: string): string => {
    const delimiters = ['\t', ',', '|', ';'];
    let maxCount = 0;
    let bestDelimiter = '\t';
    
    delimiters.forEach(delimiter => {
      const count = line.split(delimiter).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    });
    
    return bestDelimiter;
  };
  
  const delimiter = lines.length > 0 ? detectDelimiter(lines[0]) : '\t';
  
  const rows = lines.map(line => 
    line.split(delimiter).map(cell => cell.trim())
  );
  
  return createExcelFromTables([{ rows }], fileName);
};

export const parseOCRToTable = (
  text: string,
  blocks?: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    confidence: number;
  }>
): string[][] => {
  if (blocks && blocks.length > 0) {
    // Group blocks by y-position to form rows
    const tolerance = 15;
    const rows: Map<number, Array<{ text: string; x: number }>> = new Map();
    
    blocks.forEach(block => {
      const y = Math.round(block.bbox.y0 / tolerance) * tolerance;
      
      if (!rows.has(y)) {
        rows.set(y, []);
      }
      rows.get(y)!.push({ text: block.text.trim(), x: block.bbox.x0 });
    });
    
    // Sort rows by y-position and items within rows by x-position
    const sortedRows = Array.from(rows.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, items]) => 
        items.sort((a, b) => a.x - b.x).map(item => item.text)
      );
    
    return sortedRows;
  }
  
  // Fallback: parse text by lines
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => {
    // Try common delimiters
    if (line.includes('\t')) return line.split('\t').map(s => s.trim());
    if (line.includes('|')) return line.split('|').map(s => s.trim());
    if (line.includes(',')) return line.split(',').map(s => s.trim());
    
    // Split by multiple spaces
    return line.split(/\s{2,}/).map(s => s.trim());
  });
};
