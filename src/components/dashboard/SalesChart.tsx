import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { useMemo } from "react";
import { Activity } from "lucide-react";

// More specific Sale type – `items` not used; can be omitted or kept as unknown
interface Sale {
  id: string;
  total: number;
  created_at: string;
  // If you don't use items, omit it or use `unknown`
  items?: unknown;
}

// Type for the tooltip data
type TooltipPayload = {
  dataKey: string;
  color: string;
  value: number;
  name?: string;
  payload?: unknown;
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-elevated">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: TooltipPayload, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground capitalize">{entry.dataKey}:</span>
            <span className="font-medium">₹{Number(entry.value).toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function SalesChart({ sales = [] }: { sales?: Sale[] }) {
  const safeSales = Array.isArray(sales) ? sales : [];
  const data = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const result: { name: string; revenue: number; count: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayName = days[d.getDay()];
      const daySales = safeSales.filter(s => new Date(s.created_at).toDateString() === dayStr);
      const revenue = daySales.reduce((a, s) => a + Number(s.total || 0), 0);
      result.push({ name: dayName, revenue, count: daySales.length });
    }
    return result;
  }, [safeSales]);

  const totalWeek = data.reduce((a, d) => a + d.revenue, 0);
  const totalOrders = data.reduce((a, d) => a + d.count, 0);

  const fmt = (v: number) => {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
    return `₹${v}`;
  };

  return (
    <Card variant="elevated" className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Weekly Sales Overview
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Last 7 days • {fmt(totalWeek)} revenue • {totalOrders} orders
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Revenue</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashGoldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(43, 74%, 53%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(43, 74%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(43, 74%, 53%)" strokeWidth={2} fill="url(#dashGoldGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}