import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import logoImg from '@/assets/logo.png';
import {
  RotateCcw,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  Megaphone,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  Gem,
  BarChart3,
  Wallet,
  Building2,
  Menu,
  ShieldCheck,
  Receipt,
  ClipboardList,
  Truck,
} from "lucide-react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: ShoppingCart, label: "POS & Sales", href: "/pos", badge: "Live" },
  { icon: Receipt, label: "Bills", href: "/bills" },
  { icon: Wallet, label: "Pending Payments", href: "/pending-payments" },
  { icon: Package, label: "Inventory", href: "/inventory" },
  { icon: ClipboardList, label: "Stock Adjustments", href: "/stock-adjustments" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: Truck, label: "Suppliers", href: "/suppliers" },
  { icon: ShoppingCart, label: "Purchase Orders", href: "/purchase-orders" },
  { icon: RotateCcw, label: "Exchange Items", href: "/exchange-dashboard" },
  { icon: TrendingUp, label: "Investments", href: "/investments" },
  { icon: Megaphone, label: "Marketing", href: "/marketing" },

  { icon: BarChart3, label: "Analytics", href: "/analytics" },
];

const managementItems: NavItem[] = [
  { icon: UserCog, label: "HR & Team", href: "/hr" },
  { icon: Wallet, label: "Payroll", href: "/payroll" },
  { icon: Building2, label: "Branches", href: "/branches" },
  { icon: ShieldCheck, label: "Admin", href: "/admin", badge: "Admin" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src={logoImg}
            alt="Rajlakshmi Jewel ERP"
            className={cn(
              "shrink-0 object-contain",
              collapsed && !mobile ? "h-9 w-9" : "h-10 w-10"
            )}
          />
          {(!collapsed || mobile) && (
            <div className="animate-fade-in">
              <h1 className="font-display text-lg font-bold text-gradient-gold">Rajlakshmi </h1>
              <p className="text-xs text-muted-foreground -mt-0.5">Jewellers ERP</p>
            </div>
          )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {(!collapsed || mobile) && (
            <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Main</p>
          )}
          {mainNavItems.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              active={location.pathname === item.href}
              collapsed={collapsed && !mobile}
            />
          ))}
        </div>
        <div className="mt-6 space-y-1">
          {(!collapsed || mobile) && (
            <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Management</p>
          )}
          {managementItems.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              active={location.pathname === item.href}
              collapsed={collapsed && !mobile}
            />
          ))}
        </div>
      </nav>
      {!mobile && (
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span className="ml-2">Collapse</span></>}
          </Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed top-3 left-3 z-50 bg-background/80 backdrop-blur-sm shadow-md lg:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
            <SidebarContent mobile />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 hidden lg:flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <SidebarContent />
    </aside>
  );
}

function NavButton({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        active
          ? "bg-sidebar-accent text-primary shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.badge && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}