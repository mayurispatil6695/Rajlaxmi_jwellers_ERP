import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Database, Download, Mail, FileJson, FileText, FileSpreadsheet, Loader2, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { getByField, getAll } from '@/lib/firebaseDb';
import { toast } from 'sonner';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------- Type Definitions ----------
interface Profile {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserPreferences {
  id: string;
  user_id: string;
  auto_backup?: boolean;
  backup_frequency?: string;
  last_backup_at?: string;
}

interface Sale {
  id: string;
  invoice_number: string;
  customer_name?: string;
  total: number;
  payment_method: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  unit_price: number;
  metal_type: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  total_purchases: number;
}

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  is_active: boolean;
}

interface Investment {
  id: string;
  invested_amount: number;
  current_value: number;
  status: string;
}

interface ExportData {
  exportedAt: string;
  profile?: Profile;
  preferences?: UserPreferences;
  sales?: Sale[];
  products?: Product[];
  customers?: Customer[];
  employees?: Employee[];
  investments?: Investment[];
  allProfiles?: Profile[];
}

type ExportFormat = 'json' | 'csv' | 'pdf';
type ExportType = 'profile' | 'all_data' | 'system';

// ---------- Helper: Convert any value to safe CSV string ----------
function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
  return String(value).replace(/"/g, '""');
}

// ---------- Helper: Convert object to CSV rows ----------
function objectToCsvRows(obj: Record<string, unknown>): string[] {
  const headers = Object.keys(obj);
  const values = headers.map(h => `"${toCsvValue(obj[h])}"`);
  return [headers.join(','), values.join(',')];
}

