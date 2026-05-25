import { type ExchangeItem } from "@/components/pos/ExchangeItem";
import { toast } from "@/components/ui/sonner";

export interface ReceiptData {
  invoiceNumber: string;
  customerName: string;
  items: {
    name: string;
    qty: number;
    price: number;
    weight?: number;
    making?: number;
    purity?: string;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  docType: "estimate" | "invoice";
  goldRate?: number;
  exchangeItems?: ExchangeItem[];
  paymentBreakdown?: { cash: number; card: number; cheque: number; online: number };
  netPayable?: number;
}

export const generateReceiptHTML = (saleData: ReceiptData, docTitle: string) => {
  const title = saleData.docType === "estimate" ? "ESTIMATE" : "TAX INVOICE";
  const today = new Date().toLocaleString();
  const goldRateDisplay = saleData.goldRate ? `₹${saleData.goldRate.toLocaleString()}/gm` : '—';
  const exchangeTotal = saleData.exchangeItems?.reduce((sum, i) => sum + i.value, 0) || 0;

  return `
    <!DOCTYPE html>
    <html>
    <head><title>${docTitle}</title>
    <style>
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      body { font-family: 'Arial', sans-serif; width: 380px; margin: 0 auto; padding: 16px; }
      .header { text-align: center; border-bottom: 2px solid #c8a45a; margin-bottom: 16px; }
      .header h1 { margin: 0; color: #c8a45a; font-size: 20px; }
      .header p { margin: 4px 0; font-size: 12px; color: #666; }
      .details { font-size: 12px; margin: 12px 0; display: flex; justify-content: space-between; }
      .items { width: 100%; font-size: 11px; border-collapse: collapse; margin: 12px 0; }
      .items th, .items td { text-align: left; padding: 6px 2px; border-bottom: 1px solid #ddd; }
      .items th { border-bottom: 2px solid #c8a45a; background: #f9f9f9; }
      .totals { margin-top: 12px; font-size: 12px; border-top: 1px solid #ccc; padding-top: 8px; }
      .total-row { font-weight: bold; font-size: 14px; margin-top: 6px; }
      .exchange-box { margin: 12px 0; padding: 8px; background: #f9f9f9; border: 1px solid #ddd; font-size: 11px; }
      .payment-breakup { margin-top: 12px; font-size: 11px; border-top: 1px dashed #ccc; padding-top: 8px; }
      .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #888; }
      .right { text-align: right; }
    </style>
    </head>
    <body>
      <div class="header"><h1>Rajlakshmi JEWELLERS</h1><p>${today}</p></div>
      <div class="details">
        <span><strong>${title}:</strong> ${saleData.invoiceNumber}</span>
        <span><strong>Gold Rate:</strong> ${goldRateDisplay}</span>
      </div>
      <div class="details"><span><strong>Customer:</strong> ${saleData.customerName || 'Walk-in Customer'}</span></div>
      <table class="items">
        <thead>
          <tr>
            <th>Particulars</th><th>Pcs</th><th>Wt(g)</th><th>Making</th><th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${saleData.items.map(item => {
            const weight = item.weight || (item.price / (saleData.goldRate || 5000)).toFixed(2);
            const making = item.making || 0;
            const amount = item.price * item.qty;
            return `
              <tr>
                <td>${item.name} ${item.purity ? `(${item.purity})` : ''}</td>
                <td style="text-align:center">${item.qty}</td>
                <td style="text-align:center">${typeof weight === 'number' ? weight.toFixed(2) : weight}</td>
                <td style="text-align:center">₹${making.toLocaleString()}</td>
                <td class="right">₹${amount.toLocaleString()}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      ${exchangeTotal > 0 ? `
        <div class="exchange-box">
          <strong>EXCHANGE METAL</strong>
          ${saleData.exchangeItems?.map(ex => `
            <div>${ex.description || 'Old Ornament'} : ${ex.weight}g @ ₹${ex.rate}/gm = ₹${ex.value}</div>
          `).join('')}
        </div>
      ` : ''}
      <div class="totals">
        <div>Subtotal: ₹${saleData.subtotal.toLocaleString()}</div>
        <div>GST (3%): ₹${saleData.tax.toLocaleString()}</div>
        ${exchangeTotal > 0 ? `<div>Exchange Deduction: -₹${exchangeTotal.toLocaleString()}</div>` : ''}
        <div class="total-row">Net Payable: ₹${(saleData.netPayable || saleData.total).toLocaleString()}</div>
      </div>
      <div class="payment-breakup">
        <strong>Payment</strong>
        <div>By Cash: ₹${saleData.paymentBreakdown?.cash?.toLocaleString() || '0'}</div>
        <div>By Card: ₹${saleData.paymentBreakdown?.card?.toLocaleString() || '0'}</div>
        <div>By Cheque: ₹${saleData.paymentBreakdown?.cheque?.toLocaleString() || '0'}</div>
        <div>By Online: ₹${saleData.paymentBreakdown?.online?.toLocaleString() || '0'}</div>
      </div>
      <div class="footer">Thank you for shopping at Rajlakshmi Jewel ERP!</div>
    </body>
    </html>
  `;
};

export const printViaBrowser = (saleData: ReceiptData) => {
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeCustomerName = (saleData.customerName || "walkin").replace(/[^a-z0-9]/gi, '_').substring(0, 20);
  const pdfTitle = `${saleData.docType === 'estimate' ? 'ESTIMATE' : 'INVOICE'}_${saleData.invoiceNumber}_${safeCustomerName}_${dateStr}`;
  const printContent = generateReceiptHTML(saleData, pdfTitle);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Please allow pop-ups to print');
    return;
  }
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.document.title = pdfTitle;
  printWindow.focus();
  printWindow.print();
};