import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserData } from "@/hooks/useUserData";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Search, RotateCcw, Calendar, Filter } from "lucide-react";
import { ExchangeItem as BaseExchangeItem } from "@/components/pos/ExchangeItem";

// Extend base ExchangeItem
interface ExchangeItemWithReturn extends BaseExchangeItem {
  returned?: boolean;
  returnedAt?: string;
  returnValue?: number;
}

interface SaleWithExchange {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  created_at: string;
  exchange_items: ExchangeItemWithReturn[];
  total: number;
}

interface ExchangeRecord extends ExchangeItemWithReturn {
  saleId: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  saleTotal: number;
}

export function ExchangeDashboard() {
  const { getAll, updateItem } = useUserData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<ExchangeRecord | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnAmount, setReturnAmount] = useState(0);
  const queryClient = useQueryClient();

  // Filter states
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [purityFilter, setPurityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all, active, returned

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["exchange-sales"],
    queryFn: async () => {
      const allSales = await getAll<SaleWithExchange>("sales");
      return allSales.filter(sale => sale.exchange_items && sale.exchange_items.length > 0);
    },
  });

  // Flatten all exchange records
  const allExchangeRecords: ExchangeRecord[] = sales.flatMap(sale =>
    (sale.exchange_items || []).map(ex => ({
      ...ex,
      saleId: sale.id,
      invoiceNumber: sale.invoice_number,
      customerName: sale.customer_name || "Walk-in",
      date: sale.created_at,
      saleTotal: sale.total,
    }))
  );

  // Apply all filters
  const filteredRecords = useMemo(() => {
    return allExchangeRecords.filter(rec => {
      // Search filter
      const matchesSearch = searchQuery === "" ||
        rec.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

      // Date range filter
      let matchesDate = true;
      if (startDate || endDate) {
        const recordDate = new Date(rec.date);
        if (startDate && recordDate < startOfDay(new Date(startDate))) matchesDate = false;
        if (endDate && recordDate > endOfDay(new Date(endDate))) matchesDate = false;
      }

      // Purity filter
      const matchesPurity = purityFilter === "all" || rec.purity === purityFilter;

      // Status filter
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && !rec.returned) ||
        (statusFilter === "returned" && rec.returned);

      return matchesSearch && matchesDate && matchesPurity && matchesStatus;
    });
  }, [allExchangeRecords, searchQuery, startDate, endDate, purityFilter, statusFilter]);

  // Enhanced stats
  const stats = useMemo(() => {
    const totalCount = filteredRecords.length;
    const returnedCount = filteredRecords.filter(r => r.returned).length;
    const activeCount = totalCount - returnedCount;

    const totalWeight = filteredRecords.reduce((sum, r) => sum + r.weight, 0);
    const returnedWeight = filteredRecords.filter(r => r.returned).reduce((sum, r) => sum + r.weight, 0);
    const activeWeight = totalWeight - returnedWeight;

    const totalValue = filteredRecords.reduce((sum, r) => sum + r.value, 0);
    const returnedValue = filteredRecords.filter(r => r.returned).reduce((sum, r) => sum + (r.returnValue ?? r.value), 0);
    const activeValue = totalValue - returnedValue;

    return { totalCount, returnedCount, activeCount, totalWeight, returnedWeight, activeWeight, totalValue, returnedValue, activeValue };
  }, [filteredRecords]);

  const returnExchangeMutation = useMutation({
    mutationFn: async (record: ExchangeRecord) => {
      const sale = sales.find(s => s.id === record.saleId);
      if (!sale) throw new Error("Sale not found");

      const updatedExchangeItems = sale.exchange_items.map(item =>
        item.id === record.id
          ? { ...item, returned: true, returnedAt: new Date().toISOString(), returnValue: returnAmount || item.value }
          : item
      );

      await updateItem("sales", sale.id, { exchange_items: updatedExchangeItems });
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-sales"] });
      toast.success("Exchange item returned successfully");
      setReturnDialogOpen(false);
      setSelectedExchange(null);
      setReturnAmount(0);
    },
    onError: (err: Error) => toast.error("Failed to return: " + err.message),
  });

  const openReturnDialog = (record: ExchangeRecord) => {
    setSelectedExchange(record);
    setReturnAmount(record.value);
    setReturnDialogOpen(true);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setPurityFilter("all");
    setStatusFilter("all");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Exchange Items Dashboard</h1>
            <p className="text-muted-foreground text-sm">Track old jewellery exchanged by customers</p>
          </div>
          <Button variant="outline" onClick={clearFilters} className="gap-2">
            <Filter className="w-4 h-4" /> Clear Filters
          </Button>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Counts */}
          <Card variant="elevated">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Exchanges</p>
              <p className="text-2xl font-bold text-primary">{stats.totalCount}</p>
              <div className="flex justify-between text-xs mt-1">
                <span>Active: {stats.activeCount}</span>
                <span>Returned: {stats.returnedCount}</span>
              </div>
            </CardContent>
          </Card>
          {/* Weights */}
          <Card variant="elevated">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Weight</p>
              <p className="text-2xl font-bold text-primary">{stats.totalWeight.toFixed(2)}g</p>
              <div className="flex justify-between text-xs mt-1">
                <span>Active: {stats.activeWeight.toFixed(2)}g</span>
                <span>Returned: {stats.returnedWeight.toFixed(2)}g</span>
              </div>
            </CardContent>
          </Card>
          {/* Values */}
          <Card variant="elevated">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-primary">₹{stats.totalValue.toLocaleString()}</p>
              <div className="flex justify-between text-xs mt-1">
                <span>Active: ₹{stats.activeValue.toLocaleString()}</span>
                <span>Returned: ₹{stats.returnedValue.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          {/* Additional summary */}
          <Card variant="elevated">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Return Rate</p>
              <p className="text-2xl font-bold text-emerald-500">
                {stats.totalCount === 0 ? "0%" : ((stats.returnedCount / stats.totalCount) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">of total exchanges</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search description, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {/* Date from */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="pl-9"
              placeholder="From date"
            />
          </div>
          {/* Date to */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="pl-9"
              placeholder="To date"
            />
          </div>
          {/* Purity filter */}
          <Select value={purityFilter} onValueChange={setPurityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Purity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Purities</SelectItem>
              <SelectItem value="24K">24K</SelectItem>
              <SelectItem value="22K">22K</SelectItem>
              <SelectItem value="18K">18K</SelectItem>
              <SelectItem value="Fixed">Fixed Amount</SelectItem>
            </SelectContent>
          </Select>
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active (Not Returned)</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Exchange Items Table */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Exchange Records</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No exchange items match the filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Weight (g)</TableHead>
                      <TableHead>Purity</TableHead>
                      <TableHead>Value (₹)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((rec, idx) => (
                      <TableRow key={`${rec.saleId}-${idx}`}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(rec.date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{rec.invoiceNumber}</TableCell>
                        <TableCell>{rec.customerName}</TableCell>
                        <TableCell>{rec.description}</TableCell>
                        <TableCell>{rec.weight}g</TableCell>
                        <TableCell>{rec.purity}</TableCell>
                        <TableCell className="font-semibold">₹{rec.value.toLocaleString()}</TableCell>
                        <TableCell>
                          {rec.returned ? (
                            <Badge variant="secondary">Returned</Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReturnDialog(rec)}
                            disabled={rec.returned}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Return
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Return Dialog (unchanged) */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Exchange Item</DialogTitle>
            <DialogDescription>
              Process a return for the exchanged item. This will mark it as returned.
            </DialogDescription>
          </DialogHeader>
          {selectedExchange && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Description:</span> {selectedExchange.description}</div>
                <div><span className="text-muted-foreground">Weight:</span> {selectedExchange.weight}g</div>
                <div><span className="text-muted-foreground">Purity:</span> {selectedExchange.purity}</div>
                <div><span className="text-muted-foreground">Original Value:</span> ₹{selectedExchange.value.toLocaleString()}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="returnAmount">Return Amount (₹)</Label>
                <Input
                  id="returnAmount"
                  type="number"
                  value={returnAmount}
                  onChange={(e) => setReturnAmount(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Amount to credit back to customer.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedExchange && returnExchangeMutation.mutate(selectedExchange)}>
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}