import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { MetalPriceCard } from "@/components/dashboard/MetalPriceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { InventoryAlerts } from "@/components/dashboard/InventoryAlerts";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { CustomerInsights } from "@/components/dashboard/CustomerInsights";
import { BusinessHealth } from "@/components/dashboard/BusinessHealth";
import {
  IndianRupee,
  ShoppingBag,
  Users,
  Package,
  Gem,
  UserCog,
  Sparkles,
  Receipt,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useNotifications } from "@/hooks/useNotifications";
import { Loader2 } from "lucide-react";

// Define SaleItem interface
interface SaleItem {
  name: string;
  qty: number;
  unit_price: number;
  price?: number;
  weight?: number;
  purity?: string;
}

interface Sale {
  id: string;
  total: number;
  created_at: string;
  payment_method: string;
  customer_name: string | null;
  invoice_number: string;
  items: SaleItem[];  // fixed: replaced 'any' with SaleItem[]
  status: string;
  is_imitation_bill?: boolean;
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
  date_of_birth?: string; // not in product but added for completeness? Actually product doesn't have DOB, but we'll leave as is.
}

interface Customer {
  id: string;
  name: string;
  total_purchases: number;
  loyalty_points: number;
  city: string | null;
  created_at: string;
  date_of_birth?: string | null; // added for birthday check
}

interface Employee {
  id: string;
  name: string;
  department: string | null;
  is_active: boolean;
}

interface Investment {
  id: string;
  invested_amount: number;
  current_value: number;
  status: string;
  metal_type: string;
}

function isImitationSale(sale: Sale): boolean {
  if (sale.is_imitation_bill) return true;
  const items = Array.isArray(sale.items) ? sale.items : [];
  return items.some((item) => {
    const name = (item.name || "").toLowerCase();
    return name.includes("imitation") || name.includes("artificial") || name.includes("fashion");
  });
}

const fmt = (v: number) => {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const Index = () => {
  const { user } = useAuth();
  const { getAll } = useUserData();
  const { createNotification } = useNotifications();
  const birthdayCheckedRef = useRef(false);
  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";

  const { data: sales = [], isLoading: sL } = useQuery({ queryKey: ["dash-sales"], queryFn: () => getAll<Sale>("sales"), enabled: !!user });
  const { data: products = [], isLoading: pL } = useQuery({ queryKey: ["dash-products"], queryFn: () => getAll<Product>("products"), enabled: !!user });
  const { data: customers = [], isLoading: cL } = useQuery({ queryKey: ["dash-customers"], queryFn: () => getAll<Customer>("customers"), enabled: !!user });
  const { data: employees = [], isLoading: eL } = useQuery({ queryKey: ["dash-employees"], queryFn: () => getAll<Employee>("employees"), enabled: !!user });
  const { data: investments = [], isLoading: iL } = useQuery({ queryKey: ["dash-investments"], queryFn: () => getAll<Investment>("investments"), enabled: !!user });

  const isLoading = sL || pL || cL || eL || iL;

  // Auto-generate birthday & low stock notifications once per session
  useEffect(() => {
    if (birthdayCheckedRef.current || isLoading || !customers.length) return;
    birthdayCheckedRef.current = true;
    const today = new Date();
    const mm = today.getMonth();
    const dd = today.getDate();

    customers.forEach((customer) => {
      if (customer.date_of_birth) {
        const dob = new Date(customer.date_of_birth);
        if (dob.getMonth() === mm && dob.getDate() === dd) {
          createNotification({
            title: "🎂 Birthday Today!",
            message: `${customer.name}'s birthday is today. Send them an offer!`,
            type: "birthday",
            priority: "high",
            action_url: "/customers",
          });
        }
      }
    });

    products.forEach((product) => {
      const stock = Number(product.stock);
      if (stock <= 0) {
        createNotification({
          title: "🚫 Out of Stock",
          message: `${product.name} is out of stock. Reorder immediately.`,
          type: "inventory",
          priority: "high",
          action_url: "/inventory",
        });
      } else if (stock <= 5) {
        createNotification({
          title: "⚠️ Low Stock Alert",
          message: `${product.name} has only ${product.stock} units remaining.`,
          type: "inventory",
          priority: "high",
          action_url: "/inventory",
        });
      }
    });
  }, [isLoading, customers, products, createNotification]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === today);
    const todayRevenue = todaySales.reduce((a, s) => a + Number(s.total || 0), 0);
    const totalRevenue = sales.reduce((a, s) => a + Number(s.total || 0), 0);
    const inventoryValue = products.reduce((a, p) => a + (Number(p.unit_price || 0) * Number(p.stock || 0)), 0);
    const totalStock = products.reduce((a, p) => a + Number(p.stock || 0), 0);
    const activeCustomers = customers.filter(c => Number(c.total_purchases || 0) > 0).length;

    // Imitation metrics
    const imitationSales = sales.filter(s => isImitationSale(s));
    const imitationRevenue = imitationSales.reduce((a, s) => a + Number(s.total || 0), 0);
    const todayImitationSales = imitationSales.filter(s => new Date(s.created_at).toDateString() === today);
    const todayImitationRevenue = todayImitationSales.reduce((a, s) => a + Number(s.total || 0), 0);

    // Regular (non-imitation) revenue
    const regularRevenue = totalRevenue - imitationRevenue;

    return [
      { title: "Today's Revenue", value: fmt(todayRevenue), change: { value: `${todaySales.length} sales`, positive: todayRevenue > 0 }, description: "today", icon: IndianRupee, accentColor: "gold" as const },
      { title: "Gold Revenue", value: fmt(regularRevenue), change: { value: `${sales.length - imitationSales.length} orders`, positive: true }, description: "excl. imitation", icon: Gem, accentColor: "gold" as const },
      { title: "Customers", value: customers.length.toString(), change: { value: `${activeCustomers} active`, positive: true }, description: "buyers", icon: Users, accentColor: "gold" as const },
      { title: "Inventory Value", value: fmt(inventoryValue), change: { value: `${totalStock} items`, positive: true }, description: "in stock", icon: Package, accentColor: "silver" as const },
      { title: "Imitation Revenue", value: fmt(imitationRevenue), change: { value: `${imitationSales.length} bills`, positive: imitationRevenue > 0 }, description: "all time", icon: Sparkles, accentColor: "emerald" as const },
      { title: "Today Imitation", value: fmt(todayImitationRevenue), change: { value: `${todayImitationSales.length} sales`, positive: todayImitationRevenue > 0 }, description: "today", icon: Receipt, accentColor: "emerald" as const },
    ];
  }, [sales, products, customers]);

  return (
    <DashboardLayout>
      <div className="mb-6 sm:mb-8 animate-fade-in pt-2 sm:pt-0">
        <h1 className="text-2xl sm:text-3xl font-display font-bold">
          {getGreeting()}, <span className="text-gradient-gold">{displayName}</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Here's what's happening at your jewellery store today.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
            {stats.map((stat, index) => (
              <StatCard key={stat.title} {...stat} delay={index * 80} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="lg:col-span-2">
              <SalesChart sales={sales} />
            </div>
            <MetalPriceCard />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <BusinessHealth sales={sales} products={products} customers={customers} investments={investments} />
            <CustomerInsights customers={customers} sales={sales} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              <RecentTransactions sales={sales} />
            </div>
            <div className="space-y-4 sm:space-y-6">
              <InventoryAlerts products={products} />
              <QuickActions />
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Index;