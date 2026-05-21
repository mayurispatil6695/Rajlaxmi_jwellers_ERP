import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIREBASE_DB_URL = "https://jewellery-1f0be-default-rtdb.firebaseio.com";
const FIREBASE_API_KEY = "AIzaSyDeS9pG468xGTcSBb31GBli3n4ZUWo5sVc";

// Cache the ID token to avoid signing in on every request
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getFirebaseIdToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const email = Deno.env.get("FIREBASE_ADMIN_EMAIL");
  const password = Deno.env.get("FIREBASE_ADMIN_PASSWORD");

  if (!email || !password) {
    throw new Error("Firebase admin credentials not configured");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const data = await res.json();
  if (data.error) {
    console.error("Firebase Auth error:", JSON.stringify(data.error));
    throw new Error(data.error.message || "Firebase auth failed");
  }

  cachedToken = data.idToken;
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return cachedToken!;
}

// Helper to map collection paths to shared locations for employees
function getFirestorePath(originalPath: string): string {
  // For products, use the shared root node
  if (originalPath === "products") {
    return "shared_products";
  }
  // All other collections stay as they are
  return originalPath;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const idToken = await getFirebaseIdToken();
    const { path, action, data, id } = await req.json();

    if (!path) {
      return new Response(JSON.stringify({ error: "path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authParam = `auth=${idToken}`;
    const actualPath = getFirestorePath(path);

    // READ
    if (!action || action === "getAll") {
      const url = id
        ? `${FIREBASE_DB_URL}/${actualPath}/${id}.json?${authParam}`
        : `${FIREBASE_DB_URL}/${actualPath}.json?${authParam}`;
      const res = await fetch(url);
      const raw = await res.json();

      if (!raw || (typeof raw === "object" && raw.error)) {
        console.error("Firebase read error:", raw);
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (typeof raw === "string") {
        console.error("Firebase returned string:", raw);
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (id) {
        return new Response(JSON.stringify({ id, ...raw }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const items = Object.entries(raw).map(([key, val]: [string, any]) => ({
        id: key,
        ...val,
      }));

      return new Response(JSON.stringify(items), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADD
    if (action === "add") {
      const res = await fetch(`${FIREBASE_DB_URL}/${actualPath}.json?${authParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      const result = await res.json();
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ id: result.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE
    if (action === "update" && id) {
      const res = await fetch(`${FIREBASE_DB_URL}/${actualPath}/${id}.json?${authParam}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          updated_at: new Date().toISOString(),
        }),
      });
      const result = await res.json();
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Edge function error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});