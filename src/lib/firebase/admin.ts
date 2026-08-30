import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
export const firebaseAdminConfigured = Boolean(projectId);

function app() {
  if (!firebaseAdminConfigured) throw new Error("Firebase Admin is not configured. Set FIREBASE_PROJECT_ID.");
  if (getApps().length) return getApps()[0]!;
  return initializeApp({ credential: applicationDefault(), projectId, storageBucket });
}

export function adminAuth() { return getAuth(app()); }
export function adminDb() { return getFirestore(app()); }
export function adminStorage() { return getStorage(app()); }
