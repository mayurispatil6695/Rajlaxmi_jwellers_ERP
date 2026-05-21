import { useState ,useMemo} from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Plus, Filter, Download, Loader2, QrCode, Pencil, Trash2, MoreHorizontal, Upload } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserData } from "@/hooks/useUserData";
import { useNotifications } from "@/hooks/useNotifications";
import { ProductBarcodeDialog, generateBarcode } from "@/components/inventory/ProductBarcode";
import * as XLSX from "xlsx";
import { StockAdjustment } from "@/components/inventory/StockAdjustment";

interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  metal_type: string;
  weight: number;
  stock: number;
  purchase_price: number;
  unit_price: number;
  status: string;
}

interface ExcelProductRow {
  "Product Name"?: string;
  name?: string;
  SKU?: string;
  sku?: string;
  Category?: string;
  category?: string;
  "Metal Type"?: string;
  metal_type?: string;
  "Weight (g)"?: string | number;
  weight?: string | number;
  Stock?: string | number;
  stock?: string | number;
  "Selling Price"?: string | number;
  unit_price?: string | number;
  "Cost Price"?: string | number;
  purchase_price?: string | number;
}

const emptyForm = { name: "", category: "Necklace", metal_type: "Gold 22K", weight: "", stock: "", purchase_price: "", unit_price: "" };

