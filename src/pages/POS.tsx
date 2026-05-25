import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart, Barcode, Search, Plus, Minus, Trash2,
  CreditCard, Banknote, Smartphone, Loader2, Calculator, Gem, Zap, Gift, Package, UserPlus, Cake, Phone, User, MapPin, Mail, Calendar, Sparkles, IndianRupee,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GoldRateCalculator, type ProductForCalc, type CalcResult } from "@/components/pos/GoldRateCalculator";
import { toast } from "sonner";
import { useUserData } from "@/hooks/useUserData";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/hooks/useNotifications";
import { ExchangeItemComponent, type ExchangeItem } from "@/components/pos/ExchangeItem";
import { ExchangeModal } from "@/components/pos/ExchangeModal";
import qz from 'qz-tray';
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { CameraScanner } from "@/components/pos/CameraScanner";
import { ref, onChildAdded, remove } from "firebase/database";
import { db } from "@/lib/firebase";


interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  metal_type: string;
  weight: number;
  purchase_price: number;
  unit_price: number;
  stock: number;
  status: string;
}
interface PrintData {
  invoice_number: string;
  customer_name: string;
  created_at: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
}
interface CartItem {
  id: string;
  name: string;
  weight: number;
  unit_price: number;
  stock: number;
  qty: number;
  sku: string;
  calculatedPrice?: boolean;
  purity?: string;
  metal_type?: string;
}

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  date_of_birth?: string | null;
  loyalty_points: number;
  total_purchases: number;
}

const DEFAULT_BIRTHDAY_DISCOUNT = 5;

const isGoldProduct = (p: Product) => p.metal_type?.toLowerCase().includes("gold");
const isImitationProduct = (p: Product) => {
  const name = (p.name || "").toLowerCase();
  const metal = (p.metal_type || "").toLowerCase();
  return name.includes("imitation") || name.includes("artificial") || name.includes("fashion") || metal.includes("imitation");
};
const needsCalculator = (product: Product): boolean => {
  const metal = product.metal_type?.toLowerCase() || '';
  return metal.includes('gold') || metal.includes('silver') || metal.includes('platinum') || metal.includes('diamond');
};
function isTodayBirthday(dob: string | null | undefined): boolean {
  if (!dob) return false;
  const today = new Date();
  const birth = new Date(dob);
  return birth.getMonth() === today.getMonth() && birth.getDate() === today.getDate();
}

const POS = () => {
  const { getAll, addItem, updateItem } = useUserData();
  const { createNotification } = useNotifications();


  const [docType, setDocType] = useState<"estimate" | "invoice">("invoice");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [calcProduct, setCalcProduct] = useState<ProductForCalc | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [birthdayDiscountApplied, setBirthdayDiscountApplied] = useState(false);
  const [birthdayDiscountPercent, setBirthdayDiscountPercent] = useState(DEFAULT_BIRTHDAY_DISCOUNT);
  const [customerMode, setCustomerMode] = useState<"search" | "new" | "walkin">("search");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerDob, setNewCustomerDob] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [imitationDiscountType, setImitationDiscountType] = useState<"percent" | "flat">("percent");
  const [imitationDiscountValue, setImitationDiscountValue] = useState(0);
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([]);
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [invoiceGstEnabled, setInvoiceGstEnabled] = useState<boolean>(true);
  const [lastPrintData, setLastPrintData] = useState<PrintData | null>(null);
  const [goldRate, setGoldRate] = useState<number>(0);
  const gstEnabled = docType === "estimate" ? false : invoiceGstEnabled;
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanBufferRef = useRef("");
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();


  const { data: products = [], isLoading } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const all = await getAll<Product>("products");
      return all.filter((p) => p.stock > 0).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => getAll<CustomerRecord>("customers"),
  });

  // Inside POS component (add after the products query)
