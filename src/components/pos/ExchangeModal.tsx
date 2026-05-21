import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ExchangeItem } from "./ExchangeItem";

interface ExchangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: ExchangeItem) => void;
}

export function ExchangeModal({ open, onOpenChange, onAddItem }: ExchangeModalProps) {
  const [form, setForm] = useState({
    description: "",
    weight: "",
    purity: "22K",
    rate: "",
  });

  // Purity factors – "None" means 100% purity (factor = 1)
  const purityFactors: Record<string, number> = {
    "24K": 1,
    "22K": 0.916,
    "18K": 0.75,
    "None": 1,           // ← Now gives full value
  };

  const calculatedValue = () => {
    const weight = parseFloat(form.weight) || 0;
    const rate = parseFloat(form.rate) || 0;
    const factor = purityFactors[form.purity] ?? 1;
    return weight * factor * rate;
  };

  const handleAdd = () => {
    const weight = parseFloat(form.weight);
    const rate = parseFloat(form.rate);
    if (!form.description || isNaN(weight) || weight <= 0 || isNaN(rate) || rate <= 0) {
      toast.error("Please fill all fields correctly");
      return;
    }
    const value = calculatedValue();
    const newItem: ExchangeItem = {
      id: crypto.randomUUID(),
      description: form.description,
      weight,
      purity: form.purity,
      rate,
      value,
    };
    onAddItem(newItem);
    setForm({ description: "", weight: "", purity: "22K", rate: "" });
    onOpenChange(false);
    toast.success("Exchange item added");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Old Jewellery Exchange</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="e.g., Old Gold Ring"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weight (g)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="10.5"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Purity</Label>
              <Select value={form.purity} onValueChange={(v) => setForm({ ...form, purity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24K">24K (99.9%)</SelectItem>
                  <SelectItem value="22K">22K (91.6%)</SelectItem>
                  <SelectItem value="18K">18K (75%)</SelectItem>
                  <SelectItem value="None">None (100%)</SelectItem>   {/* Now gives full rate */}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Rate per gram (₹)</Label>
            <Input
              type="number"
              placeholder="e.g., 7200"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
            />
          </div>
          <div className="rounded-lg bg-muted/30 p-2 text-sm">
            <p className="font-medium">Calculated Value:</p>
            <p className="text-primary font-bold">₹{calculatedValue().toLocaleString()}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd}>Add Exchange Item</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}