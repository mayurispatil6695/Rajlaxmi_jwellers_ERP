// src/components/pos/CameraScanner.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera } from "lucide-react";
import { ref, push } from "firebase/database";
import { db } from "@/lib/firebase";

interface CameraScannerProps {
  onScan?: (decodedText: string) => void; // keep optional for backward compatibility
}

export function CameraScanner({ onScan }: CameraScannerProps) {
  const [open, setOpen] = useState(false);

  const writeScan = async (barcode: string) => {
    // Write to Firebase to sync across devices
    await push(ref(db, 'pending_scans'), {
      barcode,
      timestamp: Date.now(),
    });
    // Also call the local callback if provided (for the phone's own UI)
    if (onScan) onScan(barcode);
  };

  const startScan = () => {
    setOpen(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scanner.render(
        (decodedText) => {
          scanner.clear();
          writeScan(decodedText);
          setOpen(false);
        },
        (error) => {
          // ignore errors, keep scanning
        }
      );
    }, 100);
  };

  return (
    <>
      <Button variant="outline" onClick={startScan} className="gap-2">
        <Camera className="w-4 h-4" /> Scan with Camera
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
          </DialogHeader>
          <div id="reader" className="w-full"></div>
        </DialogContent>
      </Dialog>
    </>
  );
}