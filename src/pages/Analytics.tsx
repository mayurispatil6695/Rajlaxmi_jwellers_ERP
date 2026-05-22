import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, Download, Calendar, PieChart, Activity,
  Loader2, IndianRupee, ShoppingBag, Users, Package, Gem, BarChart3,
  UserCog, Wallet, ArrowUpRight, ArrowDownRight, Target, Award, Repeat, Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, BarChart, Bar, LineChart, Line, Legend,
  type TooltipProps,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useUserData } from "@/hooks/useUserData";
import { useMemo } from "react";

// ---------- Types ----------
interface SaleItem {
  name: string;
  qty: number;
  price?: number;
  unit_price?: number;
}

interface Sale {
  id: string;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  created_at: string;
  items: SaleItem[] | unknown;
  payment_method: string;
  customer_name: string | null;
  invoice_number: string;
  status: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  metal_type: string;
  unit_price: number;
  stock: number;
  weight: number;
  status: string;
}

interface Customer {
  id: string;
  name: string;
  total_purchases: number;
  loyalty_points: number;
  city: string | null;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

interface Investment {
  id: string;
  customer_name: string;
  metal_type: string;
  invested_amount: number;
  current_value: number;
  profit_percentage: number;
  status: string;
}

// Payload type for recharts custom tooltip
type TooltipPayloadItem = {
  dataKey: string;
  color: string;
  value: number;
  name?: string;
};

const COLORS = [
  "hsl(43, 74%, 49%)",
  "hsl(43, 74%, 62%)",
  "hsl(220, 10%, 65%)",
  "hsl(200, 20%, 80%)",
  "hsl(30, 60%, 50%)",
  "hsl(15, 70%, 55%)",
];

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-elevated text-sm">
        <p className="font-medium mb-1.5">{label}</p>
        {payload.map((entry: TooltipPayloadItem, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground capitalize">{entry.dataKey}:</span>
            <span className="font-medium">
              {typeof entry.value === "number" && entry.dataKey !== "count"
                ? formatCurrency(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const Analytics = () => {
  const { getAll } = useUserData();
  const { data: sales = [], isLoading: sL } = useQuery({ queryKey: ["analytics-sales"], queryFn: () => getAll<Sale>("sales") });
  const { data: products = [], isLoading: pL } = useQuery({ queryKey: ["analytics-products"], queryFn: () => getAll<Product>("products") });
  const { data: customers = [], isLoading: cL } = useQuery({ queryKey: ["analytics-customers"], queryFn: () => getAll<Customer>("customers") });
  const { data: employees = [], isLoading: eL } = useQuery({ queryKey: ["analytics-employees"], queryFn: () => getAll<Employee>("employees") });
  const { data: investments = [], isLoading: iL } = useQuery({ queryKey: ["analytics-investments"], queryFn: () => getAll<Investment>("investments") });

  const isLoading = sL || pL || cL || eL || iL;

  const isImitationSale = (s: Sale): boolean => {
    let items: SaleItem[] = [];
    if (Array.isArray(s.items)) items = s.items as SaleItem[];
    else if (s.items && typeof s.items === "object") items = Object.values(s.items);
    return items.some((item) => {
      const name = (item.name || "").toLowerCase();
      return name.includes("imitation") || name.includes("artificial") || name.includes("fashion");
    });
  };

  const metrics = useMemo(() => {
    const totalRevenue = sales.reduce((a, s) => a + Number(s.total || 0), 0);
    const totalOrders = sales.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalDiscount = sales.reduce((a, s) => a + Number(s.discount || 0), 0);
    const totalTax = sales.reduce((a, s) => a + Number(s.tax || 0), 0);

    const imitationSales = sales.filter(isImitationSale);
    const imitationRevenue = imitationSales.reduce((a, s) => a + Number(s.total || 0), 0);
    const imitationOrders = imitationSales.length;
    const regularRevenue = totalRevenue - imitationRevenue;

    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === today);
    const todayRevenue = todaySales.reduce((a, s) => a + Number(s.total || 0), 0);

    const totalStock = products.reduce((a, p) => a + Number(p.stock || 0), 0);
    const inventoryValue = products.reduce((a, p) => a + (Number(p.unit_price || 0) * Number(p.stock || 0)), 0);
    const lowStockProducts = products.filter(p => p.stock <= 5 && p.stock > 0);
    const outOfStockProducts = products.filter(p => p.stock === 0);
    const totalWeight = products.reduce((a, p) => a + (Number(p.weight || 0) * Number(p.stock || 0)), 0);

    const totalCustomers = customers.length;
    const totalLoyaltyPoints = customers.reduce((a, c) => a + Number(c.loyalty_points || 0), 0);
    const avgPurchasePerCustomer = totalCustomers > 0 ? customers.reduce((a, c) => a + Number(c.total_purchases || 0), 0) / totalCustomers : 0;
    const repeatCustomers = customers.filter(c => Number(c.total_purchases || 0) > 0).length;

    const activeEmployees = employees.filter(e => e.is_active !== false).length;
    const totalEmployees = employees.length;

    const totalInvested = investments.reduce((a, inv) => a + Number(inv.invested_amount || 0), 0);
    const totalCurrentValue = investments.reduce((a, inv) => a + Number(inv.current_value || 0), 0);
    const investmentProfit = totalCurrentValue - totalInvested;
    const activeInvestments = investments.filter(inv => inv.status === "Active").length;

    return {
      totalRevenue, totalOrders, avgOrderValue, totalDiscount, totalTax,
      todayRevenue, todaySalesCount: todaySales.length,
      imitationRevenue, imitationOrders, regularRevenue,
      totalStock, inventoryValue, lowStockProducts, outOfStockProducts, totalWeight,
      totalCustomers, totalLoyaltyPoints, avgPurchasePerCustomer, repeatCustomers,
      activeEmployees, totalEmployees,
      totalInvested, totalCurrentValue, investmentProfit, activeInvestments,
    };
  }, [sales, products, customers, employees, investments]);

  // Chart data generation – all typed
  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyRevenue: Record<string, number> = {};
    const monthlyOrders: Record<string, number> = {};
    sales.forEach(s => {
      const d = new Date(s.created_at);
      const key = months[d.getMonth()];
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(s.total || 0);
      monthlyOrders[key] = (monthlyOrders[key] || 0) + 1;
    });
    const revenueByMonth = months.map(m => ({ month: m, revenue: monthlyRevenue[m] || 0, orders: monthlyOrders[m] || 0 }));

    const paymentCounts: Record<string, number> = {};
    sales.forEach(s => { paymentCounts[s.payment_method || "Cash"] = (paymentCounts[s.payment_method || "Cash"] || 0) + 1; });
    const paymentData = Object.entries(paymentCounts).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

    const catCount: Record<string, number> = {};
    products.forEach(p => { catCount[p.category] = (catCount[p.category] || 0) + 1; });
    const categoryData = Object.entries(catCount).slice(0, 6).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

    const metalValue: Record<string, number> = {};
    products.forEach(p => {
      const val = Number(p.unit_price || 0) * Number(p.stock || 0);
      metalValue[p.metal_type] = (metalValue[p.metal_type] || 0) + val;
    });
    const metalData = Object.entries(metalValue).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

    const topCustomers = [...customers]
      .sort((a, b) => Number(b.total_purchases || 0) - Number(a.total_purchases || 0))
      .slice(0, 5)
      .map(c => ({ name: c.name.split(" ")[0], purchases: Number(c.total_purchases || 0) }));

    const deptCount: Record<string, number> = {};
    employees.forEach(e => { deptCount[e.department || "Other"] = (deptCount[e.department || "Other"] || 0) + 1; });
    const deptData = Object.entries(deptCount).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

    const investByMetal: Record<string, number> = {};
    investments.forEach(inv => { investByMetal[inv.metal_type || "Gold"] = (investByMetal[inv.metal_type || "Gold"] || 0) + Number(inv.invested_amount || 0); });
    const investmentByMetal = Object.entries(investByMetal).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

    const cityCount: Record<string, number> = {};
    customers.forEach(c => { cityCount[c.city || "Unknown"] = (cityCount[c.city || "Unknown"] || 0) + 1; });
    const cityData = Object.entries(cityCount).slice(0, 5).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

    const lowStockData = products
      .filter(p => p.stock <= 10)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8)
      .map(p => ({ name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name, stock: p.stock, fullName: p.name }));

    const imitationByMonth: Record<string, number> = {};
    const regularByMonth: Record<string, number> = {};
    sales.forEach(s => {
      const d = new Date(s.created_at);
      const key = months[d.getMonth()];
      if (isImitationSale(s)) {
        imitationByMonth[key] = (imitationByMonth[key] || 0) + Number(s.total || 0);
      } else {
        regularByMonth[key] = (regularByMonth[key] || 0) + Number(s.total || 0);
      }
    });
    const imitationVsRegular = months.map(m => ({
      month: m,
      regular: regularByMonth[m] || 0,
      imitation: imitationByMonth[m] || 0,
    }));

    return { revenueByMonth, paymentData, categoryData, metalData, topCustomers, deptData, investmentByMetal, cityData, lowStockData, imitationVsRegular };
  }, [sales, products, customers, employees, investments]);

  const displayPayment = chartData.paymentData.length > 0 ? chartData.paymentData : [{ name: "No Data", value: 1, color: "hsl(var(--muted))" }];
  const displayCategory = chartData.categoryData.length > 0 ? chartData.categoryData : [{ name: "No Data", value: 1, color: "hsl(var(--muted))" }];
  const displayMetal = chartData.metalData.length > 0 ? chartData.metalData : [{ name: "No Data", value: 1, color: "hsl(var(--muted))" }];

  return (
    <DashboardLayout>
      <div className="mb-6 animate-fade-in pt-2 sm:pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">
              <span className="text-gradient-gold">Analytics</span> Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Complete business intelligence — POS, Inventory, Customers, HR & Investments
            </p>
          </div>
          <Button variant="outline" size="sm" className="text-xs sm:text-sm">
            <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />Export Report
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KPICard icon={IndianRupee} label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} sub={`${metrics.totalOrders} orders`} positive />
            <KPICard icon={ShoppingBag} label="Today Sales" value={formatCurrency(metrics.todayRevenue)} sub={`${metrics.todaySalesCount} txns`} positive />
            <KPICard icon={Package} label="Inventory Value" value={formatCurrency(metrics.inventoryValue)} sub={`${metrics.totalStock} items`} positive />
            <KPICard icon={Users} label="Customers" value={metrics.totalCustomers.toString()} sub={`${metrics.repeatCustomers} active`} positive />
            <KPICard icon={UserCog} label="Employees" value={`${metrics.activeEmployees}/${metrics.totalEmployees}`} sub="active" positive />
            <KPICard icon={Gem} label="Investments" value={formatCurrency(metrics.totalCurrentValue)} sub={`${metrics.activeInvestments} active`} positive={metrics.investmentProfit >= 0} />
          </div>

          {/* Tabs for different sections */}
          <Tabs defaultValue="billing" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
              <TabsTrigger value="billing" className="text-xs sm:text-sm">💰 Billing & Revenue</TabsTrigger>
              <TabsTrigger value="imitation" className="text-xs sm:text-sm">✨ Imitation</TabsTrigger>
              <TabsTrigger value="inventory" className="text-xs sm:text-sm">📦 Inventory</TabsTrigger>
              <TabsTrigger value="customers" className="text-xs sm:text-sm">👥 Customers</TabsTrigger>
              <TabsTrigger value="hr" className="text-xs sm:text-sm">🏢 HR & Payroll</TabsTrigger>
              <TabsTrigger value="investments" className="text-xs sm:text-sm">💎 Investments</TabsTrigger>
            </TabsList>

            {/* === BILLING & REVENUE TAB === */}
            <TabsContent value="billing" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatMini label="Avg Order Value" value={formatCurrency(metrics.avgOrderValue)} icon={Target} />
                <StatMini label="Total Discounts" value={formatCurrency(metrics.totalDiscount)} icon={ArrowDownRight} negative />
                <StatMini label="Tax Collected" value={formatCurrency(metrics.totalTax)} icon={Wallet} />
                <StatMini label="Total Orders" value={metrics.totalOrders.toString()} icon={ShoppingBag} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card variant="elevated" className="xl:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Activity className="w-4 h-4 text-primary" />Monthly Revenue & Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.revenueByMonth}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(43, 74%, 49%)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(43, 74%, 49%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="revenue" stroke="hsl(43, 74%, 49%)" fill="url(#revGrad)" strokeWidth={2} name="revenue" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><PieChart className="w-4 h-4 text-primary" />Payment Methods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={displayPayment} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value">
                            {displayPayment.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <PieLegend data={displayPayment} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* === IMITATION TAB === */}
            <TabsContent value="imitation" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatMini label="Imitation Revenue" value={formatCurrency(metrics.imitationRevenue)} icon={Sparkles} />
                <StatMini label="Imitation Orders" value={metrics.imitationOrders.toString()} icon={ShoppingBag} />
                <StatMini label="Regular Revenue" value={formatCurrency(metrics.regularRevenue)} icon={Gem} />
                <StatMini label="Imitation Share" value={`${metrics.totalRevenue > 0 ? ((metrics.imitationRevenue / metrics.totalRevenue) * 100).toFixed(1) : 0}%`} icon={PieChart} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card variant="elevated" className="xl:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="w-4 h-4 text-purple-500" />Imitation vs Regular Revenue (Monthly)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.imitationVsRegular}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => formatCurrency(v)} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="regular" fill="hsl(43, 74%, 49%)" radius={[4, 4, 0, 0]} name="regular" />
                          <Bar dataKey="imitation" fill="hsl(270, 60%, 55%)" radius={[4, 4, 0, 0]} name="imitation" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><PieChart className="w-4 h-4 text-purple-500" />Revenue Split</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={[
                              { name: "Regular", value: metrics.regularRevenue, color: "hsl(43, 74%, 49%)" },
                              { name: "Imitation", value: metrics.imitationRevenue, color: "hsl(270, 60%, 55%)" },
                            ].filter(d => d.value > 0).length > 0 ? [
                              { name: "Regular", value: metrics.regularRevenue, color: "hsl(43, 74%, 49%)" },
                              { name: "Imitation", value: metrics.imitationRevenue, color: "hsl(270, 60%, 55%)" },
                            ] : [{ name: "No Data", value: 1, color: "hsl(var(--muted))" }]}
                            cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value"
                          >
                            {[
                              { color: "hsl(43, 74%, 49%)" },
                              { color: "hsl(270, 60%, 55%)" },
                            ].map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <PieLegend data={[
                      { name: "Regular", value: metrics.regularRevenue, color: "hsl(43, 74%, 49%)" },
                      { name: "Imitation", value: metrics.imitationRevenue, color: "hsl(270, 60%, 55%)" },
                    ].filter(d => d.value > 0)} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* === INVENTORY TAB === */}
            <TabsContent value="inventory" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatMini label="Total Products" value={products.length.toString()} icon={Package} />
                <StatMini label="Total Weight" value={`${metrics.totalWeight.toFixed(1)}g`} icon={Gem} />
                <StatMini label="Low Stock" value={metrics.lowStockProducts.length.toString()} icon={ArrowDownRight} negative />
                <StatMini label="Out of Stock" value={metrics.outOfStockProducts.length.toString()} icon={TrendingDown} negative />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Gem className="w-4 h-4 text-primary" />Value by Metal Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={displayMetal} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value">
                            {displayMetal.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <PieLegend data={displayMetal} />
                  </CardContent>
                </Card>

                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><PieChart className="w-4 h-4 text-primary" />By Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={displayCategory} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value">
                            {displayCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <PieLegend data={displayCategory} />
                  </CardContent>
                </Card>

                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-destructive"><ArrowDownRight className="w-4 h-4" />Low Stock Alert</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.lowStockData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                          <YAxis type="category" dataKey="name" fontSize={10} width={80} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip />
                          <Bar dataKey="stock" fill="hsl(0, 70%, 50%)" radius={[0, 4, 4, 0]} name="stock" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* === CUSTOMERS TAB === */}
            <TabsContent value="customers" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatMini label="Total Customers" value={metrics.totalCustomers.toString()} icon={Users} />
                <StatMini label="Repeat Buyers" value={metrics.repeatCustomers.toString()} icon={Repeat} />
                <StatMini label="Avg Purchase" value={formatCurrency(metrics.avgPurchasePerCustomer)} icon={IndianRupee} />
                <StatMini label="Loyalty Points" value={metrics.totalLoyaltyPoints.toLocaleString()} icon={Award} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Award className="w-4 h-4 text-primary" />Top 5 Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.topCustomers}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                          <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={v => formatCurrency(v)} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="purchases" fill="hsl(43, 74%, 49%)" radius={[4, 4, 0, 0]} name="purchases" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="w-4 h-4 text-primary" />Customers by City</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={chartData.cityData.length > 0 ? chartData.cityData : [{ name: "No Data", value: 1, color: "hsl(var(--muted))" }]} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value">
                            {(chartData.cityData.length > 0 ? chartData.cityData : [{ name: "No Data", value: 1, color: "hsl(var(--muted))" }]).map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <PieLegend data={chartData.cityData.length > 0 ? chartData.cityData : []} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* === HR & PAYROLL TAB === */}
            <TabsContent value="hr" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatMini label="Total Employees" value={metrics.totalEmployees.toString()} icon={UserCog} />
                <StatMini label="Active" value={metrics.activeEmployees.toString()} icon={Users} />
                <StatMini label="Inactive" value={(metrics.totalEmployees - metrics.activeEmployees).toString()} icon={TrendingDown} negative />
                <StatMini label="Departments" value={chartData.deptData.length.toString()} icon={BarChart3} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4 text-primary" />Department Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.deptData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                          <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(43, 74%, 49%)" radius={[4, 4, 0, 0]} name="count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Workforce Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {chartData.deptData.length > 0 ? chartData.deptData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-sm">{d.name}</span>
                        </div>
                        <Badge variant="secondary">{d.value} employees</Badge>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No employee data yet. Add employees from HR module.</p>
                    )}
                    <div className="pt-4 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Active Rate</span>
                        <span className="font-bold text-primary">{metrics.totalEmployees > 0 ? ((metrics.activeEmployees / metrics.totalEmployees) * 100).toFixed(0) : 0}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* === INVESTMENTS TAB === */}
            <TabsContent value="investments" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatMini label="Total Invested" value={formatCurrency(metrics.totalInvested)} icon={Wallet} />
                <StatMini label="Current Value" value={formatCurrency(metrics.totalCurrentValue)} icon={Gem} />
                <StatMini label="Profit/Loss" value={formatCurrency(Math.abs(metrics.investmentProfit))} icon={metrics.investmentProfit >= 0 ? ArrowUpRight : ArrowDownRight} positive={metrics.investmentProfit >= 0} negative={metrics.investmentProfit < 0} />
                <StatMini label="Active Plans" value={metrics.activeInvestments.toString()} icon={Activity} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Gem className="w-4 h-4 text-primary" />Investments by Metal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={chartData.investmentByMetal.length > 0 ? chartData.investmentByMetal : [{ name: "No Data", value: 1, color: "hsl(var(--muted))" }]} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value">
                            {(chartData.investmentByMetal.length > 0 ? chartData.investmentByMetal : [{ name: "No Data", value: 1, color: "hsl(var(--muted))" }]).map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <PieLegend data={chartData.investmentByMetal} />
                  </CardContent>
                </Card>

                <Card variant="elevated">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Investment Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {investments.length > 0 ? investments.slice(0, 5).map(inv => (
                      <div key={inv.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium">{inv.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{inv.metal_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(Number(inv.current_value))}</p>
                          <p className={`text-xs ${Number(inv.profit_percentage) >= 0 ? "text-green-500" : "text-destructive"}`}>
                            {Number(inv.profit_percentage) >= 0 ? "+" : ""}{Number(inv.profit_percentage).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No investment data yet.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </DashboardLayout>
  );
};

// --- Helper Components (fully typed) ---

interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  positive: boolean;
}

function KPICard({ icon: Icon, label, value, sub, positive }: KPICardProps) {
  return (
    <Card variant="stat">
      <CardContent className="pt-4 px-3 sm:px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-3.5 h-3.5 text-primary" />
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{label}</p>
        </div>
        <p className="text-lg sm:text-xl font-bold truncate">{value}</p>
        <div className="flex items-center gap-1 text-xs mt-0.5">
          {positive ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
          <span className="text-muted-foreground truncate">{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatMiniProps {
  label: string;
  value: string;
  icon: LucideIcon;
  negative?: boolean;
  positive?: boolean;
}

function StatMini({ label, value, icon: Icon, negative, positive }: StatMiniProps) {
  return (
    <Card>
      <CardContent className="pt-4 px-3 sm:px-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${negative ? "bg-destructive/10" : "bg-primary/10"}`}>
          <Icon className={`w-4 h-4 ${negative ? "text-destructive" : "text-primary"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-sm sm:text-base font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface PieLegendProps {
  data: { name: string; value: number; color: string }[];
}

function PieLegend({ data }: PieLegendProps) {
  return (
    <div className="space-y-1.5 mt-3">
      {data.map(d => (
        <div key={d.name} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="truncate">{d.name}</span>
          </div>
          <span className="font-medium">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default Analytics;