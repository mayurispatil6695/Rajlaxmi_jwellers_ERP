import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserData } from "@/hooks/useUserData";
import { toast } from "sonner";
import { 
  UserCog, 
  Plus, 
  Users, 
  Briefcase, 
  Clock, 
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  is_active: boolean;
  password_hash?: string;
  created_at: string;
  updated_at: string;
}

const HR = () => {
  const { getAll, addItem, updateItem, deleteItem } = useUserData();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: "",
    name: "",
    email: "",
    phone: "",
    department: "",
    password: "",
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await getAll<Employee>('employees');
      setEmployees(data);
    } catch (error: unknown) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: "",
      name: "",
      email: "",
      phone: "",
      department: "",
      password: "",
    });
    setShowPassword(false);
  };

  const handleCreateEmployee = async () => {
    if (!formData.employee_id || !formData.name || !formData.password) {
      toast.error("Employee ID, Name, and Password are required");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);
      const { password, ...rest } = formData;
      
      await addItem('employees', { 
        ...rest, 
        is_active: true, 
        password_hash: password,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      toast.success("Employee created successfully! They can now login.");
      setCreateDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error: unknown) {
      console.error("Error creating employee:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create employee");
    } finally {
      setSaving(false);
    }
  };

  const handleEditEmployee = async () => {
    if (!selectedEmployee || !formData.name) {
      toast.error("Name is required");
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);
      const updateData: Partial<Employee> & { id: string } = {
        id: selectedEmployee.id,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        department: formData.department || null,
      };

      if (formData.password) {
        updateData.password_hash = formData.password;
      }

      await updateItem('employees', selectedEmployee.id, updateData);

      toast.success("Employee updated successfully");
      setEditDialogOpen(false);
      resetForm();
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error: unknown) {
      console.error("Error updating employee:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update employee");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (employee: Employee) => {
    try {
      await updateItem('employees', employee.id, { is_active: !employee.is_active });
      toast.success(`Employee ${employee.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchEmployees();
    } catch (error: unknown) {
      console.error("Error toggling employee status:", error);
      toast.error("Failed to update employee status");
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      setSaving(true);
      await deleteItem('employees', selectedEmployee.id);
      toast.success("Employee deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error: unknown) {
      console.error("Error deleting employee:", error);
      toast.error("Failed to delete employee");
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      employee_id: employee.employee_id,
      name: employee.name,
      email: employee.email || "",
      phone: employee.phone || "",
      department: employee.department || "",
      password: "",
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.is_active).length,
    inactive: employees.filter(e => !e.is_active).length,
  };

  return (
    <DashboardLayout>
      <div className="mb-6 animate-fade-in pt-2 sm:pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">
              <span className="text-gradient-gold">HR</span> & Team Management
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Manage employees, track performance, and handle recruitment
            </p>
          </div>
          <Button 
            variant="gold" 
            className="shrink-0 w-full sm:w-auto"
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card variant="stat">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center gap-1 sm:gap-2">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 text-primary shrink-0" />
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Employees</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold">{loading ? '-' : stats.total}</p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center gap-1 sm:gap-2">
              <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 shrink-0" />
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Active</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-500">{loading ? '-' : stats.active}</p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center gap-1 sm:gap-2">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 shrink-0" />
              <p className="text-xs sm:text-sm text-muted-foreground">Inactive</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-yellow-500">{loading ? '-' : stats.inactive}</p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center gap-1 sm:gap-2">
              <Star className="w-3 h-3 sm:w-4 sm:h-4 text-primary shrink-0" />
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Inactive</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold">
              {loading ? '-' : employees.filter(e => !e.is_active).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Employee List */}
      <Card variant="elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UserCog className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              All Employees
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">No employees added yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first employee to enable Employee Login access to Inventory & POS
              </p>
              <Button 
                variant="gold"
                onClick={() => {
                  resetForm();
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Employee
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div 
                  key={emp.id} 
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
                        {emp.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">{emp.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        Login ID: <span className="font-mono font-medium text-foreground">{emp.employee_id}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                    <div className="text-left sm:text-right text-xs sm:text-sm">
                      <p className="text-muted-foreground">
                        Joined {format(new Date(emp.created_at), 'MMM yyyy')}
                      </p>
                      {emp.email && (
                        <p className="text-muted-foreground truncate max-w-[150px]">{emp.email}</p>
                      )}
                    </div>
                    <Badge 
                      variant={emp.is_active ? "default" : "secondary"}
                      className="text-xs whitespace-nowrap"
                    >
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(emp)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(emp)}>
                          {emp.is_active ? (
                            <>
                              <UserX className="w-4 h-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => openDeleteDialog(emp)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Employee Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new employee account. They will use Employee ID and Password to login via Employee Login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create_employee_id">Employee ID *</Label>
              <Input
                id="create_employee_id"
                placeholder="EMP001"
                value={formData.employee_id}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_name">Full Name *</Label>
              <Input
                id="create_name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_password">Password *</Label>
              <div className="relative">
                <Input
                  id="create_password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_email">Email (optional)</Label>
              <Input
                id="create_email"
                type="email"
                placeholder="employee@company.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_phone">Phone (optional)</Label>
              <Input
                id="create_phone"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleCreateEmployee} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee details. Leave password blank to keep the existing one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={formData.employee_id} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_name">Full Name *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_password">New Password (leave blank to keep existing)</Label>
              <div className="relative">
                <Input
                  id="edit_password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_phone">Phone</Label>
              <Input
                id="edit_phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleEditEmployee} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedEmployee?.name}? This action cannot be undone.
              The employee will no longer be able to login.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEmployee} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default HR;