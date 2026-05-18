import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, MessageCircle, Mail, Phone, Send, Eye, Cake, RefreshCw, Copy, Loader2, Check, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface Props {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORE_NAME = "Rajlakshmi Jewel ERP";
const STORE_PHONE = "+91 98765 43210";   

function generateCouponCode(name: string): string {
  const prefix = "BDAY";
  const namePart = name.replace(/\s/g, "").substring(0, 3).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${namePart}${rand}`;
}

export function BirthdayOfferModal({ customer, open, onOpenChange }: Props) {
  const [offerType, setOfferType] = useState<"percent" | "flat" | "making" | "custom">("percent");
  const [discountPercent, setDiscountPercent] = useState(5);
  const [discountFlat, setDiscountFlat] = useState(500);
  const [customMessage, setCustomMessage] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date>(addDays(new Date(), 7));

  // Multi-select channels
  const [channels, setChannels] = useState({ whatsapp: true, sms: false, email: false });

  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Generate coupon when modal opens
  useEffect(() => {
    if (open && customer) {
      setCouponCode(generateCouponCode(customer.name));
      setExpiryDate(addDays(new Date(), 7));
      setSendSuccess(false);
      setIsSending(false);
      setShowPreview(false);
    }
  }, [open, customer]);

  if (!customer) return null;

  const selectedCount = Object.values(channels).filter(Boolean).length;

  const getOfferText = () => {
    switch (offerType) {
      case "percent": return `${discountPercent}% Discount`;
      case "flat": return `₹${discountFlat} Off`;
      case "making": return "Free Making Charges";
      case "custom": return customMessage || "Special Birthday Offer";
    }
  };

  const whatsappMessage = () =>
    `🎉 *Happy Birthday, ${customer.name}!* 🎂\n\n💎 A Special Gift From ${STORE_NAME}\n\n🎁 *Offer:* ${getOfferText()}\n🎟️ *Coupon Code:* ${couponCode}\n📅 *Valid Till:* ${format(expiryDate, "dd MMM yyyy")}\n\n✨ Visit us today and make your birthday even more special!\n\n📍 Store: ${STORE_NAME}\n📞 Contact: ${STORE_PHONE}\n\nWarm Regards,\n${STORE_NAME}`;

  const smsMessage = () =>
    `Happy Birthday ${customer.name}! 🎉 Get ${getOfferText()} | Coupon: ${couponCode} | Valid Till: ${format(expiryDate, "dd MMM yyyy")} - ${STORE_NAME}`;

  const emailSubject = () => `🎉 Happy Birthday ${customer.name} — Special Gift Inside 🎁`;
  const emailBody = () =>
    `Dear ${customer.name},\n\nWishing you a very Happy Birthday! 🎂\n\nAs a token of our appreciation, here's a special birthday offer just for you:\n\n🎁 Offer: ${getOfferText()}\n🎟️ Coupon Code: ${couponCode}\n📅 Valid Till: ${format(expiryDate, "dd MMM yyyy")}\n\nVisit ${STORE_NAME} to claim your birthday gift!\n\n📞 ${STORE_PHONE}\n\nWarm Regards,\n${STORE_NAME}`;

  const handleSend = async () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one channel to send");
      return;
    }

    setIsSending(true);
    const phone = customer.phone?.replace(/\D/g, "");
    const results: string[] = [];

    try {
      // Small delay for UX
      await new Promise((r) => setTimeout(r, 800));

      if (channels.whatsapp) {
        const formatted = phone.startsWith("91") ? phone : "91" + phone;
        window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(whatsappMessage())}`, "_blank");
        results.push("WhatsApp");
      }

      if (channels.sms) {
        window.open(`sms:${customer.phone}?body=${encodeURIComponent(smsMessage())}`, "_blank");
        results.push("SMS");
      }

      if (channels.email && customer.email) {
        window.open(`mailto:${customer.email}?subject=${encodeURIComponent(emailSubject())}&body=${encodeURIComponent(emailBody())}`, "_blank");
        results.push("Email");
      } else if (channels.email && !customer.email) {
        toast.error("No email address found for this customer");
      }

      if (results.length > 0) {
        setSendSuccess(true);
        toast.success(`🎉 Birthday offer sent to ${customer.name} via ${results.join(", ")}!`);
        setTimeout(() => onOpenChange(false), 1500);
      }
    } catch (err) {
      toast.error("Failed to send offer. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const copyCoupon = () => {
    navigator.clipboard.writeText(couponCode);
    toast.success("Coupon code copied!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            Send Birthday Offer
            <Badge className="bg-gradient-to-r from-pink-500 to-orange-400 text-white text-[10px]">
              <Cake className="w-3 h-3 mr-0.5" /> {customer.name}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {sendSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-semibold text-lg">Offer Sent Successfully! 🎉</p>
            <p className="text-sm text-muted-foreground">Birthday offer has been sent to {customer.name}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Offer Type */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offer Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "percent" as const, label: "Discount %", icon: "%" },
                  { value: "flat" as const, label: "Flat ₹ Off", icon: "₹" },
                  { value: "making" as const, label: "Free Making", icon: "🛠" },
                  { value: "custom" as const, label: "Custom Offer", icon: "✍" },
                ]).map((opt) => (
                  <Button
                    key={opt.value}
                    variant={offerType === opt.value ? "default" : "outline"}
                    size="sm"
                    className="text-xs gap-1.5 h-9"
                    onClick={() => setOfferType(opt.value)}
                  >
                    <span>{opt.icon}</span> {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Offer Value */}
            {offerType === "percent" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Discount Percentage</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={50} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="w-24" />
                  <span className="text-sm text-muted-foreground">%</span>
                  <div className="flex gap-1 ml-auto">
                    {[5, 10, 15, 20].map((v) => (
                      <Button key={v} variant={discountPercent === v ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2" onClick={() => setDiscountPercent(v)}>
                        {v}%
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {offerType === "flat" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Flat Discount Amount</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">₹</span>
                  <Input type="number" min={100} value={discountFlat} onChange={(e) => setDiscountFlat(Number(e.target.value))} />
                </div>
              </div>
            )}

            {offerType === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Custom Offer Message</Label>
                <Textarea placeholder="e.g., Buy 1 Get 1 Free on Silver items..." value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} rows={2} />
              </div>
            )}

            {offerType === "making" && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-center">
                <p className="font-medium text-primary">🛠 Free Making Charges</p>
                <p className="text-xs text-muted-foreground mt-1">Making charges will be waived on birthday purchase</p>
              </div>
            )}

            {/* Coupon Code */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coupon Code</Label>
              <div className="flex items-center gap-2">
                <Input value={couponCode} readOnly className="font-mono font-bold tracking-widest text-primary" />
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={copyCoupon} title="Copy">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => setCouponCode(generateCouponCode(customer.name))} title="Regenerate">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Expiry Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valid Till</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(expiryDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={(d) => d && setExpiryDate(d)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Send Via - Multi Select */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Send Via</Label>
              <div className="grid grid-cols-3 gap-2">
                <label className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs font-medium",
                  channels.whatsapp ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400" : "border-border hover:bg-muted/50"
                )}>
                  <Checkbox checked={channels.whatsapp} onCheckedChange={(c) => setChannels({ ...channels, whatsapp: !!c })} className="h-3.5 w-3.5" />
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </label>
                <label className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs font-medium",
                  channels.sms ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400" : "border-border hover:bg-muted/50"
                )}>
                  <Checkbox checked={channels.sms} onCheckedChange={(c) => setChannels({ ...channels, sms: !!c })} className="h-3.5 w-3.5" />
                  <Phone className="w-3.5 h-3.5" /> SMS
                </label>
                <label className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs font-medium",
                  channels.email ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400" : "border-border hover:bg-muted/50",
                  !customer.email && "opacity-50 cursor-not-allowed"
                )}>
                  <Checkbox checked={channels.email} onCheckedChange={(c) => customer.email && setChannels({ ...channels, email: !!c })} className="h-3.5 w-3.5" disabled={!customer.email} />
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
              </div>
              {!customer.email && <p className="text-[10px] text-muted-foreground">Email disabled — no email on file</p>}
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message Preview</Label>
                <Tabs defaultValue="whatsapp" className="w-full">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="whatsapp" className="text-[10px] gap-1"><MessageCircle className="w-3 h-3" /> WhatsApp</TabsTrigger>
                    <TabsTrigger value="sms" className="text-[10px] gap-1"><Phone className="w-3 h-3" /> SMS</TabsTrigger>
                    <TabsTrigger value="email" className="text-[10px] gap-1"><Mail className="w-3 h-3" /> Email</TabsTrigger>
                  </TabsList>
                  <TabsContent value="whatsapp">
                    <div className="p-3 rounded-lg border bg-green-500/5 border-green-500/20 text-sm whitespace-pre-line max-h-48 overflow-y-auto">
                      {whatsappMessage().replace(/\*/g, "")}
                    </div>
                  </TabsContent>
                  <TabsContent value="sms">
                    <div className="p-3 rounded-lg border bg-blue-500/5 border-blue-500/20 text-sm whitespace-pre-line max-h-48 overflow-y-auto">
                      {smsMessage()}
                    </div>
                  </TabsContent>
                  <TabsContent value="email">
                    <div className="p-3 rounded-lg border bg-purple-500/5 border-purple-500/20 text-sm max-h-48 overflow-y-auto">
                      <p className="font-semibold text-xs text-muted-foreground mb-1">Subject: {emailSubject()}</p>
                      <div className="whitespace-pre-line">{emailBody()}</div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        )}

        {!sendSuccess && (
          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="w-3.5 h-3.5" /> {showPreview ? "Hide Preview" : "Preview"}
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="gap-1.5"
              onClick={handleSend}
              disabled={isSending || selectedCount === 0}
            >
              {isSending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> Send Offer {selectedCount > 0 && `(${selectedCount})`}</>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
