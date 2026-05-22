import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";
import { ref, get, push, set, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";

/**
 * Hook that provides Firebase RTDB helpers scoped to the current user.
 * All data is stored under `users/{uid}/{collection}` so each user
 * only sees their own data.
 */
export function useUserData() {
  const { user } = useAuth();

  const getUserPath = useCallback(
  (collection: string) => {
    if (!user?.uid) throw new Error("User not authenticated");
    // Use shared location for employees and products
    if (collection === "employees") {
      return "shared_employees";
    }
    if (collection === "products") {
      return "shared_products";
    }
    return `users/${user.uid}/${collection}`;
  },
  [user?.uid]
);

  const getAll = useCallback(
    async <T>(collection: string): Promise<(T & { id: string })[]> => {
      const path = getUserPath(collection);
      const snapshot = await get(ref(db, path));
      if (!snapshot.exists()) return [];
      const items: (T & { id: string })[] = [];
      snapshot.forEach((child) => {
        items.push({ id: child.key!, ...child.val() });
      });
      return items;
    },
    [getUserPath]
  );

  const getById = useCallback(
    async <T>(collection: string, id: string): Promise<(T & { id: string }) | null> => {
      const path = getUserPath(collection);
      const snapshot = await get(ref(db, `${path}/${id}`));
      if (!snapshot.exists()) return null;
      return { id, ...snapshot.val() };
    },
    [getUserPath]
  );

  const addItem = useCallback(
    async <T extends Record<string, unknown>>(collection: string, data: T): Promise<string> => {
      const path = getUserPath(collection);
      const newRef = push(ref(db, path));
      await set(newRef, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return newRef.key!;
    },
    [getUserPath]
  );

  const updateItem = useCallback(
    async (collection: string, id: string, data: Record<string, unknown>): Promise<void> => {
      const path = getUserPath(collection);
      await update(ref(db, `${path}/${id}`), {
        ...data,
        updated_at: new Date().toISOString(),
      });
    },
    [getUserPath]
  );

  const deleteItem = useCallback(
    async (collection: string, id: string): Promise<void> => {
      const path = getUserPath(collection);
      await remove(ref(db, `${path}/${id}`));
    },
    [getUserPath]
  );

  const getByField = useCallback(
    async <T>(collection: string, field: string, value: unknown): Promise<(T & { id: string })[]> => {
      const path = getUserPath(collection);
      const snapshot = await get(ref(db, path));
      if (!snapshot.exists()) return [];
      const items: (T & { id: string })[] = [];
      snapshot.forEach((child) => {
        const data = child.val();
        // Strict equality works for strings, numbers, booleans, null.
        if (data[field] === value) {
          items.push({ id: child.key!, ...data });
        }
      });
      return items;
    },
    [getUserPath]
  );

  return { getAll, getById, addItem, updateItem, deleteItem, getByField, userId: user?.uid };
}