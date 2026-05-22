import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 👇 Update these to YOUR new Firebase project values
const FIREBASE_DB_URL = "https://rajlaxmi-jewellers-default-rtdb.firebaseio.com";
const FIREBASE_API_KEY = "AIzaSyAEaOljszS6_MbVH94eH6W1MuqNDj9M-aA";

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
    },
  );

  const data = await res.json() as { error?: { message: string }; idToken?: string };
  if (data.error) {
    console.error("Firebase Auth error:", JSON.stringify(data.error));
    throw new Error(data.error.message || "Firebase auth failed");
  }

  cachedToken = data.idToken!;
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return cachedToken!;
}

// Helper to map collection paths to shared locations for employees
function getFirestorePath(originalPath: string): string {
  if (originalPath === "products") {
    return "shared_products";
  }
  return originalPath;
}

interface RequestBody {
  path?: string;
  action?: string;
  data?: Record<string, unknown>;
  id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const idToken = await getFirebaseIdToken();
    const body = await req.json() as RequestBody;
    const { path, action, data, id } = body;

    if (!path) {
      return new Response(JSON.stringify({ error: "path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authParam = `auth=${idToken}`;
    const actualPath = getFirestorePath(path);

    // READ (getAll)
    if (!action || action === "getAll") {
      const url = id
        ? `${FIREBASE_DB_URL}/${actualPath}/${id}.json?${authParam}`
        : `${FIREBASE_DB_URL}/${actualPath}.json?${authParam}`;
      const response = await fetch(url);
      const raw: unknown = await response.json();

      if (!raw || (typeof raw === "object" && (raw as { error?: unknown }).error)) {
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
        return new Response(JSON.stringify({ id, ...(raw as Record<string, unknown>) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // raw is an object with keys as ids
      const items = Object.entries(raw as Record<string, unknown>).map(([key, val]) => ({
        id: key,
        ...(val as Record<string, unknown>),
      }));

      return new Response(JSON.stringify(items), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADD
    if (action === "add") {
      const response = await fetch(`${FIREBASE_DB_URL}/${actualPath}.json?${authParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(data || {}),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      const result = await response.json() as { error?: unknown; name?: string };
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
      const response = await fetch(`${FIREBASE_DB_URL}/${actualPath}/${id}.json?${authParam}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(data || {}),
          updated_at: new Date().toISOString(),
        }),
      });
      const result = await response.json() as { error?: unknown };
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