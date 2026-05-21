import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ExchangeItem {
  id: string;
  description: string;
  weight: number;
  purity: string;
  rate: number;
  value: number;
}

interface ExchangeItemProps {
  item: ExchangeItem;
  onRemove: (id: string) => void;
}

export function ExchangeItemComponent({ item, onRemove }: ExchangeItemProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
      <div>
        <p className="font-medium text-sm">{item.description}</p>
        <p className="text-xs text-muted-foreground">
          {item.weight > 0 ? `${item.weight}g • ` : ""}₹{item.value.toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-emerald-600">-₹{item.value.toLocaleString()}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(item.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}