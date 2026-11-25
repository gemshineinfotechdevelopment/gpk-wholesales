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
 * Generates an in-memory PDF Blob from raw HTML using html2pdf.js matching exact A4 print format
 */
export const generatePdfBlobFromHtml = async (html: string, fileName: string): Promise<File | null> => {
  return new Promise((resolve) => {
    try {
      const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const isLandscape = html.includes('size: A4 landscape') || html.includes('landscape');
      const targetWidth = isLandscape ? 1123 : 794;
      const targetHeight = isLandscape ? 794 : 1123;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = `${targetWidth}px`;
      iframe.style.height = `${targetHeight}px`;
      iframe.style.zIndex = '-99999';
      iframe.style.opacity = '1';
      iframe.style.visibility = 'visible';
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

      if (doc.body) {
        doc.body.style.width = `${targetWidth}px`;
        doc.body.style.margin = '0';
        doc.body.style.padding = '0';
        doc.body.style.backgroundColor = '#FFFFFF';
      }

      // Allow 400ms for browser layout engine to render tables, inline CSS, borders, and fonts
      setTimeout(async () => {
        try {
          const target = doc.body;
          const opt = {
            margin: 0,
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
              avoid: ['tr', '.data-row', '.sig-section', '.signature-section', '.company-banner', '.kpi-summary-grid', '.page-total-row', '.grand-total-row'],
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
      }, 400);
    } catch (e) {
      console.error('[PDF Gen Error]:', e);
      resolve(null);
    }
  });
};

/**
 * Base dispatcher: shares the generated PDF File directly via Web Share API
 * without sending text or words.
 * Falls back to downloading the PDF and opening direct WhatsApp chat for desktop browsers.
 */
export const shareToWhatsApp = async (options: {
  title: string;
  text?: string;
  fileName: string;
  html?: string;
  phone?: string;
}) => {
  const { title, text, fileName, html, phone } = options;
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const cleanPhone = normalizeWhatsAppPhone(phone);

  let pdfFile: File | null = null;
  if (html) {
    pdfFile = await generatePdfBlobFromHtml(html, cleanFileName);
  }

  // 1. Try Native Web Share API if device/browser supports file sharing (Mobile, Tablets, Mac/Windows Edge)
  // Shares ONLY the PDF Document without any text/words attached
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

  // 2. Direct PDF Download fallback for Desktop browsers:
  // Automatically saves the exact generated PDF to Downloads so the user can easily attach it in WhatsApp Web
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

  // 3. WhatsApp URL fallback (Desktop Web / Mobile App deep link)
  // When sharing a PDF, open the chat cleanly without filling the input box with text words
  if (pdfFile) {
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
      : `https://api.whatsapp.com/send`;
    window.open(waUrl, '_blank');
    return;
  }

  // 4. Text-only fallback (only if no PDF was generated)
  const encodedText = text ? encodeURIComponent(text) : '';
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}${encodedText ? `&text=${encodedText}` : ''}`
    : `https://api.whatsapp.com/send${encodedText ? `?text=${encodedText}` : ''}`;

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
