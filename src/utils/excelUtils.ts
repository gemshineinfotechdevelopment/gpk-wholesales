import * as XLSX from 'xlsx';

export interface ParsedProductRow {
  name: string;
  caseCount: number;
  rate: number;
  pktUnit: string;
  company?: string;
  isValid: boolean;
  error?: string;
}

/**
 * Normalizes header string by lowercasing and stripping non-alphanumeric chars
 */
const normalizeHeader = (header: string): string => {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Parses an Excel (.xlsx, .xls) or CSV file into product rows.
 * Expected columns:
 * - Product Name (or Name, Product, Item)
 * - Case (or Cases, Case Count)
 * - Rate (or Price, Amount)
 * - Pkts/Unit (or Pkt Unit, Unit, Packets)
 */
export const parseProductsExcel = async (file: File): Promise<ParsedProductRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('Excel sheet is empty');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        // Read sheet as JSON array with raw headers
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false,
        });

        if (!rawRows || rawRows.length === 0) {
          resolve([]);
          return;
        }

        // Map each row to ParsedProductRow
        const parsedRows: ParsedProductRow[] = rawRows.map((row) => {
          let name = '';
          let caseCount = 0;
          let rate = 0;
          let pktUnit = '1';
          let company = '';

          for (const [key, val] of Object.entries(row)) {
            const normKey = normalizeHeader(key);
            const strVal = String(val ?? '').trim();

            if (normKey === 'productname' || normKey === 'product' || normKey === 'itemname' || normKey === 'name') {
              name = strVal;
            } else if (normKey === 'case' || normKey === 'cases' || normKey === 'casecount' || normKey === 'boxes') {
              const num = parseFloat(strVal);
              caseCount = isNaN(num) ? 0 : num;
            } else if (normKey === 'rate' || normKey === 'price' || normKey === 'mrp' || normKey === 'amount') {
              const num = parseFloat(strVal.replace(/[^0-9.]/g, ''));
              rate = isNaN(num) ? 0 : num;
            } else if (normKey === 'pktsunit' || normKey === 'pktunit' || normKey === 'unit' || normKey === 'packets' || normKey === 'pkts') {
              pktUnit = strVal || '1';
            } else if (normKey === 'company' || normKey === 'companyname') {
              company = strVal;
            }
          }

          const isValid = name.trim().length > 0;
          return {
            name: name.trim(),
            caseCount,
            rate,
            pktUnit: pktUnit || '1',
            company: company.trim(),
            isValid,
            error: isValid ? undefined : 'Product name missing',
          };
        });

        resolve(parsedRows.filter((r) => r.name.length > 0));
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Downloads a sample Excel file with the expected columns:
 * Product Name, Case, Rate, Pkts/Unit
 */
export const downloadSampleProductsTemplate = (): void => {
  const sampleData = [
    {
      'Product Name': '2 1/2" KURUVI',
      'Case': 10,
      'Rate': 120.00,
      'Pkts/Unit': '1',
    },
    {
      'Product Name': '4" LAKSHMI',
      'Case': 5,
      'Rate': 250.00,
      'Pkts/Unit': '1',
    },
    {
      'Product Name': 'FLOWER POTS SPECIAL',
      'Case': 20,
      'Rate': 350.00,
      'Pkts/Unit': '10',
    },
    {
      'Product Name': 'CHAKKAR SPECIAL',
      'Case': 15,
      'Rate': 180.00,
      'Pkts/Unit': '10',
    },
    {
      'Product Name': '10 CM ELECTRIC SPARKLERS',
      'Case': 30,
      'Rate': 45.00,
      'Pkts/Unit': '1',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 30 }, // Product Name
    { wch: 10 }, // Case
    { wch: 12 }, // Rate
    { wch: 14 }, // Pkts/Unit
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products Template');

  XLSX.writeFile(workbook, 'Product_Upload_Template.xlsx');
};