// ---------- Helper: Generate PDF with autoTable ----------
function generatePdf(data: ExportData): void {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Rajlakshmi Jewel ERP – Data Export', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${data.exportedAt}`, 14, 28);

  let y = 35;

  const addSection = (title: string, rows: Record<string, unknown>[] | undefined, columns: string[]) => {
    if (!rows || rows.length === 0) return;
    doc.setFontSize(12);
    doc.text(title, 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [columns],
      body: rows.map(row => columns.map(col => toCsvValue(row[col]))),
      theme: 'striped',
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  if (data.profile) {
    addSection('Profile', [data.profile], ['id', 'email', 'display_name', 'created_at']);
  }
  if (data.preferences) {
    addSection('Preferences', [data.preferences], ['auto_backup', 'backup_frequency', 'last_backup_at']);
  }
  if (data.sales && data.sales.length > 0) {
    addSection('Sales', data.sales, ['invoice_number', 'customer_name', 'total', 'payment_method', 'created_at']);
  }
  if (data.products && data.products.length > 0) {
    addSection('Products', data.products, ['name', 'sku', 'stock', 'unit_price', 'metal_type']);
  }
  if (data.customers && data.customers.length > 0) {
    addSection('Customers', data.customers, ['name', 'phone', 'email', 'total_purchases']);
  }
  if (data.employees && data.employees.length > 0) {
    addSection('Employees', data.employees, ['employee_id', 'name', 'is_active']);
  }
  if (data.investments && data.investments.length > 0) {
    addSection('Investments', data.investments, ['invested_amount', 'current_value', 'status']);
  }
  if (data.allProfiles && data.allProfiles.length > 0) {
    addSection('All User Profiles (Admin)', data.allProfiles, ['email', 'display_name', 'created_at']);
  }

  doc.save(`Rajlakshmi -jewellers-export-${Date.now()}.pdf`);
}

// ---------- Helper: Convert export data to CSV string ----------
function exportToCsv(data: ExportData): string {
  const sections: string[] = [];

  const addSection = (title: string, rows: Record<string, unknown>[] | undefined) => {
    if (!rows || rows.length === 0) return;
    sections.push(`\n--- ${title} ---\n`);
    rows.forEach(row => {
      const { headers, values } = objectToCsvRows(row);
      if (!sections.some(s => s.includes(headers[0]))) {
        sections.push(headers.join(',') + '\n');
      }
      sections.push(values.join(',') + '\n');
    });
  };

  if (data.profile) addSection('Profile', [data.profile]);
  if (data.preferences) addSection('Preferences', [data.preferences]);
  if (data.sales) addSection('Sales', data.sales);
  if (data.products) addSection('Products', data.products);
  if (data.customers) addSection('Customers', data.customers);
  if (data.employees) addSection('Employees', data.employees);
  if (data.investments) addSection('Investments', data.investments);
  if (data.allProfiles) addSection('All Profiles (Admin)', data.allProfiles);

  return sections.join('');
}

export function BackupExportSettings() {
  const { user } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences();
  const { isAdmin } = useUserRole();
  const [exporting, setExporting] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(preferences?.auto_backup || false);
  const [backupFrequency, setBackupFrequency] = useState(preferences?.backup_frequency || 'weekly');

  // Fetch all business data for complete export
  const fetchAllBusinessData = async (): Promise<Omit<ExportData, 'profile' | 'preferences'>> => {
    const [sales, products, customers, employees, investments] = await Promise.all([
      getAll<Sale>('sales'),
      getAll<Product>('products'),
      getAll<Customer>('customers'),
      getAll<Employee>('employees'),
      getAll<Investment>('investments'),
    ]);
    return { sales, products, customers, employees, investments };
  };

  const handleExport = async (type: ExportType, fmt: ExportFormat) => {
    if (!user) return;
    const key = `${type}-${fmt}`;
    setExporting(key);

    try {
      let exportData: ExportData = { exportedAt: new Date().toISOString() };

      // Always fetch profile & preferences
      const profiles = await getByField<Profile>('profiles', 'user_id', user.uid);
      exportData.profile = profiles[0] || undefined;
      const prefs = await getByField<UserPreferences>('user_preferences', 'user_id', user.uid);
      exportData.preferences = prefs[0] || undefined;

      if (type === 'all_data' || type === 'system') {
        const businessData = await fetchAllBusinessData();
        exportData = { ...exportData, ...businessData };
      }

      if (type === 'system' && isAdmin) {
        const allProfiles = await getAll<Profile>('profiles');
        exportData.allProfiles = allProfiles;
      }

      if (fmt === 'pdf') {
        generatePdf(exportData);
        toast.success('PDF exported successfully!');
      } else {
        let content: string;
        let mimeType: string;
        let extension: string;
        if (fmt === 'json') {
          content = JSON.stringify(exportData, null, 2);
          mimeType = 'application/json';
          extension = 'json';
        } else { // csv
          content = exportToCsv(exportData);
          mimeType = 'text/csv';
          extension = 'csv';
        }
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Rajlakshmi -jewellers-export-${type}-${fmt}-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`${type.replace('_', ' ')} exported as ${fmt.toUpperCase()}`);
      }

      await updatePreferences({ last_backup_at: new Date().toISOString() });
    } catch (error) {
      console.error('Export error:', error);
      const message = error instanceof Error ? error.message : 'Failed to export data';
      toast.error(message);
    } finally {
      setExporting(null);
    }
  };

  const handleAutoBackupChange = async (enabled: boolean) => {
    setAutoBackup(enabled);
    await updatePreferences({ auto_backup: enabled });
    toast.info(enabled ? 'Auto‑backup preference saved. Actual backups require a backend service.' : 'Auto‑backup disabled.');
  };

  const handleFrequencyChange = async (frequency: string) => {
    setBackupFrequency(frequency);
    await updatePreferences({ backup_frequency: frequency });
  };

  const lastBackup = preferences?.last_backup_at
    ? format(new Date(preferences.last_backup_at), 'PPp')
    : 'Never';

  return (
    <Card variant="elevated">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Database className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Backup & Export
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Manage your data backups and exports
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Last Backup</p>
              <p className="text-xs text-muted-foreground">{lastBackup}</p>
            </div>
          </div>
          <Badge variant={preferences?.last_backup_at ? 'default' : 'secondary'}>
            {preferences?.last_backup_at ? <><CheckCircle className="w-3 h-3 mr-1" /> Backed Up</> : <><AlertCircle className="w-3 h-3 mr-1" /> No Backup</>}
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Automatic Backups</p>
              <p className="text-xs text-muted-foreground">Schedule regular backups of your data</p>
            </div>
            <Switch checked={autoBackup} onCheckedChange={handleAutoBackupChange} />
          </div>
          {autoBackup && (
            <div className="space-y-2">
              <Label className="text-xs">Backup Frequency</Label>
              <Select value={backupFrequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mt-1">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                <span>Auto‑backup preference saved. Actual scheduled backups need a backend service (e.g., Firebase Cloud Function).</span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-sm font-medium">Export Your Data</Label>

          {/* Profile Export */}
          <div className="border rounded-lg p-4 space-y-3">
            <div>
              <p className="font-medium text-sm">Profile Data</p>
              <p className="text-xs text-muted-foreground">Your profile and preferences</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('profile', 'json')} disabled={!!exporting}>
                {exporting === 'profile-json' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
                <span className="ml-2">JSON</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('profile', 'csv')} disabled={!!exporting}>
                {exporting === 'profile-csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                <span className="ml-2">CSV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('profile', 'pdf')} disabled={!!exporting}>
                {exporting === 'profile-pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span className="ml-2">PDF</span>
              </Button>
            </div>
          </div>

          {/* All User Data Export */}
          <div className="border rounded-lg p-4 space-y-3">
            <div>
              <p className="font-medium text-sm">All Business Data</p>
              <p className="text-xs text-muted-foreground">Exports sales, products, customers, employees, investments</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('all_data', 'json')} disabled={!!exporting}>
                {exporting === 'all_data-json' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="ml-2">JSON</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('all_data', 'csv')} disabled={!!exporting}>
                {exporting === 'all_data-csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="ml-2">CSV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('all_data', 'pdf')} disabled={!!exporting}>
                {exporting === 'all_data-pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span className="ml-2">PDF</span>
              </Button>
            </div>
          </div>

          {/* System Export (Admin only) */}
          {isAdmin && (
            <div className="border border-primary/50 rounded-lg p-4 space-y-3 bg-primary/5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">System Data</p>
                  <Badge variant="default" className="text-xs">Admin</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Export all user profiles (admin only)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="gold" size="sm" onClick={() => handleExport('system', 'json')} disabled={!!exporting}>
                  {exporting === 'system-json' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="ml-2">Export All</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Email Export</p>
            <p className="text-xs text-muted-foreground">Send export to your email</p>
          </div>
          <Button variant="outline" size="sm" disabled><Mail className="w-4 h-4 mr-2" />Coming Soon</Button>
        </div>
      </CardContent>
    </Card>
  );
}