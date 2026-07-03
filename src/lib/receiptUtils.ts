import { type ExchangeItem } from "@/components/pos/ExchangeItem";
import { toast } from "@/components/ui/sonner";
import logo from "@/assets/logo.png";

/* ============================================================
   SHOP SETTINGS – fill in your real details
   ============================================================ */
export interface ShopConfig {
  name: string;
  tagline?: string;
  addressLines: string[];
  phone: string;
  email: string;
  gstin: string;
  logoUrl?: string;
  bank: {
    accountHolder: string;
    accountNumber: string;
    bankName: string;
    branch: string;
    ifsc: string;
  };
  terms: string[];
}

export const SHOP_CONFIG: ShopConfig = {
  name: "Rajlakshmi JEWELLERS",
  tagline: "FULLY INTERNATIONAL",
  addressLines: [
    "Your Shop Address Line 1, Near Landmark",
    "City - Pincode, State",
  ],
  phone: "9XXXXXXXXX",
  email: "youremail@example.com",
  gstin: "27XXXXXXXXXX12X",
  logoUrl: logo,
  bank: {
    accountHolder: "RAJLAKSHMI JEWELLERS",
    accountNumber: "0000000000000",
    bankName: "YOUR BANK",
    branch: "BRANCH NAME",
    ifsc: "IFSC0000000",
  },
  terms: [
    "Goods once sold will not be taken back or exchanged.",
    "Interest @ 24% p.a. will be charged if payment is not made within due date.",
    "All disputes subject to local jurisdiction only.",
  ],
};

/* ============================================================
   TYPES
   ============================================================ */
export interface ReceiptData {
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGstin?: string;
  customerState?: string;
  salesman?: string;
  previousBalance?: number;
  eWayNo?: string;
  items: {
    name: string;
    qty: number;
    price: number;
    weight?: number;
    making?: number;
    purity?: string;
    hsnCode?: string;
    mrp?: number;
    gstRate?: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  docType: "estimate" | "invoice";
  goldRate?: number;
  exchangeItems?: ExchangeItem[];
  paymentBreakdown?: { cash: number; card: number; cheque: number; online: number };
  netPayable?: number;
  gstEnabled?: boolean;
}

/* ============================================================
   HELPERS
   ============================================================ */
const DEFAULT_HSN = "7113";

export function numberToWordsIndian(num: number): string {
  if (num === 0) return "Zero";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];
  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  };
  const threeDigits = (n: number): string => {
    if (n >= 100) {
      return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigits(n % 100) : "");
    }
    return twoDigits(n);
  };

  let n = Math.round(num);
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(threeDigits(lakh) + " Lakh");
  if (thousand) parts.push(threeDigits(thousand) + " Thousand");
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(" ") || "Zero";
}

export function amountInWords(total: number): string {
  const rupees = Math.floor(total);
  const paise = Math.round((total - rupees) * 100);
  let words = `Rupees ${numberToWordsIndian(rupees)}`;
  if (paise > 0) words += ` and ${numberToWordsIndian(paise)} Paise`;
  return words + " Only";
}

/* ============================================================
   HTML GENERATION – with tiled watermark (SVG background)
   ============================================================ */
