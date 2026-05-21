import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExchangeItem } from "./ExchangeItem";

interface ExchangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: ExchangeItem) => void;
}

export function ExchangeModal({ open, onOpenChange, onAddItem }: ExchangeModalProps) {
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [amount, setAmount] = useState("");

  const handleAdd = () => {
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue <= 0) {
      toast.error("Please enter a valid weight (greater than 0)");
      return;
    }
    const exchangeValue = parseFloat(amount);
    if (isNaN(exchangeValue) || exchangeValue <= 0) {
      toast.error("Please enter a valid exchange amount (greater than 0)");
      return;
    }

    const newItem: ExchangeItem = {
      id: crypto.randomUUID(),
      description: description.trim(),
      weight: weightValue,
      purity: "Fixed",           // dummy value for compatibility
      rate: 0,                   // dummy value
      value: exchangeValue,      // the fixed amount entered by user
    };
    onAddItem(newItem);
    setDescription("");
    setWeight("");
    setAmount("");
    onOpenChange(false);
    toast.success("Exchange item added");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Exchange Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="e.g., Old Gold Ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Weight (g)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="10.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Exchange Amount (₹)</Label>
            <Input
              type="number"
              step="100"
              placeholder="e.g., 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="rounded-lg bg-muted/30 p-2 text-sm">
            <p className="font-medium">Amount to deduct:</p>
            <p className="text-primary font-bold">
              ₹{amount ? parseFloat(amount).toLocaleString() : "0"}
            </p>
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