import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2, Search, Cake, ShoppingCart, Package, Users, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  customer: { icon: Users, color: "text-blue-400" },
  sales: { icon: ShoppingCart, color: "text-emerald-400" },
  inventory: { icon: Package, color: "text-amber-400" },
  hr: { icon: Users, color: "text-purple-400" },
  business: { icon: TrendingUp, color: "text-primary" },
  birthday: { icon: Cake, color: "text-pink-400" },
  general: { icon: Bell, color: "text-muted-foreground" },
};

const priorityStyles: Record<string, string> = {
  high: "border-l-4 border-l-red-500/70",
  medium: "border-l-4 border-l-amber-500/50",
  low: "border-l-4 border-l-transparent",
};

function NotificationItem({
  notification,
  onRead,
  onRemove,
  onNavigate,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const config = typeConfig[notification.type] || typeConfig.general;
  const Icon = config.icon;

  const handleNotificationClick = () => {
    if (!notification.is_read) onRead(notification.id);
    if (notification.action_url) onNavigate(notification.action_url);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(notification.id);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors duration-200 group",
        notification.is_read
          ? "opacity-60 hover:opacity-80"
          : "bg-primary/5 hover:bg-primary/10",
        priorityStyles[notification.priority] || priorityStyles.low
      )}
      onClick={handleNotificationClick}
    >
      <div className="w-9 h-9 rounded-full bg-secondary/80 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className={cn("w-4 h-4", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium leading-tight truncate">
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-muted-foreground/60">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
            })}
          </p>
          {notification.action_url && (
            <span className="text-[10px] text-primary/70">
              Tap to view →
            </span>
          )}
        </div>
      </div>
      {/* Trash icon button – visible on hover or always (you decide) */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={handleDeleteClick}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    hasNewNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
  } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filtered = notifications.filter((n) => {
    const matchesSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.message.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "all" || n.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleNavigate = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground relative h-9 w-9",
            hasNewNotification && "animate-bell-shake"
          )}
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center rounded-full animate-scale-in"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] sm:w-[400px] p-0 border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl shadow-primary/5 rounded-xl overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-secondary/20">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
            >
              <Check className="w-3 h-3 mr-1" />
              Read All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearAll}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-secondary/30 border-border/30"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5"
                onClick={() => setSearch("")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-3 pt-2 border-b border-border/20">
            <TabsList className="h-7 bg-secondary/30 w-full">
              <TabsTrigger value="all" className="text-[10px] h-5 flex-1">All</TabsTrigger>
              <TabsTrigger value="customer" className="text-[10px] h-5 flex-1">CRM</TabsTrigger>
              <TabsTrigger value="sales" className="text-[10px] h-5 flex-1">Sales</TabsTrigger>
              <TabsTrigger value="inventory" className="text-[10px] h-5 flex-1">Stock</TabsTrigger>
              <TabsTrigger value="hr" className="text-[10px] h-5 flex-1">HR</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="h-[340px]">
              <div className="p-2 space-y-1">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Bell className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">No notifications</p>
                    <p className="text-xs opacity-60">You're all caught up!</p>
                  </div>
                ) : (
                  filtered.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onRead={markAsRead}
                      onRemove={removeNotification}
                      onNavigate={handleNavigate}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}