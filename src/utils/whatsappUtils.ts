import html2pdf from 'html2pdf.js';
import {
  generateBillHtml,
  generateLedgerStatementHtml,
  generateParticularsListPrintHtml,
  generatePerformaHtml,
  generateAllPerformasPrintHtml,
  generateCustomerListPrintHtml,
} from './printUtils';
import type { BillPrintData } from '../components/BillPrintTemplate';

/**
 * Normalizes phone numbers for WhatsApp (adds 91 if 10-digit Indian number)
 */
export const normalizeWhatsAppPhone = (phone?: string): string => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length > 10 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
};

/**
 * Generates an in-memory PDF Blob from raw HTML using html2pdf.js
 * Configured with exact A4 margins (8mm top/bottom, 10mm left/right)
 * ensuring pixel-perfect match with physical print preview and zero page overflow!
 */
export const generatePdfBlobFromHtml = async (html: string, fileName: string): Promise<File | null> => {
  return new Promise((resolve) => {
    try {
      const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const isLandscape = html.includes('size: A4 landscape') || html.includes('landscape');
      // Exact printable width inside 10mm left + 10mm right margin:
      // A4 portrait width = 210mm - 20mm = 190mm (718px at 96 DPI)
      // A4 landscape width = 297mm - 20mm = 277mm (1047px at 96 DPI)
      const targetWidth = isLandscape ? 1047 : 718;
      const targetHeight = isLandscape ? 718 : 1055;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = `${targetWidth}px`;
      iframe.style.height = `${targetHeight}px`;
      iframe.style.zIndex = '99999';
      iframe.style.opacity = '0.01';
      iframe.style.border = 'none';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        resolve(null);
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      // Ensure style tags in head are cloned into body so html2canvas clone never loses styling
      if (doc.head && doc.body) {
        const headStyles = doc.querySelectorAll('head style, head link[rel="stylesheet"]');
        headStyles.forEach((s) => {
          doc.body.insertBefore(s.cloneNode(true), doc.body.firstChild);
        });
      }

      if (doc.body) {
        doc.body.style.width = `${targetWidth}px`;
        doc.body.style.margin = '0';
        doc.body.style.padding = '0';
        doc.body.style.boxSizing = 'border-box';
        doc.body.style.backgroundColor = '#FFFFFF';
      }

      // Ensure any images (e.g. transport receipts) are fully loaded
      const waitForImages = () => {
        const images = Array.from(doc.images || []);
        if (images.length === 0) return Promise.resolve();
        return Promise.all(
          images.map(
            (img) =>
              new Promise((r) => {
                if (img.complete) r(null);
                else {
                  img.onload = () => r(null);
                  img.onerror = () => r(null);
                }
              })
          )
        );
      };

      setTimeout(async () => {
        try {
          await waitForImages();
          const target = doc.body;
          const opt = {
            margin: [8, 10, 8, 10], // Exact A4 margins: 8mm top/bottom, 10mm left/right
            filename: cleanFileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#FFFFFF',
              windowWidth: targetWidth,
              scrollX: 0,
              scrollY: 0,
            },
            jsPDF: {
              unit: 'mm',
              format: 'a4',
              orientation: isLandscape ? 'landscape' : 'portrait',
            },
            pagebreak: {
              mode: ['css', 'legacy'],
              after: ['.print-page', '.page-break-after'],
              avoid: [
                'tr',
                '.data-row',
                '.sig-section',
                '.signature-section',
                '.company-banner',
                '.kpi-summary-grid',
                '.page-total-row',
                '.grand-total-row',
                '.split-bottom',
                '.receipt-box',
                '.summary-box',
                '.meta-box',
              ],
            },
          };

          const worker = (html2pdf() as any).set(opt).from(target);
          const pdfBlob: Blob = await worker.output('blob');

          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }

          if (pdfBlob && pdfBlob.size > 200) {
            resolve(new File([pdfBlob], cleanFileName, { type: 'application/pdf' }));
          } else {
            console.warn('[PDF Gen] Generated PDF Blob is too small or empty');
            resolve(null);
          }
        } catch (err) {
          console.error('[PDF Generation Worker Error]:', err);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve(null);
        }
      }, 350);
    } catch (e) {
      console.error('[PDF Gen Error]:', e);
      resolve(null);
    }
  });
};