const Inventory = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [metalFilter, setMetalFilter] = useState<string>("all");
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  // Bulk upload states
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  
  const queryClient = useQueryClient();
  const { getAll, addItem, updateItem, deleteItem } = useUserData();
  const { createNotification } = useNotifications();

  const { data: products = [], isLoading } = useQuery({
  queryKey: ["products"],
  queryFn: () => getAll<Product>("products"),  // 👈 shared = true
});

  // Export to Excel
  const exportToExcel = () => {
    const exportData = products.map(p => ({
      "Product Name": p.name,
      SKU: p.sku,
      Barcode: p.barcode,
      Category: p.category,
      "Metal Type": p.metal_type,
      "Weight (g)": p.weight,
      "Selling Price": p.unit_price,
      "Cost Price": p.purchase_price || "",
      Stock: p.stock,
      Status: p.status,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, `inventory-${new Date().toISOString()}.xlsx`);
    toast.success("Inventory exported successfully");
  };

  // Bulk upload handler – no `any`
  const handleBulkUpload = async () => {
  if (!bulkFile) return;

  const fileName = bulkFile.name.toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
    toast.error('Please upload a valid Excel (.xlsx, .xls) or CSV file');
    return;
  }

  setBulkLoading(true);
  setBulkResults({ success: 0, failed: 0 });

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = e.target?.result;
    if (!data) {
      toast.error('Failed to read file');
      setBulkLoading(false);
      return;
    }

    try {
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ExcelProductRow>(sheet);

      let success = 0, failed = 0;
      for (const row of rows) {
        // ... your existing validation and insertion code
      
        try {
          // Extract values with fallbacks
          const name = row["Product Name"] || row.name;
          const sku = row["SKU"] || row.sku;
          const category = row["Category"] || row.category;
          const metal_type = row["Metal Type"] || row.metal_type;
          const weight = typeof (row["Weight (g)]"] ?? row.weight) === "number"
            ? (row["Weight (g)"] ?? row.weight) as number
            : parseFloat(String(row["Weight (g)"] ?? row.weight ?? ""));
          const stock = typeof (row.Stock ?? row.stock) === "number"
            ? (row.Stock ?? row.stock) as number
            : parseInt(String(row.Stock ?? row.stock ?? ""), 10);
          const unit_price = typeof (row["Selling Price"] ?? row.unit_price) === "number"
            ? (row["Selling Price"] ?? row.unit_price) as number
            : parseFloat(String(row["Selling Price"] ?? row.unit_price ?? ""));
          const purchase_price = typeof (row["Cost Price"] ?? row.purchase_price) === "number"
            ? (row["Cost Price"] ?? row.purchase_price) as number
            : parseFloat(String(row["Cost Price"] ?? row.purchase_price ?? ""));

          if (!name || !sku || isNaN(weight) || isNaN(stock) || isNaN(unit_price)) {
            failed++;
            continue;
          }

          const barcode = generateBarcode(metal_type);
          const metalPrefix = metal_type?.replace(/\s/g, "").substring(0, 3).toUpperCase() || "GEN";
          const finalSku = sku || `${metalPrefix}-${Date.now().toString(36).toUpperCase()}`;
          const status = stock === 0 ? "Out of Stock" : stock <= 5 ? "Low Stock" : "In Stock";
          const isImitation = metal_type === "Imitation";

          await addItem("products", {
            sku: finalSku,
            barcode,
            name,
            category: category || "Other",
            metal_type: metal_type || "Gold 22K",
            weight,
            stock,
            purchase_price: isImitation ? purchase_price : 0,
            unit_price,
            status,
          });
          success++;
        } catch (err) {
          console.error("Bulk upload row error", err);
          failed++;
        }
      }
      
      setBulkResults({ success, failed });
      toast.success(`Upload complete: ${success} added, ${failed} failed`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setBulkOpen(false);
      setBulkFile(null);
    } catch (err) {
      console.error("Error parsing file:", err);
      toast.error('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
    } finally {
      setBulkLoading(false);
    }
  };
  reader.readAsArrayBuffer(bulkFile);
};
  const addProductMutation = useMutation({
    mutationFn: async (newProduct: Omit<Product, "id">) => addItem("products", newProduct),
    onSuccess: (_id, newProduct) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product added successfully!");
      createNotification({
        title: "New Stock Added",
        message: `${newProduct.name} has been added to inventory.`,
        type: "inventory",
        priority: "low",
      });
      if (newProduct.stock <= 5) {
        createNotification({
          title: "⚠️ Low Stock Alert",
          message: `${newProduct.name} has only ${newProduct.stock} units in stock.`,
          type: "inventory",
          priority: "high",
        });
      }
      setIsDialogOpen(false);
      setFormData(emptyForm);
    },
    onError: (error) => toast.error("Failed to add product: " + error.message),
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<Product, "id">> }) => updateItem("products", id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      toast.success("Product updated!");
      setEditProduct(null);
      setFormData(emptyForm);
    },
    onError: (error) => toast.error("Failed to update: " + error.message),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => deleteItem("products", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      toast.success("Product deleted!");
      setDeleteConfirm(null);
    },
    onError: (error) => toast.error("Failed to delete: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stock = parseInt(formData.stock, 10);
    const status = stock === 0 ? "Out of Stock" : stock <= 5 ? "Low Stock" : "In Stock";
    const isImitation = formData.metal_type === "Imitation";

    if (editProduct) {
      updateProductMutation.mutate({
        id: editProduct.id,
        data: {
          name: formData.name,
          category: formData.category,
          metal_type: formData.metal_type,
          weight: parseFloat(formData.weight),
          stock,
          purchase_price: isImitation ? parseFloat(formData.purchase_price) : 0,
          unit_price: isImitation ? parseFloat(formData.unit_price) : 0,
          status,
        },
      });
    } else {
      const barcode = generateBarcode(formData.metal_type);
      const metalPrefix = formData.metal_type.replace(/\s/g, "").substring(0, 3).toUpperCase();
      const sku = `${metalPrefix}-${Date.now().toString(36).toUpperCase()}`;
      addProductMutation.mutate({
        sku,
        barcode,
        name: formData.name,
        category: formData.category,
        metal_type: formData.metal_type,
        weight: parseFloat(formData.weight),
        stock,
        purchase_price: isImitation ? parseFloat(formData.purchase_price) : 0,
        unit_price: isImitation ? parseFloat(formData.unit_price) : 0,
        status,
      });
    }
  };

  const openEdit = (product: Product) => {
    setEditProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      metal_type: product.metal_type,
      weight: String(product.weight),
      stock: String(product.stock),
      purchase_price: String(product.purchase_price || ""),
      unit_price: String(product.unit_price),
    });
  };

  const closeForm = () => {
    setIsDialogOpen(false);
    setEditProduct(null);
    setFormData(emptyForm);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMetal =
      metalFilter === "all" ||
      (metalFilter === "Gold" && p.metal_type?.toLowerCase().includes("gold")) ||
      (metalFilter === "Silver" && p.metal_type?.toLowerCase().includes("silver")) ||
      (metalFilter === "Diamond" && p.metal_type?.toLowerCase().includes("diamond")) ||
      (metalFilter === "Platinum" && p.metal_type?.toLowerCase().includes("platinum")) ||
      (metalFilter === "Imitation" && p.metal_type?.toLowerCase().includes("imitation"));
    return matchesSearch && matchesMetal;
  });
