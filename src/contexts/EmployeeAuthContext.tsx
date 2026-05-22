import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string | null;
  department: string | null;
}

// Shape of employee data stored in Firebase
interface RawEmployee {
  employee_id: string;
  name: string;
  email: string | null;
  department: string | null;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmployeeAuthContextType {
  employee: Employee | null;
  loading: boolean;
  signIn: (employeeId: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined);
const SESSION_KEY = 'employee_session';
const EMPLOYEES_PATH = 'shared_employees';

export function EmployeeAuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        if (session.employee && new Date(session.expires_at) > new Date()) {
          setEmployee(session.employee);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (employeeId: string, password: string) => {
    try {
      const employeesRef = ref(db, EMPLOYEES_PATH);
      const snapshot = await get(employeesRef);
      if (!snapshot.exists()) {
        return { error: new Error('No employees found') };
      }

      const allEmployees = snapshot.val() as Record<string, RawEmployee> | null;
      if (!allEmployees) {
        return { error: new Error('No employee data') };
      }

      let foundEmployee: RawEmployee | null = null;
      let foundKey: string | null = null;

      for (const [key, emp] of Object.entries(allEmployees)) {
        if (emp.employee_id === employeeId) {
          foundEmployee = emp;
          foundKey = key;
          break;
        }
      }

      if (!foundEmployee) {
        return { error: new Error('Invalid credentials') };
      }

      if (foundEmployee.password_hash !== password) {
        return { error: new Error('Invalid credentials') };
      }

      if (!foundEmployee.is_active) {
        return { error: new Error('Account deactivated') };
      }

      const employeeData: Employee = {
        id: foundKey,
        employee_id: foundEmployee.employee_id,
        name: foundEmployee.name,
        email: foundEmployee.email || null,
        department: foundEmployee.department || null,
      };

      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        employee: employeeData,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
      }));

      setEmployee(employeeData);
      return { error: null };
    } catch (error) {
      console.error('Login error:', error);
      return { error: error instanceof Error ? error : new Error('Login failed') };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    setEmployee(null);
  };

  return (
    <EmployeeAuthContext.Provider value={{ employee, loading, signIn, signOut, isAuthenticated: !!employee }}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const context = useContext(EmployeeAuthContext);
  if (context === undefined) {
    throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider');
  }
  return context;
}