/**
 * Base dispatcher:
 * - On Mobile (WebShare): shares ONLY the generated PDF document directly via WhatsApp (no text/words attached).
 * - On Desktop: downloads the exact PDF document and opens the direct WhatsApp chat with the customer.
 */
export const shareToWhatsApp = async (options: {
  title: string;
  fileName: string;
  html?: string;
  phone?: string;
}) => {
  const { title, fileName, html, phone } = options;
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const cleanPhone = normalizeWhatsAppPhone(phone);

  let pdfFile: File | null = null;
  if (html) {
    try {
      pdfFile = await generatePdfBlobFromHtml(html, cleanFileName);
    } catch (e) {
      console.warn('[PDF Gen Error]:', e);
    }
  }

  // 1. Mobile Web Share API: shares ONLY the PDF file without text/words
  if (pdfFile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: title || cleanFileName,
      });
      return;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[WebShare API failed, falling back to WhatsApp URL]:', err);
      } else {
        return; // User cancelled share sheet
      }
    }
  }

  // 2. Direct PDF Download for Desktop browsers
  if (pdfFile) {
    try {
      const blobUrl = URL.createObjectURL(pdfFile);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = cleanFileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (dErr) {
      console.warn('[Direct PDF Download fallback failed]:', dErr);
    }
  }

  // 3. Open WhatsApp chat cleanly without prefilled text
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
    : `https://api.whatsapp.com/send`;

  window.open(waUrl, '_blank');
};

/**
 * 1. Share Particular Bill on WhatsApp (PDF Only)
 */
export const shareBillOnWhatsApp = async (bill: BillPrintData, phone?: string) => {
  const html = generateBillHtml(bill);
  await shareToWhatsApp({
    title: `Bill #${bill.billNo} - ${bill.customerName}`,
    fileName: `Bill-${bill.billNo}-${bill.customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone: phone || bill.phone,
  });
};

/**
 * 2. Share Account Ledger Statement on WhatsApp (PDF Only)
 */
export const shareLedgerOnWhatsApp = async (
  customerName: string,
  accountDetails: any[],
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateLedgerStatementHtml(customerName, accountDetails, rangeLabel);
  await shareToWhatsApp({
    title: `Account Statement - ${customerName}`,
    fileName: `Ledger-${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};

/**
 * 3. Share Particulars Statement / List on WhatsApp (PDF Only)
 */
export const shareParticularsListOnWhatsApp = async (
  customerName: string,
  particularDetails: any[],
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateParticularsListPrintHtml(particularDetails, rangeLabel);
  await shareToWhatsApp({
    title: `Particulars List - ${customerName}`,
    fileName: `Particulars-${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};

/**
 * 4. Share Performa Quotation on WhatsApp (PDF Only)
 */
export const sharePerformaOnWhatsApp = async (performa: any, phone?: string) => {
  const custName = performa.customerSnapshot?.name || performa.customerName || 'Customer';
  const pfNum = performa.performaNumber || 'PF';
  const html = generatePerformaHtml(performa);
  await shareToWhatsApp({
    title: `Performa #${pfNum} - ${custName}`,
    fileName: `Performa-${pfNum}-${custName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone: phone || performa.customerSnapshot?.phone || performa.phone,
  });
};

/**
 * 5. Share All Performas List / Summary on WhatsApp (PDF Only)
 */
export const shareAllPerformasOnWhatsApp = async (
  performas: any[],
  summaryTitle: string = 'All Performas',
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateAllPerformasPrintHtml(performas, summaryTitle, rangeLabel);
  await shareToWhatsApp({
    title: `Performa Summary - ${summaryTitle}`,
    fileName: `Performas-Summary-${summaryTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};

/**
 * 6. Share Customer List / Master Report on WhatsApp (PDF Only)
 */
export const shareCustomerListOnWhatsApp = async (
  customers: any[],
  reportTitle: string = 'Customers Master Report',
  fromDate?: string,
  toDate?: string,
  phone?: string
) => {
  const rangeLabel = fromDate || toDate ? `${fromDate || ''} - ${toDate || ''}` : undefined;
  const html = generateCustomerListPrintHtml(customers, reportTitle, rangeLabel);
  await shareToWhatsApp({
    title: reportTitle,
    fileName: `Customers-Report-${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    html,
    phone,
  });
};