const filteredStats = useMemo(() => {
  const totalWeight = filteredProducts.reduce((sum, p) => sum + (p.weight || 0), 0);
  const totalProducts = filteredProducts.length;
  const totalStock = filteredProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalValue = filteredProducts.reduce((sum, p) => sum + (p.unit_price || 0) * (p.stock || 0), 0);
  const totalCost = filteredProducts.reduce((sum, p) => sum + (p.purchase_price || 0) * (p.stock || 0), 0);
  const totalProfit = totalValue - totalCost;
  // ✅ Use stock value, not the stored status field
  const lowStock = filteredProducts.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outOfStock = filteredProducts.filter(p => p.stock === 0).length;
  return { totalWeight, totalProducts, totalStock, totalValue, totalCost, totalProfit, lowStock, outOfStock };
}, [filteredProducts]);

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const isFormOpen = isDialogOpen || !!editProduct;
  const isPending = addProductMutation.isPending || updateProductMutation.isPending;

  return (
    <DashboardLayout>
      <div className="mb-6 animate-fade-in pt-2 sm:pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">
              <span className="text-gradient-gold">Inventory</span> Management
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Track stock, manage products, and monitor inventory value</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Bulk Upload
            </Button>
            <Button variant="gold" onClick={() => { setFormData(emptyForm); setEditProduct(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Product
            </Button>
          </div>
        </div>
      </div>

    
<div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
  {/* Always show Total Weight and Product Count */}
  <Card variant="stat">
    <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
      <p className="text-xs sm:text-sm text-muted-foreground">Total Weight</p>
      <p className="text-xl sm:text-2xl font-bold text-primary">{filteredStats.totalWeight.toFixed(2)}g</p>
    </CardContent>
  </Card>
  <Card variant="stat">
    <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
      <p className="text-xs sm:text-sm text-muted-foreground">Product Count</p>
      <p className="text-xl sm:text-2xl font-bold text-primary">{filteredStats.totalProducts}</p>
    </CardContent>
  </Card>

  {/* For Gold or Silver: show Total Stock instead of financial cards */}
  {metalFilter === "Gold" || metalFilter === "Silver" ? (
    <>
      <Card variant="stat">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <p className="text-xs sm:text-sm text-muted-foreground">Total Stock</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">{filteredStats.totalStock}</p>
        </CardContent>
      </Card>
      <Card variant="stat">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <p className="text-xs sm:text-sm text-muted-foreground">Low / Out</p>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{filteredStats.lowStock} / {filteredStats.outOfStock}</p>
        </CardContent>
      </Card>
    </>
  ) : (
    // For All Metals or Imitation: show full financial cards
    <>
      <Card variant="stat">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <p className="text-xs sm:text-sm text-muted-foreground">Selling Value</p>
          <p className="text-xl sm:text-2xl font-bold">{formatCurrency(filteredStats.totalValue)}</p>
        </CardContent>
      </Card>
      <Card variant="stat">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <p className="text-xs sm:text-sm text-muted-foreground">Cost Value</p>
          <p className="text-xl sm:text-2xl font-bold text-muted-foreground">{formatCurrency(filteredStats.totalCost)}</p>
        </CardContent>
      </Card>
      <Card variant="stat">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <p className="text-xs sm:text-sm text-muted-foreground">Profit Margin</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-500">{formatCurrency(filteredStats.totalProfit)}</p>
        </CardContent>
      </Card>
      <Card variant="stat">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <p className="text-xs sm:text-sm text-muted-foreground">Low / Out</p>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{filteredStats.lowStock} / {filteredStats.outOfStock}</p>
        </CardContent>
      </Card>
    </>
  )}
</div>
      <Card variant="elevated">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />All Products</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 sm:flex-none"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search or scan barcode..." className="pl-10 w-full sm:w-48 md:w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
              <Select value={metalFilter} onValueChange={setMetalFilter}>
                <SelectTrigger className="w-[130px] h-9 sm:h-10">
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Metal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Metals</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Diamond">Diamond</SelectItem>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                  <SelectItem value="Imitation">Imitation</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="shrink-0 h-9 w-9 sm:h-10 sm:w-10" onClick={exportToExcel}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{products.length === 0 ? "No products yet. Add your first product!" : "No products found."}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="whitespace-nowrap">Barcode</TableHead>
                <TableHead className="whitespace-nowrap">Product Name</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Metal</TableHead>
                <TableHead className="hidden sm:table-cell">Weight</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="hidden sm:table-cell">Purchase ₹</TableHead>
                <TableHead className="hidden sm:table-cell">Selling ₹</TableHead>
                <TableHead className="hidden lg:table-cell">Margin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredProducts.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 border-primary/30">
                        {item.barcode || item.sku}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[150px] truncate">{item.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{item.category}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{item.metal_type}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{item.weight}g</TableCell>
                    <TableCell className="text-sm">{item.stock}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">₹{(item.purchase_price || 0).toLocaleString()}</TableCell>
                    <TableCell className="hidden sm:table-cell font-semibold text-sm text-primary">₹{item.unit_price?.toLocaleString()}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {item.purchase_price ? (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                          +{(((item.unit_price - item.purchase_price) / item.purchase_price) * 100).toFixed(1)}%
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                     <Badge variant={item.stock === 0 ? "destructive" : item.stock <= 5 ? "secondary" : "default"} className="text-xs whitespace-nowrap">
  {item.stock === 0 ? "Out of Stock" : item.stock <= 5 ? "Low Stock" : "In Stock"}
</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
  <DropdownMenuItem onClick={() => openEdit(item)}>
    <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => setBarcodeProduct(item)}>
    <QrCode className="w-3.5 h-3.5 mr-2" /> Barcode
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => setAdjustProduct(item)}>
    <Package className="w-3.5 h-3.5 mr-2" /> Adjust Stock
  </DropdownMenuItem>
  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm(item)}>
    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
  </DropdownMenuItem>
</DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Product Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editProduct ? "Edit Product" : "Add New Product"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Metal</Label><Select value={formData.metal_type} onValueChange={(v) => setFormData({ ...formData, metal_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Gold 24K">Gold 24K</SelectItem><SelectItem value="Gold 22K">Gold 22K</SelectItem><SelectItem value="Gold 18K">Gold 18K</SelectItem><SelectItem value="Gold 14K">Gold 14K</SelectItem><SelectItem value="Silver 925">Silver 925</SelectItem><SelectItem value="Diamond">Diamond</SelectItem><SelectItem value="Platinum">Platinum</SelectItem><SelectItem value="Imitation">Imitation</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="name">Product Name</Label><Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Gold Necklace" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Category</Label><Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Necklace">Necklace</SelectItem><SelectItem value="Ring">Ring</SelectItem><SelectItem value="Bangle">Bangle</SelectItem><SelectItem value="Earring">Earring</SelectItem><SelectItem value="Pendant">Pendant</SelectItem><SelectItem value="Anklet">Anklet</SelectItem><SelectItem value="Chain">Chain</SelectItem><SelectItem value="Bracelet">Bracelet</SelectItem><SelectItem value="Set">Set</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="weight">Weight (g)</Label><Input id="weight" type="number" step="0.01" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} placeholder="45.5" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="stock">Stock</Label><Input id="stock" type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} placeholder="10" required /></div>
              {formData.metal_type === "Imitation" && (
                <div className="space-y-2"><Label htmlFor="purchase_price">Purchase Price (₹)</Label><Input id="purchase_price" type="number" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} placeholder="500" required /></div>
              )}
            </div>
            {formData.metal_type === "Imitation" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="price">Selling Price (₹)</Label><Input id="price" type="number" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })} placeholder="1000" required /></div>
                <div className="space-y-2 flex flex-col justify-end">
                  <Label className="text-xs text-muted-foreground">Profit Margin</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-semibold text-emerald-600">
                    {formData.purchase_price && formData.unit_price
                      ? `₹${(parseFloat(formData.unit_price) - parseFloat(formData.purchase_price)).toLocaleString()} (${(((parseFloat(formData.unit_price) - parseFloat(formData.purchase_price)) / parseFloat(formData.purchase_price)) * 100).toFixed(1)}%)`
                      : "—"}
                  </div>
                </div>
              </div>
            )}
            {!editProduct && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">Unique barcode will be auto-generated</p>
              </div>
            )}
            <Button type="submit" variant="gold" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editProduct ? "Update Product" : "Add Product"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) { setBulkFile(null); setBulkResults({ success: 0, failed: 0 }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Upload Products</DialogTitle>
            <DialogDescription>
              Upload an Excel (.xlsx, .xls) or CSV file. The first row must contain column headers.
              <br />
              <a href="/templates/product-import-template.xlsx" download className="text-primary text-sm underline mt-2 inline-block">
                Download sample template
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".xlsx, .xls, .csv" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} />
            {bulkResults.success > 0 && (
              <p className="text-sm text-green-600">✅ {bulkResults.success} products added</p>
            )}
            {bulkResults.failed > 0 && (
              <p className="text-sm text-red-600">❌ {bulkResults.failed} rows failed</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkUpload} disabled={!bulkFile || bulkLoading}>
              {bulkLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteProductMutation.isPending} onClick={() => deleteConfirm && deleteProductMutation.mutate(deleteConfirm.id)}>
              {deleteProductMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Dialog */}
      {barcodeProduct && (
        <ProductBarcodeDialog
          barcode={barcodeProduct.barcode || barcodeProduct.sku}
          productName={barcodeProduct.name}
          metalType={barcodeProduct.metal_type}
          weight={barcodeProduct.weight}
          price={barcodeProduct.unit_price}
          open={!!barcodeProduct}
          onOpenChange={(open) => !open && setBarcodeProduct(null)}
        />
      )}

      {/* Stock Adjustment Dialog */}
{adjustProduct && (
  <StockAdjustment
    productId={adjustProduct.id}
    productName={adjustProduct.name}
    currentStock={adjustProduct.stock}
    open={!!adjustProduct}
    onOpenChange={(open) => !open && setAdjustProduct(null)}
  />
)}
    </DashboardLayout>
  );
};

export default Inventory;