useEffect(() => {
  const scansRef = ref(db, 'pending_scans');
  const unsubscribe = onChildAdded(scansRef, async (snapshot) => {
    const scan = snapshot.val();
    if (scan && scan.barcode) {
      // Find product
      const product = products.find(
        (p) => p.barcode === scan.barcode || p.sku === scan.barcode
      );
      if (product) {
        if (isGoldProduct(product)) {
          sendToCalculator(product);
          toast.success(`📱 Scanned: ${product.name} → Calculator`);
        } else {
          addToCart(product);
          toast.success(`📱 Scanned: ${product.name} → Added to Bill`);
        }
      } else {
        toast.error(`Product not found: ${scan.barcode}`);
      }
      // Remove the processed scan
      await remove(ref(db, `pending_scans/${snapshot.key}`));
    }
  });
  return () => unsubscribe();
}, [products]); // re-run when products list changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + N → New Sale (reset cart, clear customer)
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (cart.length > 0) {
          if (confirm("Clear current cart and start new sale?")) {
            setCart([]);
            setSelectedCustomer(null);
            setExchangeItems([]);
            setDocType("invoice");
            setAmountPaid(0);
          }
        }
      }
      // Ctrl + P → Print last receipt (if you have a last receipt variable)
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        if (lastPrintData) {
          tryPrint(lastPrintData);
        } else {
          toast.info("No receipt to print");
        }
      }
      // F2 → Focus search input
      if (e.key === 'F2') {
        e.preventDefault();
        scanInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, lastPrintData]);

  useEffect(() => {
    if (!selectedCustomer || !isTodayBirthday(selectedCustomer.date_of_birth)) {
      setBirthdayDiscountApplied(false);
      setBirthdayDiscountPercent(DEFAULT_BIRTHDAY_DISCOUNT);
    }
  }, [selectedCustomer]);

  // Barcode scanner detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isScanInput = active === scanInputRef.current;
      const isOtherInput = active instanceof HTMLInputElement && !isScanInput;
      if (isOtherInput) return;
      if (e.key === "Enter" && scanBufferRef.current.length >= 5) {
        e.preventDefault();
        const scannedCode = scanBufferRef.current.trim();
        scanBufferRef.current = "";
        handleBarcodeScan(scannedCode);
        return;
      }
      if (e.key.length === 1) {
        scanBufferRef.current += e.key;
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => { scanBufferRef.current = ""; }, 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products, cart]);

  const handleBarcodeScan = useCallback((code: string) => {
    const product = products.find(
      (p) => p.barcode?.toLowerCase() === code.toLowerCase() || p.sku?.toLowerCase() === code.toLowerCase()
    );
    if (!product) { toast.error(`Product not found: ${code}`); return; }
    if (needsCalculator(product)) {
  sendToCalculator(product);
  toast.success(`🔊 Scanned: ${product.name} → Calculator`, { position: 'top-right' });
} else {
  addToCart(product);
  toast.success(`🔊 Scanned: ${product.name} → Added to Bill`, { duration: 1000, position: 'top-right' });
}
    setSearchQuery("");
  }, [products, cart]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim().length >= 3) {
      const product = products.find(
        (p) => p.barcode?.toLowerCase() === searchQuery.trim().toLowerCase() || p.sku?.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (product) {
  e.preventDefault();
  if (needsCalculator(product)) sendToCalculator(product);
  else addToCart(product);
  setSearchQuery("");
  return;
}
      const filtered = products.filter(
        (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filtered.length === 1) {
  if (needsCalculator(filtered[0])) sendToCalculator(filtered[0]);
  else addToCart(filtered[0]);
  setSearchQuery("");
}
    }
  };

  const hasImitationItems = cart.some((item) => {
    const name = (item.name || "").toLowerCase();
    const metal = (item.metal_type || "").toLowerCase();
    return name.includes("imitation") || name.includes("artificial") || name.includes("fashion") || metal.includes("imitation");
  });

  const isFullyImitation = cart.length > 0 && cart.every((item) => {
    const name = (item.name || "").toLowerCase();
    const metal = (item.metal_type || "").toLowerCase();
    return name.includes("imitation") || name.includes("artificial") || name.includes("fashion") || metal.includes("imitation");
  });

  const subtotal = cart.reduce((acc, item) => acc + item.unit_price * item.qty, 0);
  const tax = gstEnabled ? Math.round(subtotal * 0.03) : 0;
  const isBirthday = selectedCustomer ? isTodayBirthday(selectedCustomer.date_of_birth) : false;
  const birthdayDiscount = birthdayDiscountApplied ? Math.round(subtotal * (birthdayDiscountPercent / 100)) : 0;

  let imitationDiscount = 0;
  if (hasImitationItems && imitationDiscountValue > 0) {
    if (imitationDiscountType === "percent") imitationDiscount = Math.round(subtotal * (imitationDiscountValue / 100));
    else imitationDiscount = Math.min(imitationDiscountValue, subtotal);
  }

  const totalDiscount = birthdayDiscount + imitationDiscount;
  const totalExchangeValue = useMemo(() => exchangeItems.reduce((sum, i) => sum + i.value, 0), [exchangeItems]);
  const total = subtotal + tax - totalDiscount - totalExchangeValue;

  useEffect(() => {
    setAmountPaid(total);
  }, [total]);

  // --- Print functions (ESC/POS and HTML) ---
  const generateReceiptData = (saleData: {
    invoice_number: string;
    customer_name: string;
    created_at: string;
    items: { name: string; qty: number; price: number }[];
    subtotal: number;
    tax: number;
    total: number;
    exchangeItems?: ExchangeItem[];
    paymentMethod?: string;
    amountPaid?: number;
    totalExchangeValue?: number;
  }) => {
    const encoder = new ReceiptPrinterEncoder({ language: 'esc-pos', width: 48, debug: false });

    encoder
      .initialize()
      .text('Rajlakshmi   JEWELLERS')
      .newline()
      .text('================================')
      .newline()
      .text(`${docType === "estimate" ? "ESTIMATE" : "TAX INVOICE"}: ${saleData.invoice_number}`)
      .text(`Date: ${new Date(saleData.created_at).toLocaleString()}`)
      .text(`Customer: ${saleData.customer_name || 'Walk-in Customer'}`)
      .newline()
      .text('Items:')
      .newline();

    // Print each item
    saleData.items.forEach(item => {
      const line = `${item.name} x${item.qty}`;
      const price = `₹${(item.price * item.qty).toLocaleString()}`;
      encoder.text(line.padEnd(30) + price.padStart(10)).newline();
    });

    // Print exchange items if any
    const exchangeTotal = saleData.totalExchangeValue ||
      saleData.exchangeItems?.reduce((sum, ex) => sum + (ex.value || 0), 0) || 0;

    if (saleData.exchangeItems && saleData.exchangeItems.length > 0) {
      encoder.text('--------------------------------').newline();
      encoder.text('EXCHANGE METAL:').newline();
      saleData.exchangeItems.forEach(ex => {
        const type = ex.description || 'Old Ornament';
        const weight = ex.weight || 0;
        const rate = ex.rate || 0;
        const value = ex.value || 0;
        encoder.text(`${type} : ${weight}g @ ₹${rate}/gm = ₹${value}`).newline();
      });
      encoder.text(`Exchange Deduction: -₹${exchangeTotal.toLocaleString()}`).newline();
    }

    // Print payment breakdown
    const paymentMethod = saleData.paymentMethod || 'Cash';
    const amountPaid = saleData.amountPaid || saleData.total;

    encoder.text('--------------------------------').newline();
    encoder.text('PAYMENT:').newline();
    encoder.text(`Method: ${paymentMethod}`).newline();
    encoder.text(`Paid: ₹${amountPaid.toLocaleString()}`).newline();
    if (amountPaid < saleData.total) {
      encoder.text(`Pending: ₹${(saleData.total - amountPaid).toLocaleString()}`).newline();
    }

    encoder.text('================================').newline();
    encoder.text(`Subtotal:     ₹${saleData.subtotal.toLocaleString()}`).newline();
    encoder.text(`GST (3%):     ₹${saleData.tax.toLocaleString()}`).newline();
    if (exchangeTotal > 0) {
      encoder.text(`Exchange:    -₹${exchangeTotal.toLocaleString()}`).newline();
    }
    encoder.text(`Total:        ₹${saleData.total.toLocaleString()}`).newline();
    encoder.text('================================').newline();
    encoder.text('Thank you for shopping!').newline();
    encoder.cut('full');

    return encoder.encode();
  };
  const generateReceiptHTML = (
    saleData: {
      invoiceNumber: string;
      customerName: string;
      created_at?: string;
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
    },
    docTitle: string
  ) => {
    const title = saleData.docType === "estimate" ? "ESTIMATE" : "TAX INVOICE";
    const today = new Date().toLocaleString();
    const goldRateDisplay = saleData.goldRate ? `₹${saleData.goldRate.toLocaleString()}/gm` : '—';
    const exchangeTotal = saleData.exchangeItems?.reduce((sum, i) => sum + i.value, 0) || 0;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${docTitle}</title>
      <style>
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
      <div class="header">
        <h1>Rajlakshmi  JEWELLERS</h1>
        <p>${today}</p>
      </div>
      <div class="details">
        <span><strong>${title}:</strong> ${saleData.invoiceNumber}</span>
        <span><strong>Gold Rate:</strong> ${goldRateDisplay}</span>
      </div>
      <div class="details">
        <span><strong>Customer:</strong> ${saleData.customerName || 'Walk-in Customer'}</span>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th>Particulars</th>
            <th>Pcs</th>
            <th>Wt(g)</th>
            <th>Making</th>
            <th class="right">Amount</th>
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
                <td>${item.qty}</td>
                <td>${typeof weight === 'number' ? weight.toFixed(2) : weight}</td>
                <td>₹${making.toLocaleString()}</td>
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

      <div class="footer">
        Thank you for shopping at Rajlakshmi Jewel ERP!
      </div>
    </body>
    </html>
  `;
  };

  const printViaBrowser = (saleData: {
    invoiceNumber: string;
    customerName: string;
    items: CartItem[];   // use full CartItem type to get weight, purity, etc.
    subtotal: number;
    tax: number;
    total: number;
    docType: "estimate" | "invoice";
    goldRate?: number;
    exchangeItems?: ExchangeItem[];
    paymentBreakdown?: { cash: number; card: number; cheque: number; online: number };
    netPayable?: number;
  }) => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeCustomerName = saleData.customerName
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 20);
    const pdfTitle = `${saleData.docType === 'estimate' ? 'ESTIMATE' : 'INVOICE'}_${saleData.invoiceNumber}_${safeCustomerName}_${dateStr}`;

    // Prepare items for receipt (include weight, purity, making)
    const receiptItems = saleData.items.map(item => ({
      name: item.name,
      qty: item.qty,
      price: item.unit_price,
      weight: item.weight,
      purity: item.purity,
      making: (item.unit_price - (saleData.goldRate || 0) * item.weight) > 0
        ? (item.unit_price - (saleData.goldRate || 0) * item.weight)
        : 0,
    }));

    const receiptData = {
      invoiceNumber: saleData.invoiceNumber,
      customerName: saleData.customerName,
      items: receiptItems,
      subtotal: saleData.subtotal,
      tax: saleData.tax,
      total: saleData.total,
      docType: saleData.docType,
      goldRate: saleData.goldRate,
      exchangeItems: saleData.exchangeItems,
      paymentBreakdown: saleData.paymentBreakdown,
      netPayable: saleData.netPayable,
    };

    const printContent = generateReceiptHTML(receiptData, pdfTitle);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };
  const tryPrint = useCallback(async (saleData: {
    invoice_number: string;
    customer_name: string;
    created_at: string;
    items: { name: string; qty: number; price: number }[];
    subtotal: number;
    tax: number;
    total: number;
  }) => {
    const totalExchangeValue = exchangeItems.reduce((sum, i) => sum + i.value, 0);

    // Build complete data for the receipt (including all extra fields)
    const browserData = {
      invoiceNumber: saleData.invoice_number,
      customerName: saleData.customer_name,
      items: cart,   // send full CartItem objects (with weight, purity, etc.)
      subtotal: saleData.subtotal,
      tax: saleData.tax,
      total: saleData.total,
      docType,
      goldRate: goldRate,
      exchangeItems: exchangeItems,
      paymentBreakdown: {
        cash: paymentMethod === "Cash" ? amountPaid : 0,
        card: paymentMethod === "Card" ? amountPaid : 0,
        cheque: 0,   // add cheque if needed
        online: paymentMethod === "UPI" ? amountPaid : 0,
      },
      netPayable: total,
    };

    try {
      await qz.websocket.connect();
      const printers = await qz.printers.find();
      const thermalPrinter = printers.find(p =>
        p.name.toLowerCase().includes('epson') || p.name.toLowerCase().includes('tm-t82') ||
        p.name.toLowerCase().includes('xp-80c') || p.name.toLowerCase().includes('thermal') || p.name.toLowerCase().includes('printer')
      );
      if (!thermalPrinter) throw new Error('No thermal printer found');
      const config = qz.configs.create(thermalPrinter.name);
      const receiptData = generateReceiptData({
        ...saleData,
        exchangeItems: exchangeItems,
        paymentMethod: paymentMethod,
        amountPaid: amountPaid,
        totalExchangeValue: totalExchangeValue,
      });
      await qz.print(config, receiptData);
      await qz.websocket.disconnect();
      toast.success('Bill printed on thermal printer!');
    } catch (err) {
      console.warn('QZ Tray failed, fallback to browser print', err);
      printViaBrowser(browserData);   // now passes all extra fields
    }
  }, [docType, goldRate, exchangeItems, paymentMethod, amountPaid, total, cart]);


  // --- Estimate generation (no stock deduction, no payment) ---
  const generateEstimate = async () => {
    let finalCustomer = selectedCustomer;
    if (customerMode === "new" && newCustomerName.trim() && newCustomerPhone.trim()) {
      const newId = await addItem("customers", {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        email: newCustomerEmail.trim() || null,
        date_of_birth: newCustomerDob || null,
        address: newCustomerAddress.trim() || null,
        loyalty_points: 0,
        total_purchases: 0,
      });
      finalCustomer = { id: newId, name: newCustomerName.trim(), phone: newCustomerPhone.trim(), email: newCustomerEmail.trim() || null, date_of_birth: newCustomerDob || null, loyalty_points: 0, total_purchases: 0 };
    }
    const estimateNumber = `EST-${Date.now()}`;
    await addItem("sales", {
      invoice_number: estimateNumber,
      items: cart.map(item => ({ product_id: item.id, name: item.name, qty: item.qty, price: item.unit_price, calculated: item.calculatedPrice || false, purity: item.purity || null, metal_type: item.metal_type || null })),
      subtotal, tax, discount: totalDiscount, total,
      doc_type: "estimate",
      status: "Estimate",
      customer_id: finalCustomer?.id || null,
      customer_name: finalCustomer?.name || null,
      customer_phone: finalCustomer?.phone || null,
      gold_rate: goldRate,   // add this
      exchange_items: exchangeItems,
      gst_enabled: gstEnabled,
    });
    const printData = {
      invoice_number: estimateNumber,
      customer_name: finalCustomer?.name || (customerMode === "new" ? newCustomerName : "Walk-in Customer"),
      created_at: new Date().toISOString(),
      items: cart.map(item => ({ name: item.name, qty: item.qty, price: item.unit_price })),
      subtotal, tax, total,
    };
    setLastPrintData(printData);
    await tryPrint(printData);
    // Reset cart and form
    setCart([]);
    setSelectedCustomer(null);
    setBirthdayDiscountApplied(false);
    setBirthdayDiscountPercent(DEFAULT_BIRTHDAY_DISCOUNT);
    setImitationDiscountType("percent");
    setImitationDiscountValue(0);
    setExchangeItems([]);
    setShowCheckout(false);
    resetNewCustomerForm();
    toast.success(`Estimate ${estimateNumber} generated`);
  };

  const completeSaleMutation = useMutation({
    mutationFn: async () => {
      let finalCustomer = selectedCustomer;
      if (customerMode === "new" && newCustomerName.trim() && newCustomerPhone.trim()) {
        const newId = await addItem("customers", {
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          email: newCustomerEmail.trim() || null,
          date_of_birth: newCustomerDob || null,
          address: newCustomerAddress.trim() || null,
          loyalty_points: 0,
          total_purchases: 0,
        });
        finalCustomer = { id: newId, name: newCustomerName.trim(), phone: newCustomerPhone.trim(), email: newCustomerEmail.trim() || null, date_of_birth: newCustomerDob || null, loyalty_points: 0, total_purchases: 0 };
      }
      const invoiceNumber = `INV-${Date.now()}`;
      await addItem("sales", {
        invoice_number: invoiceNumber,
items: cart.map(item => ({ 
  product_id: item.id, 
  name: item.name, 
  qty: item.qty, 
  price: item.unit_price, 
  calculated: item.calculatedPrice || false, 
  purity: item.purity || null, 
  metal_type: item.metal_type || null,
  weight: item.weight || 0,
  making: (item.calculatedPrice ? (item.unit_price - (goldRate || 0) * item.weight) : 0) // approximate making
})),
        subtotal, tax, discount: totalDiscount, total,
        payment_method: paymentMethod,
        status: "Completed",
        customer_id: finalCustomer?.id || null,
        customer_name: finalCustomer?.name || null,
        customer_phone: finalCustomer?.phone || null,
        is_imitation_bill: isFullyImitation,
        birthday_offer_applied: birthdayDiscountApplied,
        discount_type: imitationDiscount > 0 ? imitationDiscountType : (birthdayDiscountApplied ? "percent" : null),
        discount_detail: JSON.stringify({ birthday: birthdayDiscount, imitation: imitationDiscount, birthday_percent: birthdayDiscountApplied ? birthdayDiscountPercent : 0, imitation_type: imitationDiscountType, imitation_value: imitationDiscountValue }),
        exchange_items: exchangeItems,
        paid_amount: amountPaid,
        pending_amount: total - amountPaid,
        payment_status: amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending',
        gst_enabled: gstEnabled,
        doc_type: "invoice",
      });
      for (const item of cart) {
        if (!item.id.startsWith("calc-")) await updateItem("products", item.id, { stock: item.stock - item.qty });
      }
      if (finalCustomer) {
        await updateItem("customers", finalCustomer.id, { total_purchases: (finalCustomer.total_purchases || 0) + total, ...(birthdayDiscountApplied ? { birthday_offer_sent: true, last_offer_date: new Date().toISOString() } : {}) });
      }
      return { invoiceNumber, finalCustomer };
    },
    onSuccess: async ({ invoiceNumber, finalCustomer }) => {
      queryClient.invalidateQueries({ queryKey: ["pos-products", "products", "sales", "customers"] });
      toast.success(`Sale completed! Invoice: ${invoiceNumber}`);
      createNotification({
        title: total >= 50000 ? "🔥 High Value Sale!" : "New Sale Completed",
        message: `₹${total.toLocaleString("en-IN")} sale completed. Invoice: ${invoiceNumber}`,
        type: "sales",
        priority: total >= 50000 ? "high" : "medium",
        action_url: "/bills",
      });
      const printData = {
        invoice_number: invoiceNumber,
        customer_name: finalCustomer?.name || (customerMode === "new" ? newCustomerName : "Walk-in Customer"),
        created_at: new Date().toISOString(),
        items: cart.map(item => ({ name: item.name, qty: item.qty, price: item.unit_price })),
        subtotal, tax, total,
      };
      setLastPrintData(printData);
      await tryPrint(printData);
      setCart([]);
      setSelectedCustomer(null);
      setBirthdayDiscountApplied(false);
      setBirthdayDiscountPercent(DEFAULT_BIRTHDAY_DISCOUNT);
      setImitationDiscountType("percent");
      setImitationDiscountValue(0);
      setExchangeItems([]);
      setShowCheckout(false);
      resetNewCustomerForm();
    },
    onError: (error) => toast.error("Failed to complete sale: " + error.message),
  });

  const resetNewCustomerForm = () => {
    setCustomerMode("search");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerDob("");
    setNewCustomerAddress("");
    setCustomerSearch("");
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.qty >= product.stock) { toast.error("Not enough stock"); return; }
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { id: product.id, name: product.name, weight: product.weight, unit_price: product.unit_price, stock: product.stock, qty: 1, sku: product.sku, metal_type: product.metal_type }]);
    }
    toast.success(`${product.name} added to cart`, { duration: 1000, position: 'top-right' });
  };

  const handleCalcAddToCart = useCallback((result: CalcResult) => {
    const product = products.find(p => p.id === result.productId);
    if (result.goldRate) setGoldRate(result.goldRate);
    if (product) {
      const existing = cart.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) { toast.error("Not enough stock"); return; }
        setCart(cart.map(item => item.id === product.id ? { ...item, unit_price: result.calculatedPrice, qty: item.qty + 1, calculatedPrice: true, purity: result.purity } : item));
      } else {
        setCart([...cart, { id: product.id, name: product.name, weight: result.weight, unit_price: result.calculatedPrice, stock: product.stock, qty: 1, sku: product.sku, calculatedPrice: true, purity: result.purity, metal_type: product.metal_type }]);
      }
    } else {
      setCart([...cart, { id: `calc-${Date.now()}`, name: result.productName, weight: result.weight, unit_price: result.calculatedPrice, stock: 9999, qty: 1, sku: "CUSTOM", calculatedPrice: true, purity: result.purity }]);
    }
    toast.success(`₹${result.calculatedPrice.toLocaleString()} added to bill!`);
  }, [cart, products]);

  const sendToCalculator = (product: Product) => {
    setCalcProduct({ id: product.id, name: product.name, weight: product.weight, metal_type: product.metal_type, unit_price: product.unit_price, sku: product.sku, stock: product.stock, category: product.category });
  };

  const handleAddExchangeItem = (item: ExchangeItem) => setExchangeItems([...exchangeItems, item]);

  const updateQty = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQty = item.qty + delta;
        if (newQty > item.stock) { toast.error("Not enough stock"); return item; }
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (productId: string) => setCart(cart.filter(item => item.id !== productId));

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c =>
      c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch) ||
      (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
    ).slice(0, 8)
    : [];

  return (
    <DashboardLayout>
      <div className="mb-6 animate-fade-in pt-2 sm:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">
              <span className="text-gradient-gold">{docType === "estimate" ? "New Estimate" : "New Sale"}</span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {docType === "estimate" ? "Generate a price estimate for customer" : "Complete customer sale with billing"}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant={docType === "estimate" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocType("estimate")}
                className="text-xs"
              >
                📄 Estimate
              </Button>
              <Button
                variant={docType === "invoice" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocType("invoice")}
                className="text-xs"
              >
                🧾 Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left column – unchanged (scanner, inventory, cart) */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Scanner / Search */}
          <Card variant="elevated">
            <CardHeader className="pb-3">
              <CardTitle>Scan / Search Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input ref={scanInputRef} placeholder="Scan barcode or type product name..." className="pl-10" />
              </div>
              <div className="mt-2">
                <CameraScanner onScan={handleBarcodeScan} />
              </div>
            </CardContent>
          </Card>
          {/* Inventory Table */}
          <Card variant="elevated">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" />Inventory<Badge variant="secondary" className="ml-2">{filteredProducts.length} products</Badge></CardTitle></CardHeader>
            <CardContent className="p-0">
              {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : filteredProducts.length === 0 ? <p className="text-center py-8 text-muted-foreground">No products found</p> : (
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-xs">Product</TableHead><TableHead className="text-xs">SKU</TableHead><TableHead className="text-xs text-center">Type</TableHead><TableHead className="text-xs text-center">Stock</TableHead><TableHead className="text-xs text-right">Price</TableHead><TableHead className="text-xs text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredProducts.slice(0, 50).map(product => {
                        const gold = isGoldProduct(product), imitation = isImitationProduct(product);
                        return (
                          <TableRow 
  key={product.id} 
  className="cursor-pointer hover:bg-muted/50" 
  onClick={() => needsCalculator(product) ? sendToCalculator(product) : addToCart(product)}
>
  {/* Product name cell – keep as is */}
  <TableCell className="py-2">
    <div className="flex items-center gap-2">
      {needsCalculator(product) && <Gem className="w-3.5 h-3.5 text-primary shrink-0" />}
      {isImitationProduct(product) && <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
      <span className="text-sm font-medium">{product.name}</span>
    </div>
  </TableCell>
  {/* SKU, Type, Stock, Price cells – unchanged */}
  <TableCell className="py-2 text-xs font-mono text-muted-foreground">{product.sku}</TableCell>
  <TableCell className="py-2 text-xs text-center">
    {isImitationProduct(product) ? 
      <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[9px]">Imitation</Badge> : 
      <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">{product.metal_type}</Badge>
    }
  </TableCell>
  <TableCell className="py-2 text-xs text-center">
    <Badge variant={product.stock <= 3 ? "destructive" : "secondary"} className="text-[10px]">{product.stock}</Badge>
  </TableCell>
  <TableCell className="py-2 text-sm font-semibold text-primary text-right">₹{product.unit_price.toLocaleString()}</TableCell>
  <TableCell className="py-2 text-right">
    {needsCalculator(product) ? (
      <Button variant="gold" size="sm" className="h-6 text-[10px] px-2" onClick={() => sendToCalculator(product)}>
        <Calculator className="w-3 h-3 mr-1" />Calc
      </Button>
    ) : (
      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addToCart(product)}>
        <Plus className="w-3 h-3 mr-1" />Add
      </Button>
    )}
  </TableCell>
</TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Cart */}
          <Card variant="elevated">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-primary" />Cart Items<Badge variant="secondary" className="ml-2">{cart.length} items</Badge>{hasImitationItems && <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[10px] ml-1"><Sparkles className="w-3 h-3 mr-0.5" />Imitation</Badge>}</CardTitle></CardHeader>
            <CardContent>
              {cart.length === 0 ? <p className="text-center py-8 text-muted-foreground">Cart is empty.</p> : (
                <div className="space-y-3">
                  {cart.map(item => {
                    const isImit = (item.name || "").toLowerCase().includes("imitation") || (item.name || "").toLowerCase().includes("artificial") || (item.name || "").toLowerCase().includes("fashion") || (item.metal_type || "").toLowerCase().includes("imitation");
                    return (
                      <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isImit ? "bg-purple-500/10" : "bg-primary/10"}`}>
                            {isImit ? <Sparkles className="w-4 h-4 text-purple-500" /> : item.calculatedPrice ? <Gem className="w-4 h-4 text-primary" /> : <ShoppingCart className="w-4 h-4 text-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate flex items-center gap-1.5">{item.name}{item.calculatedPrice && <Badge variant="outline" className="text-[9px]">{item.purity} Calc</Badge>}{isImit && <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[9px]">Imitation</Badge>}</p>
                            <p className="text-xs text-muted-foreground">Weight: {item.weight}g</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="flex items-center gap-2"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.id, -1)}><Minus className="w-3 h-3" /></Button><span className="w-6 text-center text-sm">{item.qty}</span><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.id, 1)}><Plus className="w-3 h-3" /></Button></div>
                          <p className="font-semibold text-primary text-sm w-20 text-right">₹{(item.unit_price * item.qty).toLocaleString()}</p>
                          <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeFromCart(item.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Right column: Gold calculator + Payment summary */}
        <div className="space-y-4">
          <Card variant="elevated">
            <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" />Gold Rate Calculator</CardTitle></CardHeader>
            <CardContent><GoldRateCalculator selectedProduct={calcProduct} onAddToCart={handleCalcAddToCart} onProductConsumed={() => setCalcProduct(null)} /></CardContent>
          </Card>
          <Card variant="gold">
            <CardHeader><CardTitle>Payment Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {selectedCustomer && (
                <div className={`p-3 rounded-lg border ${isBirthday ? "border-pink-500/30 bg-pink-500/5" : "border-border/50 bg-muted/30"}`}>
                  <div className="flex justify-between"><div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/20 text-primary text-xs">{selectedCustomer.name?.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar><div><p className="text-sm font-semibold">{selectedCustomer.name} {isBirthday && <Cake className="w-3.5 h-3.5 text-pink-500 inline" />}</p><p className="text-[11px] text-muted-foreground"><Phone className="w-3 h-3 inline" />{selectedCustomer.phone}</p></div></div><Button variant="ghost" size="sm" onClick={() => { setSelectedCustomer(null); setBirthdayDiscountApplied(false); }}>Change</Button></div>
                  {isBirthday && cart.length > 0 && (
                    <div className="mt-2 p-2 rounded-md bg-gradient-to-r from-pink-500/10 to-orange-400/10 border border-pink-500/20">
                      <p className="text-xs font-semibold text-pink-600 mb-1">🎉 Today is {selectedCustomer.name}'s Birthday!</p>
                      {!birthdayDiscountApplied ? (
                        <div className="flex items-center gap-2"><Input type="number" min={1} max={50} value={birthdayDiscountPercent} onChange={(e) => setBirthdayDiscountPercent(Number(e.target.value))} className="h-7 w-16 text-xs" /><span className="text-xs">%</span><Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setBirthdayDiscountApplied(true); toast.success(`Birthday ${birthdayDiscountPercent}% discount applied!`); }}><Gift className="w-3 h-3" /> Apply</Button></div>
                      ) : <div className="flex justify-between text-xs"><span><Gift className="w-3 h-3 inline" />Birthday Discount ({birthdayDiscountPercent}%) = -₹{birthdayDiscount.toLocaleString()}</span><Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setBirthdayDiscountApplied(false)}>Remove</Button></div>}
                    </div>
                  )}
                </div>
              )}
              {hasImitationItems && cart.length > 0 && (
                <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
                  <p className="text-xs font-semibold text-purple-600 mb-2"><Sparkles className="w-3.5 h-3.5 inline" /> Imitation Discount</p>
                  <div className="flex items-center gap-2 mb-2"><Select value={imitationDiscountType} onValueChange={(v: "percent" | "flat") => { setImitationDiscountType(v); setImitationDiscountValue(0); }}><SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">%</SelectItem><SelectItem value="flat">Flat ₹</SelectItem></SelectContent></Select><div className="flex-1 flex items-center gap-1">{imitationDiscountType === "flat" && <span className="text-xs">₹</span>}<Input type="number" min={0} value={imitationDiscountValue} onChange={(e) => setImitationDiscountValue(Number(e.target.value))} className="h-7 text-xs" />{imitationDiscountType === "percent" && <span className="text-xs">%</span>}</div></div>
                  {imitationDiscount > 0 && <p className="text-[11px] text-purple-600">Discount: -₹{imitationDiscount.toLocaleString()}</p>}
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>GST (3%)</span><span>₹{tax.toLocaleString()}</span></div>
                {birthdayDiscount > 0 && <div className="flex justify-between"><span>Birthday Discount</span><span className="text-green-500">-₹{birthdayDiscount.toLocaleString()}</span></div>}
                {imitationDiscount > 0 && <div className="flex justify-between"><span>Imitation Discount</span><span className="text-green-500">-₹{imitationDiscount.toLocaleString()}</span></div>}
                <Card variant="elevated" className="mt-4">
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gem className="w-4 h-4 text-primary" />Old Jewellery Exchange</CardTitle></CardHeader>
                  <CardContent>
                    {exchangeItems.length === 0 ? <div className="text-center py-4 text-muted-foreground text-sm">No exchange items added.</div> : <div className="space-y-2">{exchangeItems.map(item => <ExchangeItemComponent key={item.id} item={item} onRemove={(id) => setExchangeItems(exchangeItems.filter(i => i.id !== id))} />)}</div>}
                    <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setExchangeModalOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" />Add Exchange Item</Button>
                  </CardContent>
                </Card>
                <div className="border-t pt-2 mt-2"><div className="flex justify-between font-bold"><span>Total</span><span className="text-gradient-gold">₹{total.toLocaleString()}</span></div></div>
                {/* GST Toggle */}
                {docType === "invoice" && (
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="gstToggle" checked={invoiceGstEnabled} onChange={(e) => setInvoiceGstEnabled(e.target.checked)} className="w-4 h-4 rounded" />
                      <Label htmlFor="gstToggle" className="text-sm cursor-pointer">Apply GST (3%)</Label>
                    </div>
                    <span className="text-sm font-mono">{invoiceGstEnabled ? `+ ₹${tax.toLocaleString()}` : 'Exempt'}</span>
                  </div>
                )}
                {/* Amount Paid Today (only for invoices) */}
                {docType === "invoice" && (
                  <div className="space-y-2 pt-3">
                    <Label className="text-sm">Amount Paid Today</Label>
                    <Input type="number" step="100" value={amountPaid} onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value)))} className="text-right font-medium" />
                    {amountPaid < total && <p className="text-xs text-amber-600">Pending: ₹{(total - amountPaid).toLocaleString()}</p>}
                  </div>
                )}
              </div>
              {docType === "invoice" && (
                <div className="space-y-2 pt-4">
                  <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant={paymentMethod === "Cash" ? "default" : "outline"} className="flex-col h-14 gap-1" onClick={() => setPaymentMethod("Cash")}><Banknote className="w-4 h-4" /><span className="text-xs">Cash</span></Button>
                    <Button variant={paymentMethod === "Card" ? "default" : "outline"} className="flex-col h-14 gap-1" onClick={() => setPaymentMethod("Card")}><CreditCard className="w-4 h-4" /><span className="text-xs">Card</span></Button>
                    <Button variant={paymentMethod === "UPI" ? "default" : "outline"} className="flex-col h-14 gap-1" onClick={() => setPaymentMethod("UPI")}><Smartphone className="w-4 h-4" /><span className="text-xs">UPI</span></Button>
                  </div>
                </div>
              )}
              <Button variant="gold" className="w-full mt-4" size="lg"
                disabled={cart.length === 0 || completeSaleMutation.isPending}
                onClick={docType === "estimate" ? generateEstimate : () => setShowCheckout(true)}>
                {docType === "estimate" ? "Generate Estimate" : `Complete Sale — ₹${total.toLocaleString()}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={(open) => { setShowCheckout(open); if (!open) resetNewCustomerForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" />Customer Details & Checkout</DialogTitle><DialogDescription>Add customer details to generate the bill under their name.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {!selectedCustomer && (
              <div className="grid grid-cols-3 gap-2">
                <Button variant={customerMode === "search" ? "default" : "outline"} size="sm" onClick={() => setCustomerMode("search")}><Search className="w-3.5 h-3.5" />Existing</Button>
                <Button variant={customerMode === "new" ? "default" : "outline"} size="sm" onClick={() => setCustomerMode("new")}><UserPlus className="w-3.5 h-3.5" />New Customer</Button>
                <Button variant={customerMode === "walkin" ? "default" : "outline"} size="sm" onClick={() => setCustomerMode("walkin")}><User className="w-3.5 h-3.5" />Walk-in</Button>
              </div>
            )}
            {/* Search Existing Customer */}
            {!selectedCustomer && customerMode === "search" && (
              <div className="space-y-3">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by name or phone number..." className="pl-10" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} autoFocus /></div>
                {customerSearch.trim() && (
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2 bg-muted/20">
                    {filteredCustomers.length === 0 ? <div className="text-center py-4"><p className="text-xs text-muted-foreground">No customers found for "{customerSearch}"</p><Button variant="link" size="sm" className="text-xs mt-1" onClick={() => { setCustomerMode("new"); setNewCustomerPhone(customerSearch.replace(/\D/g, "")); }}>+ Add as new customer</Button></div> : filteredCustomers.map(c => {
                      const bday = isTodayBirthday(c.date_of_birth);
                      return <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}><Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/15 text-primary text-[10px]">{c.name?.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar><div className="flex-1"><p className="text-sm font-medium">{c.name} {bday && <Cake className="w-3.5 h-3.5 text-pink-500 inline" />}</p><p className="text-xs text-muted-foreground"><Phone className="w-3 h-3" />{c.phone}</p></div>{bday && <Badge className="bg-gradient-to-r from-pink-500 to-orange-400 text-white text-[9px] px-1.5">🎂 Birthday</Badge>}</div>;
                    })}
                  </div>
                )}
              </div>
            )}
            {/* New Customer Form */}
            {!selectedCustomer && customerMode === "new" && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/10">
                <p className="text-xs font-semibold uppercase">New Customer Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Name *</Label><Input placeholder="Customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} autoFocus /></div>
                  <div><Label className="text-xs">Phone *</Label><Input placeholder="Phone number" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} type="tel" maxLength={10} /></div>
                  <div><Label className="text-xs">Email</Label><Input placeholder="Email (optional)" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} type="email" /></div>
                  <div><Label className="text-xs">Date of Birth</Label><Input type="date" value={newCustomerDob} onChange={(e) => setNewCustomerDob(e.target.value)} /></div>
                </div>
                <div><Label className="text-xs">Address</Label><Input placeholder="Address (optional)" value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} /></div>
              </div>
            )}
            {!selectedCustomer && customerMode === "walkin" && <div className="p-4 rounded-lg border text-center"><User className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm font-medium">Walk-in Customer</p><p className="text-xs text-muted-foreground mt-1">Bill will be generated without customer details</p></div>}
            {selectedCustomer && (
              <div className={`p-3 rounded-lg border ${isBirthday ? "border-pink-500/30 bg-pink-500/5" : "border-border/50 bg-muted/30"}`}>
                <div className="flex justify-between"><div className="flex items-center gap-3"><Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/20 text-primary text-xs">{selectedCustomer.name?.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar><div><p className="text-sm font-semibold">{selectedCustomer.name} {isBirthday && <Badge className="bg-gradient-to-r from-pink-500 to-orange-400 text-white text-[10px]"><Cake className="w-3 h-3 mr-0.5" />Birthday!</Badge>}</p><p className="text-xs text-muted-foreground"><Phone className="w-3 h-3" />{selectedCustomer.phone} {selectedCustomer.email && <><span>•</span><Mail className="w-3 h-3" />{selectedCustomer.email}</>}</p><p className="text-[10px] text-muted-foreground">Total: ₹{(selectedCustomer.total_purchases || 0).toLocaleString()} • Points: {selectedCustomer.loyalty_points || 0}</p></div></div><Button variant="ghost" size="sm" onClick={() => { setSelectedCustomer(null); setCustomerMode("search"); }}>Change</Button></div>
                {isBirthday && !birthdayDiscountApplied && cart.length > 0 && (
                  <div className="mt-2 p-2 rounded-md bg-gradient-to-r from-pink-500/10 to-orange-400/10 border">
                    <p className="text-xs font-semibold text-pink-600 mb-1.5">🎉 Birthday Discount</p>
                    <div className="flex items-center gap-2"><Input type="number" min={1} max={50} value={birthdayDiscountPercent} onChange={(e) => setBirthdayDiscountPercent(Number(e.target.value))} className="h-7 w-16 text-xs" /><span className="text-xs">%</span><Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setBirthdayDiscountApplied(true); toast.success(`Birthday ${birthdayDiscountPercent}% discount applied!`); }}><Gift className="w-3 h-3" />Apply</Button></div>
                  </div>
                )}
                {birthdayDiscountApplied && (
                  <div className="flex justify-between text-xs p-2 rounded-md bg-pink-500/10 border mt-2"><span><Gift className="w-3 h-3 inline" />Birthday Discount ({birthdayDiscountPercent}%) = -₹{birthdayDiscount.toLocaleString()}</span><Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setBirthdayDiscountApplied(false)}>Remove</Button></div>
                )}
              </div>
            )}
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="text-xs font-semibold uppercase mb-2">Bill Summary</p>
              {cart.map(item => <div key={item.id} className="flex justify-between text-xs"><span className="truncate mr-2">{item.name} × {item.qty}</span><span>₹{(item.unit_price * item.qty).toLocaleString()}</span></div>)}
              <div className="border-t pt-1.5 mt-1.5 space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                {docType === "invoice" && (
                  <div className="flex justify-between"><span>GST (3%)</span><span>₹{tax.toLocaleString()}</span></div>
                )}
                {birthdayDiscount > 0 && <div className="flex justify-between text-sm"><span>Birthday</span><span className="text-green-500">-₹{birthdayDiscount.toLocaleString()}</span></div>}
                {imitationDiscount > 0 && <div className="flex justify-between text-sm"><span>Discount</span><span className="text-green-500">-₹{imitationDiscount.toLocaleString()}</span></div>}
              </div>
              <div className="border-t pt-2 mt-1"><div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-primary">₹{total.toLocaleString()}</span></div></div>
              <p className="text-[11px] text-muted-foreground">Payment: {paymentMethod} {selectedCustomer ? ` • ${selectedCustomer.name}` : customerMode === "new" && newCustomerName ? ` • ${newCustomerName}` : " • Walk-in"}{isFullyImitation && " • Imitation Bill"}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCheckout(false)}>Cancel</Button>
            <Button variant="gold" disabled={completeSaleMutation.isPending || (customerMode === "new" && (!newCustomerName.trim() || !newCustomerPhone.trim()))} onClick={() => completeSaleMutation.mutate()}>{completeSaleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Confirm & Generate Bill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExchangeModal open={exchangeModalOpen} onOpenChange={setExchangeModalOpen} onAddItem={handleAddExchangeItem} />
    </DashboardLayout>
  );
};

export default POS;