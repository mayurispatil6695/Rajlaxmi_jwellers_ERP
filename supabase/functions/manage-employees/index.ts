import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface SyncBody {
  action: "sync";
  employee_id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  password_hash?: string;
  is_active?: boolean;
}

interface CreateBody {
  action: "create";
  employee_id: string;
  password: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
}

interface UpdateBody {
  action: "update";
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  is_active?: boolean;
  password?: string;
}

interface DeleteBody {
  action: "delete";
  id: string;
}

type RequestBody = SyncBody | CreateBody | UpdateBody | DeleteBody;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    const body = (await req.json()) as RequestBody;
    const action = body.action;

    // SYNC - Upsert employee from Firebase to Supabase
    if (action === "sync") {
      const { employee_id, name, email, phone, department, password_hash, is_active } = body as SyncBody;
      
      if (!employee_id) {
        return new Response(
          JSON.stringify({ error: "employee_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existing } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("employee_id", employee_id)
        .maybeSingle();

      if (existing) {
        const updates: Record<string, unknown> = {
          name,
          email: email || null,
          phone: phone || null,
          department: department || null,
          is_active: is_active !== false,
        };
        if (password_hash) updates.password_hash = password_hash;

        await supabaseAdmin.from("employees").update(updates).eq("id", existing.id);
      } else {
        if (!password_hash) {
          return new Response(
            JSON.stringify({ error: "password_hash required for new employee sync" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabaseAdmin.from("employees").insert({
          employee_id,
          name,
          email: email || null,
          phone: phone || null,
          department: department || null,
          password_hash,
          is_active: is_active !== false,
        });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CREATE - New employee with password hashing
    if (action === "create") {
      const { employee_id, password, name, email, phone, department } = body as CreateBody;

      if (!employee_id || !password || !name) {
        return new Response(
          JSON.stringify({ error: "Employee ID, password, and name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existing } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("employee_id", employee_id)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "Employee ID already exists" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordHash = await hashPassword(password);

      const { data: newEmployee, error } = await supabaseAdmin
        .from("employees")
        .insert({
          employee_id,
          password_hash: passwordHash,
          name,
          email: email || null,
          phone: phone || null,
          department: department || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, employee: newEmployee }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE
    if (action === "update") {
      const { id, name, email, phone, department, is_active, password } = body as UpdateBody;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Employee ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (department !== undefined) updates.department = department;
      if (is_active !== undefined) updates.is_active = is_active;

      if (password) {
        if (password.length < 6) {
          return new Response(
            JSON.stringify({ error: "Password must be at least 6 characters" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        updates.password_hash = await hashPassword(password);
      }

      const { data: updated, error } = await supabaseAdmin
        .from("employees")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      if (is_active === false) {
        await supabaseAdmin.from("employee_sessions").delete().eq("employee_id", id);
      }

      return new Response(
        JSON.stringify({ success: true, employee: updated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE
    if (action === "delete") {
      const { id } = body as DeleteBody;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Employee ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabaseAdmin.from("employees").delete().eq("id", id);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Manage employees error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});