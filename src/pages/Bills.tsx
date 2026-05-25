import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Search, Eye, IndianRupee, ShoppingBag, Calendar, Printer, Download, MessageCircle, Gem, Sparkles, Edit2, Trash2, Save, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserData } from "@/hooks/useUserData";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { type ExchangeItem } from "@/components/pos/ExchangeItem";
import { generateReceiptHTML, printViaBrowser, type ReceiptData } from "@/lib/receiptUtils";

interface SaleItem {
  name: string;
  qty: number;
  unit_price: number;
  price?: number;
  weight?: number;
  purity?: string;
  making?: number;
}

interface Sale {
  id: string;
  invoice_number: string;
  customer_name?: string;
  customer_phone?: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
  paid_amount?: number;
  pending_amount?: number;
  payment_status?: string;
  doc_type?: "estimate" | "invoice";
  exchange_items?: ExchangeItem[];
  gold_rate?: number;
}

function isImitationSale(sale: Sale & { is_imitation_bill?: boolean }): boolean {
  if (sale.is_imitation_bill) return true;
  const items = Array.isArray(sale.items) ? sale.items : [];
  return items.some((item) => {
    const name = (item.name || "").toLowerCase();
    return name.includes("imitation") || name.includes("artificial") || name.includes("fashion");
  });
}

