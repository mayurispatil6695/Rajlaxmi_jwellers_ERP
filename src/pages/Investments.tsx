import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Wallet, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserData } from "@/hooks/useUserData";
import { MetalPriceCard } from "@/components/dashboard/MetalPriceCard";

interface Investment {
  id: string;
  customer_name: string;
  metal_type: string;
  quantity: string;
  invested_amount: number;
  current_value: number;
  profit_percentage: number;
  status: string;
}

// Type for the form data (without calculated fields)
interface InvestmentFormData {
  customer_name: string;
  metal_type: string;
  quantity: string;
  invested_amount: string; // string because it comes from input
}

const Investments = () => {
  const { getAll, addItem } = useUserData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<InvestmentFormData>({
    customer_name: "",
    metal_type: "Gold",
    quantity: "",
    invested_amount: "",
  });
  const queryClient = useQueryClient();

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: () => getAll<Investment>("investments"),
  });

  const addInvestmentMutation = useMutation({
    mutationFn: async (data: InvestmentFormData) => {
      const investedAmount = parseFloat(data.invested_amount);
      // Example: assume 10% appreciation for demo (you can change logic)
      const currentValue = investedAmount * 1.1;
      const profitPercentage = ((currentValue - investedAmount) / investedAmount) * 100;
      return addItem("investments", {
        customer_name: data.customer_name,
        metal_type: data.metal_type,
        quantity: data.quantity,
        invested_amount: investedAmount,
        current_value: currentValue,
        profit_percentage: profitPercentage,
        status: "Active",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Investment added successfully!");
      setIsDialogOpen(false);
      setFormData({
        customer_name: "",
        metal_type: "Gold",
        quantity: "",
        invested_amount: "",
      });
    },
    onError: (error: Error) => toast.error("Failed to add investment: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addInvestmentMutation.mutate(formData);
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const stats = {
    totalInvestments: investments.reduce((acc, inv) => acc + (inv.invested_amount || 0), 0),
    currentValue: investments.reduce((acc, inv) => acc + (inv.current_value || 0), 0),
    totalProfit: investments.reduce((acc, inv) => acc + ((inv.current_value || 0) - (inv.invested_amount || 0)), 0),
    activeInvestors: investments.length,
  };

  return (
    <DashboardLayout>
      <div className="mb-6 animate-fade-in pt-2 sm:pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">
              <span className="text-gradient-gold">Investment</span> Portfolio
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Track customer investments in precious metals and jewellery
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gold" className="shrink-0 w-full sm:w-auto">
                <Coins className="w-4 h-4 mr-2" />New Investment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Investment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Customer Name *</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    placeholder="Priya Sharma"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metal Type</Label>
                    <Select
                      value={formData.metal_type}
                      onValueChange={(v) => setFormData({ ...formData, metal_type: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gold">Gold</SelectItem>
                        <SelectItem value="Silver">Silver</SelectItem>
                        <SelectItem value="Platinum">Platinum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="100g"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invested_amount">Invested Amount (₹) *</Label>
                  <Input
                    id="invested_amount"
                    type="number"
                    value={formData.invested_amount}
                    onChange={(e) => setFormData({ ...formData, invested_amount: e.target.value })}
                    placeholder="650000"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="gold"
                  className="w-full"
                  disabled={addInvestmentMutation.isPending}
                >
                  {addInvestmentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Investment
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card variant="stat">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Investments</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">{formatCurrency(stats.totalInvestments)}</p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs sm:text-sm text-muted-foreground">Current Value</p>
            <p className="text-xl sm:text-2xl font-bold">{formatCurrency(stats.currentValue)}</p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Profit</p>
            <p className="text-xl sm:text-2xl font-bold text-green-500">+{formatCurrency(stats.totalProfit)}</p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs sm:text-sm text-muted-foreground">Active Investors</p>
            <p className="text-xl sm:text-2xl font-bold">{stats.activeInvestors}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2">
          <Card variant="elevated">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Active Investments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : investments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No investments yet. Add your first investment!</p>
              ) : (
                <div className="space-y-3">
                  {investments.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-gold/20 flex items-center justify-center shrink-0">
                          <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base truncate">{inv.customer_name}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">{inv.metal_type} • {inv.quantity}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                        <div className="text-left sm:text-right text-xs sm:text-sm">
                          <p className="font-semibold">{formatCurrency(inv.current_value || 0)}</p>
                          <p className="text-muted-foreground">Invested: {formatCurrency(inv.invested_amount || 0)}</p>
                        </div>
                        <Badge
                          variant={(inv.profit_percentage || 0) >= 0 ? "default" : "destructive"}
                          className="flex items-center gap-1 text-xs whitespace-nowrap"
                        >
                          {(inv.profit_percentage || 0) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {(inv.profit_percentage || 0) >= 0 ? "+" : ""}{(inv.profit_percentage || 0).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <MetalPriceCard />
      </div>
    </DashboardLayout>
  );
};

export default Investments;