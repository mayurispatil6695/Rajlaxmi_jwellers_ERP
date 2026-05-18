import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { addItem, getAll } from '@/lib/firebaseDb';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, IdCard } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { z } from 'zod';

const emailSchema = z.string().trim().email({ message: "Please enter a valid email address" });
const authSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});
const employeeSchema = z.object({
  employee_id: z.string().trim().min(1, { message: "Employee ID is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; employee_id?: string }>({});
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailError, setForgotEmailError] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);
  const [loginType, setLoginType] = useState<'admin' | 'employee'>('admin');
  
  const { signIn, signUp, resetPassword, user, loading } = useAuth();
  const { signIn: employeeSignIn, employee, loading: employeeLoading } = useEmployeeAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotEmailError('');
    try { emailSchema.parse(forgotEmail); } catch (error) { if (error instanceof z.ZodError) setForgotEmailError(error.errors[0].message); return; }
    
    setIsForgotLoading(true);
    const { error } = await resetPassword(forgotEmail);
    setIsForgotLoading(false);

    if (error) {
      toast({ variant: "destructive", title: "Failed to send reset email", description: error.message });
    } else {
      toast({ title: "Check your email", description: "We've sent you a password reset link." });
      setForgotDialogOpen(false);
      setForgotEmail('');
    }
  };


  useEffect(() => {
    if (!loading && user) navigate('/');
    if (!employeeLoading && employee) navigate('/employee-dashboard');
  }, [user, loading, employee, employeeLoading, navigate]);

  const validateAdminForm = () => {
  try {
    authSchema.parse({ email, password });
    setErrors({});
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fe: { email?: string; password?: string } = {};
      error.errors.forEach((err) => {
        if (err.path[0] === 'email') fe.email = err.message;
        if (err.path[0] === 'password') fe.password = err.message;
      });
      setErrors(fe);
    }
    return false;
  }
};

const validateEmployeeForm = () => {
  try {
    employeeSchema.parse({ employee_id: employeeId, password: employeePassword });
    setErrors({});
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fe: { employee_id?: string; password?: string } = {};
      error.errors.forEach((err) => {
        if (err.path[0] === 'employee_id') fe.employee_id = err.message;
        if (err.path[0] === 'password') fe.password = err.message;
      });
      setErrors(fe);
    }
    return false;
  }
};

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAdminForm()) return;
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) { toast({ variant: "destructive", title: "Sign in failed", description: error.message === "Invalid login credentials" ? "Invalid email or password. Please try again." : error.message }); }
    else { toast({ title: "Welcome back!", description: "You have successfully signed in." }); navigate('/'); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAdminForm()) return;
    setIsLoading(true);
    const { error } = await signUp(email, password);
    if (error) {
      setIsLoading(false);
      toast({ variant: "destructive", title: "Sign up failed", description: error.message });
      return;
    }

    try {
      // Wait for auth state to update and get the user
      const { auth } = await import('@/lib/firebase');
      const newUser = auth.currentUser;
      if (newUser) {
        // Save profile to Firebase RTDB
        await addItem('profiles', {
          user_id: newUser.uid,
          email: newUser.email || email,
          display_name: newUser.email?.split('@')[0] || email.split('@')[0],
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Auto-assign admin role
        await addItem('user_roles', {
          user_id: newUser.uid,
          role: 'admin',
          created_at: new Date().toISOString(),
        });
      }
    } catch (profileError) {
      console.error('Error saving profile:', profileError);
    }

    setIsLoading(false);
    toast({ title: "Account created!", description: "You have successfully signed up as Admin." });
    navigate('/');
  };

  const handleEmployeeSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmployeeForm()) return;
    setIsLoading(true);
    const { error } = await employeeSignIn(employeeId, employeePassword);
    setIsLoading(false);
    if (error) { toast({ variant: "destructive", title: "Sign in failed", description: error.message || "Invalid credentials. Please try again." }); }
    else { toast({ title: "Welcome!", description: "You have successfully signed in." }); navigate('/employee-dashboard'); }
  };

  if (loading || employeeLoading) {
    return (<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>);
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <img src={logoImg} alt="Rajlakshmi Jewel ERP" className="mx-auto h-20 w-auto object-contain mb-2" />
          <CardTitle className="text-2xl font-bold font-display">Rajlakshmi Jewel ERP</CardTitle>
<CardDescription>Sign in to access your jewellery ERP</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Button variant={loginType === 'admin' ? 'default' : 'outline'} className={`flex-1 ${loginType === 'admin' ? 'bg-gradient-gold hover:opacity-90' : ''}`} onClick={() => setLoginType('admin')}><User className="w-4 h-4 mr-2" />Admin</Button>
            <Button variant={loginType === 'employee' ? 'default' : 'outline'} className={`flex-1 ${loginType === 'employee' ? 'bg-gradient-gold hover:opacity-90' : ''}`} onClick={() => setLoginType('employee')}><IdCard className="w-4 h-4 mr-2" />Employee</Button>
          </div>

          {loginType === 'admin' ? (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6"><TabsTrigger value="signin">Sign In</TabsTrigger><TabsTrigger value="signup">Sign Up</TabsTrigger></TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="signin-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" disabled={isLoading} /></div>
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" disabled={isLoading} /></div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                    <Dialog open={forgotDialogOpen} onOpenChange={setForgotDialogOpen}>
                      <DialogTrigger asChild><button type="button" className="text-sm text-primary hover:underline">Forgot password?</button></DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Reset your password</DialogTitle><DialogDescription>Enter your email address and we'll send you a link to reset your password.</DialogDescription></DialogHeader>
                        <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
                          <div className="space-y-2"><Label htmlFor="forgot-email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="forgot-email" type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="pl-10" disabled={isForgotLoading} /></div>{forgotEmailError && <p className="text-sm text-destructive">{forgotEmailError}</p>}</div>
                          <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={isForgotLoading}>{isForgotLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : 'Send Reset Link'}</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={isLoading}>{isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : 'Sign In'}</Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" disabled={isLoading} /></div>
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" disabled={isLoading} /></div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={isLoading}>{isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>) : 'Create Account'}</Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <form onSubmit={handleEmployeeSignIn} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="employee-id">Employee ID</Label><div className="relative"><IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="employee-id" type="text" placeholder="EMP001" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="pl-10" disabled={isLoading} /></div>{errors.employee_id && <p className="text-sm text-destructive">{errors.employee_id}</p>}</div>
              <div className="space-y-2"><Label htmlFor="employee-password">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="employee-password" type="password" placeholder="••••••••" value={employeePassword} onChange={(e) => setEmployeePassword(e.target.value)} className="pl-10" disabled={isLoading} /></div>{errors.password && <p className="text-sm text-destructive">{errors.password}</p>}</div>
              <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={isLoading}>{isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : 'Sign In as Employee'}</Button>
              <p className="text-xs text-center text-muted-foreground mt-4">Employee accounts are created by the administrator. Contact your admin if you don't have an account.</p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