const Bills = () => {
  const { getAll, updateItem, deleteItem } = useUserData();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState<Sale | null>(null);
  const [editingBill, setEditingBill] = useState<Sale | null>(null);
  const [deletingBill, setDeletingBill] = useState<Sale | null>(null);
  const [editData, setEditData] = useState({ customer_name: "", payment_method: "", discount: 0 });
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const formatCurrencyPlain = (value: number) => `₹${value.toLocaleString("en-IN")}`;

  const generateBillText = (sale: Sale) => {
    const items = Array.isArray(sale.items) ? sale.items : [];
    const exchangeTotal = (sale.exchange_items || []).reduce((sum, ex) => sum + ex.value, 0);
    const pending = sale.pending_amount || 0;
    const goldRate = sale.gold_rate || 0;
    const isInvoice = sale.doc_type !== "estimate";

    let text = `🏷️ *${isInvoice ? "INVOICE" : "ESTIMATE"}* #${sale.invoice_number}\n\n`;
    text += `👤 Customer: ${sale.customer_name || "Walk-in"}\n`;
    text += `📅 Date: ${format(new Date(sale.created_at), "dd MMM yyyy, hh:mm a")}\n`;
    text += `💳 Payment: ${sale.payment_method || "N/A"}\n`;
    if (goldRate) text += `✨ Gold Rate: ₹${goldRate}/g\n`;
    text += `\n📋 *Items:*\n`;

    items.forEach(item => {
      const amount = (item.unit_price || item.price || 0) * (item.qty || 1);
      const weight = item.weight ? ` (${item.weight}g)` : "";
      const making = item.making ? ` making ₹${item.making}` : "";
      text += `• ${item.name}${weight} x${item.qty}${making} = ${formatCurrencyPlain(amount)}\n`;
    });

    if (sale.exchange_items && sale.exchange_items.length > 0) {
      text += `\n🔄 *Exchange:*\n`;
      sale.exchange_items.forEach(ex => {
        text += `  ${ex.description} (${ex.weight}g) -₹${ex.value.toLocaleString()}\n`;
      });
    }

    text += `\n💰 *Totals:*\n`;
    text += `Subtotal: ${formatCurrencyPlain(sale.subtotal || 0)}\n`;
    text += `GST (3%): ${formatCurrencyPlain(sale.tax || 0)}\n`;
    if (sale.discount > 0) text += `Discount: -${formatCurrencyPlain(sale.discount)}\n`;
    if (exchangeTotal > 0) text += `Exchange deduction: -${formatCurrencyPlain(exchangeTotal)}\n`;
    text += `*Total: ${formatCurrencyPlain(sale.total || 0)}*\n`;
    if (pending > 0) text += `⚠️ Pending: ${formatCurrencyPlain(pending)}\n`;

    if (isInvoice && sale.paid_amount) {
      text += `\n💵 *Payment received:* ${formatCurrencyPlain(sale.paid_amount)}\n`;
    }

    text += `\nThank you for shopping at Rajlakshmi Jewellers!`;
    return text;
  };

  const handleWhatsAppShare = (sale: Sale) => {
    const text = generateBillText(sale);
    let phone = sale.customer_phone?.replace(/\D/g, "");
    if (phone && phone.length >= 10) {
      if (!phone.startsWith("91")) phone = "91" + phone;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      toast.info("Customer phone not available. Please search manually.");
    }
  };

  const handleExport = (sale: Sale) => {
    const text = generateBillText(sale).replace(/\*/g, "");
    const safeCustomer = (sale.customer_name || "Walk-in").replace(/[^a-z0-9]/gi, "_");
    const fileName = `${sale.doc_type === "estimate" ? "ESTIMATE" : "INVOICE"}_${sale.invoice_number}_${safeCustomer}.txt`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully!");
  };

  // Improved gold rate detection (supports 22K, 24K, etc.)
  const getGoldRateFromItems = (items: SaleItem[]): number => {
    for (const item of items) {
      const name = (item.name || "").toLowerCase();
      if (name.includes("gold") || name.includes("24k") || name.includes("22k") || name.includes("18k") || name.includes("14k")) {
        if (item.weight && item.price && item.weight > 0) {
          return Math.round(item.price / item.weight);
        }
      }
    }
    return 0;
  };

  const handlePrint = () => {
    if (!selectedBill) return;

    let goldRate = selectedBill.gold_rate || 0;
    if (!goldRate && selectedBill.items) {
      goldRate = getGoldRateFromItems(selectedBill.items);
    }

    const receiptData: ReceiptData = {
      invoiceNumber: selectedBill.invoice_number,
      customerName: selectedBill.customer_name || "Walk-in",
      items: (selectedBill.items || []).map(item => ({
        name: item.name,
        qty: item.qty,
        price: item.unit_price || item.price || 0,
        weight: item.weight,
        purity: item.purity,
        making: item.making || 0,
      })),
      subtotal: selectedBill.subtotal || 0,
      tax: selectedBill.tax || 0,
      total: selectedBill.total || 0,
      docType: selectedBill.doc_type === "estimate" ? "estimate" : "invoice",
      goldRate: goldRate,
      exchangeItems: selectedBill.exchange_items || [],
      paymentBreakdown: {
        cash: selectedBill.payment_method === "Cash" ? (selectedBill.paid_amount || selectedBill.total) : 0,
        card: selectedBill.payment_method === "Card" ? (selectedBill.paid_amount || 0) : 0,
        cheque: 0,
        online: selectedBill.payment_method === "UPI" ? (selectedBill.paid_amount || 0) : 0,
      },
      netPayable: selectedBill.total,
    };
    printViaBrowser(receiptData);
  };

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: () => getAll("sales") as Promise<Sale[]>,
  });

  const updateBillMutation = useMutation({
    mutationFn: async () => {
      if (!editingBill) return;
      const subtotal = (Array.isArray(editingBill.items) ? editingBill.items : []).reduce((s, i) => s + (i.unit_price || i.price || 0) * (i.qty || 1), 0);
      const tax = Math.round(subtotal * 0.03);
      const total = subtotal + tax - (editData.discount || 0);
      await updateItem("sales", editingBill.id, {
        customer_name: editData.customer_name || null,
        payment_method: editData.payment_method,
        discount: editData.discount || 0,
        subtotal, tax, total,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Bill updated successfully!");
      setEditingBill(null);
    },
    onError: (e) => toast.error("Failed to update: " + e.message),
  });

  const deleteBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      await deleteItem("sales", billId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Bill deleted successfully!");
      setDeletingBill(null);
      setSelectedBill(null);
    },
    onError: (e) => toast.error("Failed to delete: " + e.message),
  });

  const startEditing = (sale: Sale) => {
    setEditData({
      customer_name: sale.customer_name || "",
      payment_method: sale.payment_method || "Cash",
      discount: sale.discount || 0,
    });
    setEditingBill(sale);
  };

  const convertEstimateToInvoice = (estimate: Sale) => {
    localStorage.setItem("convertEstimate", JSON.stringify(estimate));
    navigate("/pos?mode=convert");
  };

  const allDocs = sales.filter(s => s.status === "Completed" || s.status === "Estimate");
  const invoices = allDocs.filter(s => s.doc_type === "invoice" || (!s.doc_type && s.status === "Completed"));
  const estimates = allDocs.filter(s => s.doc_type === "estimate");

  const filterList = (list: Sale[]) => {
    const q = searchQuery.toLowerCase();
    return list.filter(s =>
      s.invoice_number?.toLowerCase().includes(q) ||
      s.customer_name?.toLowerCase().includes(q) ||
      s.payment_method?.toLowerCase().includes(q)
    );
  };

  const totalRevenue = invoices.reduce((sum, s) => sum + (s.total || 0), 0);
  const imitationRevenue = invoices.filter(isImitationSale).reduce((sum, s) => sum + (s.total || 0), 0);
  const todaySales = invoices.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);

  const renderTable = (list: Sale[], showPending = false) => {
    const filtered = filterList(list);
    if (filtered.length === 0) {
      return <div className="text-center py-12 text-muted-foreground">No records found.</div>;
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden sm:table-cell">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {showPending && <TableHead className="text-right">Pending</TableHead>}
              <TableHead className="hidden md:table-cell">Payment</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => {
              const items = Array.isArray(doc.items) ? doc.items : [];
              const pending = doc.pending_amount || 0;
              return (
                <TableRow key={doc.id}>
                  <TableCell className="font-mono font-medium text-primary">{doc.invoice_number}</TableCell>
                  <TableCell>{doc.customer_name || "Walk-in"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{items.length} item(s)</TableCell>
                  <TableCell className="text-right font-semibold">₹{(doc.total || 0).toLocaleString()}</TableCell>
                  {showPending && <TableCell className="text-right text-amber-600">{pending > 0 ? `₹${pending.toLocaleString()}` : '-'}</TableCell>}
                  <TableCell className="hidden md:table-cell"><Badge variant="outline">{doc.payment_method || "N/A"}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                    {doc.created_at ? format(new Date(doc.created_at), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedBill(doc)} title="View"><Eye className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => startEditing(doc)} title="Edit"><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingBill(doc)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hidden sm:flex" onClick={() => handleWhatsAppShare(doc)} title="WhatsApp"><MessageCircle className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hidden sm:flex" onClick={() => handleExport(doc)} title="Export"><Download className="w-3.5 h-3.5" /></Button>
                      {doc.doc_type === "estimate" && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => convertEstimateToInvoice(doc)} title="Convert to Invoice">Convert</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div><h1 className="text-2xl font-bold">Bills & Estimates</h1><p className="text-muted-foreground text-sm">Manage invoices and estimates</p></div>
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Invoices</p><p className="text-2xl font-bold">{invoices.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Today's Revenue</p><p className="text-2xl font-bold">₹{todayRevenue.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Estimates</p><p className="text-2xl font-bold">{estimates.length}</p></CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <div className="text-center py-12">Loading...</div> : (
              <Tabs defaultValue="invoices">
                <TabsList className="mb-4">
                  <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
                  <TabsTrigger value="estimates">Estimates ({estimates.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="invoices">{renderTable(invoices, true)}</TabsContent>
                <TabsContent value="estimates">{renderTable(estimates, false)}</TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedBill} onOpenChange={() => setSelectedBill(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedBill?.doc_type === "estimate" ? "Estimate" : "Invoice"} {selectedBill?.invoice_number}</DialogTitle></DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div ref={printRef}>
                <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #c8a45a", paddingBottom: 10 }}>
                  <h1 style={{ fontSize: 18, margin: 0, color: "#c8a45a" }}>
                    {selectedBill.doc_type === "estimate" ? "ESTIMATE" : "INVOICE"}
                  </h1>
                  <p style={{ fontSize: 12 }}>{selectedBill.invoice_number}</p>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{selectedBill.customer_name || "Walk-in"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{selectedBill.created_at ? format(new Date(selectedBill.created_at), "dd MMM yyyy, hh:mm a") : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span>{selectedBill.payment_method || "N/A"}</span></div>
                  {(selectedBill.gold_rate || (selectedBill.items && getGoldRateFromItems(selectedBill.items) > 0)) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gold Rate</span>
                      <span>₹{(selectedBill.gold_rate || getGoldRateFromItems(selectedBill.items))}/g</span>
                    </div>
                  )}
                  {selectedBill.payment_status && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Status</span>
                      <Badge variant={selectedBill.payment_status === 'paid' ? 'default' : 'secondary'}>{selectedBill.payment_status}</Badge>
                    </div>
                  )}
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", margin: "12px 0" }}>
                  <thead><tr style={{ borderBottom: "2px solid #ddd" }}><th style={{ textAlign: "left", padding: "6px 4px" }}>Item</th><th style={{ textAlign: "center", padding: "6px 4px" }}>Qty</th><th style={{ textAlign: "right", padding: "6px 4px" }}>Amount</th></tr></thead>
                  <tbody>
                    {(Array.isArray(selectedBill.items) ? selectedBill.items : []).map((item, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "6px 4px" }}>{item.name}</td>
                        <td style={{ textAlign: "center", padding: "6px 4px" }}>{item.qty}</td>
                        <td style={{ textAlign: "right", padding: "6px 4px" }}>₹{((item.unit_price || item.price || 0) * (item.qty || 1)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {selectedBill.exchange_items && selectedBill.exchange_items.length > 0 && (
                  <div className="border p-2 rounded-md bg-muted/20 my-2">
                    <p className="text-xs font-semibold mb-1">💰 Old Jewellery Exchange</p>
                    {selectedBill.exchange_items.map((ex, idx) => (
                      <div key={idx} className="text-xs flex justify-between">
                        <span>{ex.description} ({ex.weight}g, {ex.purity})</span>
                        <span className="text-destructive">-₹{ex.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>₹{(selectedBill.subtotal || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Tax (3%)</span><span>₹{(selectedBill.tax || 0).toLocaleString()}</span></div>
                  {(selectedBill.discount || 0) > 0 && (<div className="flex justify-between"><span>Discount</span><span className="text-destructive">-₹{(selectedBill.discount || 0).toLocaleString()}</span></div>)}
                  {selectedBill.pending_amount && selectedBill.pending_amount > 0 && (<div className="flex justify-between text-amber-600"><span>Pending</span><span>₹{selectedBill.pending_amount.toLocaleString()}</span></div>)}
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span className="text-primary">₹{(selectedBill.total || 0).toLocaleString()}</span></div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />Print</Button>
                <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleWhatsAppShare(selectedBill)}><MessageCircle className="w-4 h-4 mr-1" />WhatsApp</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport(selectedBill)}><Download className="w-4 h-4 mr-1" />Export</Button>
                <Button variant="outline" size="sm" className="text-blue-600" onClick={() => { setSelectedBill(null); startEditing(selectedBill); }}><Edit2 className="w-4 h-4 mr-1" />Edit</Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setSelectedBill(null); setDeletingBill(selectedBill); }}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBill} onOpenChange={() => setEditingBill(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit {editingBill?.doc_type === "estimate" ? "Estimate" : "Bill"} — {editingBill?.invoice_number}</DialogTitle></DialogHeader>
          {editingBill && (
            <div className="space-y-4">
              <div><Label>Customer Name</Label><Input value={editData.customer_name} onChange={(e) => setEditData({ ...editData, customer_name: e.target.value })} placeholder="Walk-in" /></div>
              <div><Label>Payment Method</Label><Select value={editData.payment_method} onValueChange={(v) => setEditData({ ...editData, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="Card">Card</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem></SelectContent></Select></div>
              <div><Label>Discount (₹)</Label><Input type="number" min={0} value={editData.discount} onChange={(e) => setEditData({ ...editData, discount: Number(e.target.value) })} /></div>
              <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setEditingBill(null)}>Cancel</Button><Button variant="gold" className="flex-1" disabled={updateBillMutation.isPending} onClick={() => updateBillMutation.mutate()}>{updateBillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingBill} onOpenChange={() => setDeletingBill(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deletingBill?.doc_type === "estimate" ? "Estimate" : "Bill"}?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete <span className="font-semibold">{deletingBill?.invoice_number}</span>? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive" disabled={deleteBillMutation.isPending} onClick={(e) => { e.preventDefault(); if (deletingBill) deleteBillMutation.mutate(deletingBill.id); }}>{deleteBillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Bills;