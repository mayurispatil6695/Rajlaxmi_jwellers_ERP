import { ref, get, push, set, update } from "firebase/database";
import { db } from "@/lib/firebase";

// Helper: get Firebase path (shared for employees)
function getFirebasePath(path: string): string {
  // If you want employees to see shared data, use 'shared_' prefix
  if (path === "products") return "shared_products";
  return path;
}

export async function employeeGetAll<T>(path: string): Promise<(T & { id: string })[]> {
  const actualPath = getFirebasePath(path);
  const snapshot = await get(ref(db, actualPath));
  if (!snapshot.exists()) return [];
  const items: (T & { id: string })[] = [];
  snapshot.forEach((child) => {
    items.push({ id: child.key!, ...child.val() });
  });
  return items;
}

export async function employeeAddItem<T extends Record<string, unknown>>(path: string, itemData: T): Promise<string> {
  const actualPath = getFirebasePath(path);
  const newRef = push(ref(db, actualPath));
  await set(newRef, {
    ...itemData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return newRef.key!;
}

export async function employeeUpdateItem(path: string, id: string, itemData: Record<string, unknown>): Promise<void> {
  const actualPath = getFirebasePath(path);
  await update(ref(db, `${actualPath}/${id}`), {
    ...itemData,
    updated_at: new Date().toISOString(),
  });
}