export const generateReceiptHTML = (saleData: ReceiptData, docTitle: string) => {
  const title = saleData.docType === "estimate" ? "ESTIMATE" : "TAX INVOICE";
  const isGstInvoice = saleData.docType === "invoice" && (saleData.gstEnabled ?? true);
  const dateStr = new Date().toLocaleString();
  const goldRateDisplay = saleData.goldRate ? `₹${saleData.goldRate.toLocaleString()}/gm` : '—';
  const exchangeTotal = saleData.exchangeItems?.reduce((sum, i) => sum + i.value, 0) || 0;
  const netTotal = saleData.netPayable ?? saleData.total;
  const totalQty = saleData.items.reduce((s, i) => s + i.qty, 0);

  const cgst = isGstInvoice ? Math.round(saleData.tax / 2) : 0;
  const sgst = isGstInvoice ? saleData.tax - cgst : 0;

  // SVG tile for watermark – repeated background
  const watermarkSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='200'%3E%3Ctext x='140' y='100' font-family='Arial Black, Helvetica, sans-serif' font-weight='900' font-size='20' fill='%23c8a45a' fill-opacity='0.15' text-anchor='middle' transform='rotate(-30 140 100)'%3ERajlakshmi Jewellers%3C/text%3E%3C/svg%3E")`;

  return `
    <!DOCTYPE html>
    <html>
    <head><title>${docTitle}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      body {
        font-family: 'Arial', 'Helvetica', sans-serif;
        background: #f5f3ef;
        display: flex;
        justify-content: center;
        padding: 20px;
        margin: 0;
      }
      
      .invoice-wrapper {
        position: relative;
        width: 780px;
        background-color: #ffffff;
        background-image: ${watermarkSvg};
        background-repeat: repeat;
        border: 2px solid #c8a45a;
        padding: 28px 30px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.06);
        overflow: hidden;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .invoice-content { position: relative; z-index: 1; }
      
      .doc-title {
        text-align: center;
        font-size: 16px;
        letter-spacing: 5px;
        font-weight: 700;
        margin-bottom: 8px;
        color: #a8792e;
        text-transform: uppercase;
      }
      
      .letterhead {
        text-align: center;
        border-bottom: 2px solid #c8a45a;
        padding-bottom: 14px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .letterhead .logo-slot {
        width: 72px;
        height: 72px;
        flex-shrink: 0;
        border: 1px solid #c8a45a;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: #fff;
      }
      .letterhead .logo-slot img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        padding: 4px;
      }
      .letterhead .info {
        flex: 1;
        text-align: center;
      }
      .letterhead .info h1 {
        margin: 0;
        color: #a8792e;
        font-size: 26px;
        font-weight: 700;
        letter-spacing: 1.5px;
      }
      .letterhead .tagline {
        font-size: 10px;
        letter-spacing: 3px;
        color: #666;
        margin-top: 2px;
        font-weight: 600;
      }
      .letterhead .addr {
        font-size: 11px;
        color: #333;
        margin-top: 5px;
      }
      .letterhead .gstin {
        font-size: 11px;
        font-weight: 600;
        margin-top: 4px;
        color: #333;
      }
      .letterhead .datetime {
        font-size: 10.5px;
        color: #777;
        margin-top: 4px;
      }

      .meta-grid {
        display: flex;
        margin-bottom: 14px;
        padding: 4px 0;
        border-bottom: 1px solid #ddd;
      }
      .meta-grid .col {
        flex: 1;
        padding: 4px 6px;
        font-size: 11.5px;
      }
      .meta-grid .col:first-child {
        border-right: 1px solid #ddd;
      }
      .meta-grid .col-title {
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        margin-bottom: 4px;
        color: #a8792e;
        letter-spacing: 0.8px;
      }
      .meta-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
        line-height: 1.6;
      }
      .meta-row .label { color: #333; font-weight: 500; }
      .meta-row .value { color: #000; font-weight: 600; }
      .customer-name {
        font-weight: 700;
        font-size: 13.5px;
        color: #1a1a1a;
        margin-bottom: 3px;
      }

      table.items {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0 10px 0;
        font-size: 11px;
        border: 1px solid #ddd;
      }
      table.items th, table.items td {
        border: 1px solid #ddd;
        padding: 7px 8px;
      }
      table.items th {
        background: #f7f0df;
        font-weight: 700;
        text-align: left;
        color: #1a1a1a;
        font-size: 10.5px;
        letter-spacing: 0.3px;
      }
      table.items td.right, table.items th.right { text-align: right; }
      table.items td.center, table.items th.center { text-align: center; }
      table.items tfoot td {
        font-weight: 700;
        background: #faf6ec;
        border-top: 2px solid #c8a45a;
        font-size: 11px;
      }

      .exchange-box {
        margin: 10px 0;
        padding: 10px 14px;
        background: #fcf9f2;
        border: 1px solid #c8a45a;
        font-size: 11px;
      }

      .bottom-grid {
        display: flex;
        gap: 20px;
        margin-top: 14px;
      }
      .bottom-left { flex: 1.3; }
      .bottom-right { flex: 1; }

      .totals-box {
        border: 1px solid #ddd;
        background: #fcfcfc;
      }
      .totals-box .line {
        display: flex;
        justify-content: space-between;
        padding: 6px 14px;
        border-bottom: 1px solid #eee;
        font-size: 12px;
      }
      .totals-box .line:last-child { border-bottom: none; }
      .totals-box .net {
        font-weight: 800;
        font-size: 15px;
        background: #f7f0df;
        color: #a8792e;
      }

      .words-box {
        border: 1px solid #ddd;
        border-top: none;
        padding: 8px 14px;
        font-size: 11.5px;
        font-style: italic;
        background: #fcf9f2;
        color: #1a1a1a;
      }
      .words-box strong { font-weight: 700; color: #1a1a1a; }

      .payment-box {
        border: 1px solid #ddd;
        padding: 10px 14px;
        margin-top: 10px;
        font-size: 11.5px;
        background: #fcfcfc;
      }
      .payment-box .line {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        line-height: 1.6;
      }
      .payment-box .title {
        font-weight: 700;
        margin-bottom: 5px;
        color: #a8792e;
        letter-spacing: 0.5px;
        font-size: 12px;
      }

      .terms-box {
        border: 1px solid #ddd;
        padding: 10px 14px;
        font-size: 10.5px;
        background: #fcfcfc;
      }
      .terms-box .col-title {
        font-weight: 700;
        margin-bottom: 5px;
        color: #a8792e;
        letter-spacing: 0.5px;
        font-size: 11px;
      }
      .terms-box ol {
        margin: 0;
        padding-left: 18px;
        color: #1a1a1a;
        line-height: 1.7;
      }
      .terms-box ol li { margin-bottom: 1px; }

      .bank-box {
        border: 1px solid #ddd;
        border-top: none;
        padding: 10px 14px;
        font-size: 10.5px;
        background: #fcfcfc;
      }
      .bank-box .col-title {
        font-weight: 700;
        margin-bottom: 4px;
        color: #a8792e;
        letter-spacing: 0.5px;
        font-size: 11px;
      }
      .bank-box div { line-height: 1.7; color: #1a1a1a; }

      .signatory {
        margin-top: 30px;
        text-align: right;
        font-size: 11.5px;
        font-weight: 600;
        color: #1a1a1a;
        padding-top: 16px;
        border-top: 1px solid #c8a45a;
      }
      .signatory .for-text { font-weight: 400; color: #777; }
      .signatory .sig-line {
        border-top: 1px solid #c8a45a;
        padding-top: 4px;
        display: inline-block;
        font-weight: 400;
        color: #555;
        font-size: 10.5px;
      }

      .footer-thanks {
        text-align: center;
        margin-top: 18px;
        padding-top: 12px;
        border-top: 2px solid #c8a45a;
        font-size: 12px;
        color: #a8792e;
        font-weight: 600;
        letter-spacing: 1px;
      }

      @media print {
        body { background: #fff; padding: 0; }
        .invoice-wrapper {
          border: 2px solid #c8a45a !important;
          padding: 24px 28px !important;
          width: 100% !important;
          max-width: 780px !important;
          box-shadow: none !important;
        }
      }
    </style>
    </head>
    <body>
      <div class="invoice-wrapper">
        <div class="invoice-content">
          <div class="doc-title">${title}</div>

          <div class="letterhead">
            <div class="logo-slot">
              ${SHOP_CONFIG.logoUrl
                ? `<img src="${SHOP_CONFIG.logoUrl}" alt="logo" />`
                : `<span class="logo-placeholder">🪙</span>`
              }
            </div>
            <div class="info">
              <h1>${SHOP_CONFIG.name}</h1>
              ${SHOP_CONFIG.tagline ? `<div class="tagline">${SHOP_CONFIG.tagline}</div>` : ''}
              <div class="addr">${SHOP_CONFIG.addressLines.join(', ')}</div>
              <div class="addr">Contact: ${SHOP_CONFIG.phone} &nbsp;|&nbsp; Email: ${SHOP_CONFIG.email}</div>
              ${isGstInvoice ? `<div class="gstin">GSTIN: ${SHOP_CONFIG.gstin}</div>` : ''}
              <div class="datetime">${dateStr}</div>
            </div>
            <div class="logo-slot" style="visibility:hidden;"></div>
          </div>

          <div class="meta-grid">
            <div class="col">
              <div class="col-title">Details for Buyer (Billed &amp; Shipped To)</div>
              <div class="customer-name">${saleData.customerName || "Walk-in Customer"}</div>
              ${saleData.customerState ? `<div style="font-size:11px;color:#555;">${saleData.customerState}</div>` : ""}
              ${saleData.customerAddress ? `<div class="meta-row"><span class="label">Address</span><span class="value">${saleData.customerAddress}</span></div>` : ""}
              ${saleData.customerGstin
                ? `<div class="meta-row"><span class="label">GST No.</span><span class="value">${saleData.customerGstin}</span></div>`
                : `<div class="meta-row"><span class="label">GST No.</span><span class="value">—</span></div>`
              }
              <div class="meta-row"><span class="label">Contact No.</span><span class="value">${saleData.customerPhone || "—"}</span></div>
            </div>
            <div class="col">
              <div class="col-title">Invoice Details</div>
              <div class="meta-row"><span class="label">${title === "TAX INVOICE" ? "Invoice No." : "Estimate No."}</span><span class="value">${saleData.invoiceNumber}</span></div>
              <div class="meta-row"><span class="label">Dated</span><span class="value">${dateStr}</span></div>
              <div class="meta-row"><span class="label">E-Way No.</span><span class="value">${saleData.eWayNo || "—"}</span></div>
              <div class="meta-row"><span class="label">Tax Type</span><span class="value">${isGstInvoice ? "GST" : "NON GST"}</span></div>
              <div class="meta-row"><span class="label">Gold Rate</span><span class="value">${goldRateDisplay}</span></div>
              <div class="meta-row"><span class="label">Salesman</span><span class="value">${saleData.salesman || "—"}</span></div>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th class="center" style="width:38px;">Sr.</th>
                <th style="min-width:150px;">Description</th>
                <th class="center" style="width:55px;">HSN</th>
                <th class="right" style="width:70px;">MRP</th>
                <th class="center" style="width:42px;">Qty</th>
                <th class="right" style="width:58px;">Wt(g)</th>
                <th class="right" style="width:68px;">Making</th>
                <th class="center" style="width:52px;">GST%</th>
                <th class="right" style="width:85px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${saleData.items.map((item, idx) => {
                const weight = item.weight ?? 0;
                const making = item.making || 0;
                const mrp = item.mrp ?? item.price;
                const amount = item.price * item.qty;
                const gstRate = item.gstRate ?? (isGstInvoice ? 3 : 0);
                const nameLine = item.purity ? `${item.name} (${item.purity})` : item.name;
                return `
                  <tr>
                    <td class="center">${idx + 1}</td>
                    <td>${nameLine}</td>
                    <td class="center">${item.hsnCode || DEFAULT_HSN}</td>
                    <td class="right">₹${mrp.toLocaleString("en-IN")}</td>
                    <td class="center">${item.qty}</td>
                    <td class="right">${weight ? weight.toFixed(2) : "—"}</td>
                    <td class="right">${making ? "₹" + making.toLocaleString("en-IN") : "—"}</td>
                    <td class="center">${gstRate}%</td>
                    <td class="right">₹${amount.toLocaleString("en-IN")}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="right"><strong>Total</strong></td>
                <td class="center"><strong>${totalQty}</strong></td>
                <td colspan="3"></td>
                <td class="right"><strong>₹${saleData.subtotal.toLocaleString("en-IN")}</strong></td>
              </tr>
            </tfoot>
          </table>

          ${exchangeTotal > 0 ? `
            <div class="exchange-box">
              <strong style="color:#a8792e;">Exchange Metal (Old Jewellery)</strong>
              ${saleData.exchangeItems?.map(ex => `
                <div style="display:flex;justify-content:space-between;margin-top:4px;">
                  <span>${ex.description || 'Old Ornament'} — ${ex.weight}g @ ₹${ex.rate}/gm</span>
                  <span>₹${ex.value.toLocaleString("en-IN")}</span>
                </div>
              `).join('')}
              <div style="display:flex;justify-content:space-between;margin-top:6px;font-weight:700;border-top:1px solid #c8a45a;padding-top:4px;">
                <span>Exchange Deduction</span><span style="color:#b45309;">−₹${exchangeTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          ` : ""}

          <div class="bottom-grid">
            <div class="bottom-left">
              <div class="terms-box">
                <div class="col-title">Terms &amp; Conditions</div>
                <ol>
                  ${SHOP_CONFIG.terms.map(t => `<li>${t}</li>`).join('')}
                </ol>
              </div>
              <div class="bank-box">
                <div class="col-title">Company Bank Details</div>
                <div>Bank Holder Name: ${SHOP_CONFIG.bank.accountHolder}</div>
                <div>Bank A/c No: ${SHOP_CONFIG.bank.accountNumber}</div>
                <div>Bank Name &amp; Branch: ${SHOP_CONFIG.bank.bankName}, ${SHOP_CONFIG.bank.branch}</div>
                <div>IFSC: ${SHOP_CONFIG.bank.ifsc}</div>
              </div>
              <div class="signatory">
                <span class="for-text">For</span> ${SHOP_CONFIG.name}<br/><br/><br/>
                <span class="sig-line">(Authorised Signatory)</span>
              </div>
            </div>
            <div class="bottom-right">
              <div class="totals-box">
                <div class="line"><span>Total Amount Before Tax</span><span>₹${saleData.subtotal.toLocaleString("en-IN")}</span></div>
                ${isGstInvoice ? `
                  <div class="line"><span>CGST</span><span>₹${cgst.toLocaleString("en-IN")}</span></div>
                  <div class="line"><span>SGST</span><span>₹${sgst.toLocaleString("en-IN")}</span></div>
                ` : `<div class="line"><span>GST</span><span>Exempt</span></div>`}
                ${exchangeTotal > 0 ? `<div class="line"><span>Exchange Deduction</span><span style="color:#b45309;">−₹${exchangeTotal.toLocaleString("en-IN")}</span></div>` : ""}
                <div class="line net"><span>Invoice Total</span><span>₹${netTotal.toLocaleString("en-IN")}</span></div>
              </div>
              <div class="words-box">
                <strong>Amount in Words:</strong> ${amountInWords(netTotal)}
              </div>

              <div class="payment-box">
                <div class="title">Payment</div>
                <div class="line"><span>By Cash</span><span>₹${(saleData.paymentBreakdown?.cash || 0).toLocaleString("en-IN")}</span></div>
                <div class="line"><span>By Card</span><span>₹${(saleData.paymentBreakdown?.card || 0).toLocaleString("en-IN")}</span></div>
                <div class="line"><span>By Cheque</span><span>₹${(saleData.paymentBreakdown?.cheque || 0).toLocaleString("en-IN")}</span></div>
                <div class="line"><span>By Online / UPI</span><span>₹${(saleData.paymentBreakdown?.online || 0).toLocaleString("en-IN")}</span></div>
                ${(() => {
                  const paid = (saleData.paymentBreakdown?.cash || 0) + (saleData.paymentBreakdown?.card || 0) +
                    (saleData.paymentBreakdown?.cheque || 0) + (saleData.paymentBreakdown?.online || 0);
                  const pending = netTotal - paid;
                  return pending > 0
                    ? `<div class="line" style="font-weight:700; color:#b45309; border-top:1px solid #c8a45a; padding-top:4px; margin-top:4px;">
                        <span>Pending</span><span>₹${pending.toLocaleString("en-IN")}</span>
                      </div>`
                    : "";
                })()}
              </div>
            </div>
          </div>

          <div class="footer-thanks">✨ Thank you for shopping at ${SHOP_CONFIG.name}... Visit Again! ✨</div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/* ============================================================
   BROWSER PRINT
   ============================================================ */
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