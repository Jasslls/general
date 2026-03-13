// services/premium.ts
// Manages premium status for PagoFijo — stored in Firestore under users/{uid}.premium
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export type PremiumPlan = "none" | "trial" | "monthly" | "annual";

export interface PremiumStatus {
    plan: PremiumPlan;
    activatedAt: string | null;  // ISO string
    expiresAt: string | null;    // ISO string
    isActive: boolean;
}

const TRIAL_HOURS = 24; // 1-day free trial

/** Build a default inactive status */
function inactive(): PremiumStatus {
    return { plan: "none", activatedAt: null, expiresAt: null, isActive: false };
}

/** Given a raw firestore premium object, compute isActive based on current time */
function resolveStatus(raw: any): PremiumStatus {
    if (!raw || raw.plan === "none" || !raw.expiresAt) return inactive();

    const now = new Date().getTime();
    const exp = new Date(raw.expiresAt).getTime();
    const isActive = exp > now;

    return {
        plan: raw.plan ?? "none",
        activatedAt: raw.activatedAt ?? null,
        expiresAt: raw.expiresAt ?? null,
        isActive,
    };
}

/** Fetches premium status from Firestore */
export async function getPremiumStatus(uid: string): Promise<PremiumStatus> {
    try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) return inactive();

        const data = snap.data();
        return resolveStatus(data?.premium);
    } catch (e) {
        console.warn("getPremiumStatus error:", e);
        return inactive();
    }
}

/** Activates a 1-day free trial for the user */
export async function activateTrial(uid: string): Promise<PremiumStatus> {
    const now = new Date();
    const expires = new Date(now.getTime() + TRIAL_HOURS * 60 * 60 * 1000);

    const premiumData = {
        plan: "trial" as PremiumPlan,
        activatedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
    };

    try {
        const ref = doc(db, "users", uid);
        // Use setDoc with merge so we create it if it doesn't exist
        await setDoc(ref, { premium: premiumData }, { merge: true });
        return resolveStatus(premiumData);
    } catch (e) {
        console.error("activateTrial error:", e);
        throw e;
    }
}

/** Activates a paid plan (stub — real payment integration goes here) */
export async function activatePaidPlan(uid: string, plan: "monthly" | "annual"): Promise<void> {
    const now = new Date();
    const months = plan === "monthly" ? 1 : 12;
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + months);

    const premiumData = {
        plan,
        activatedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
    };

    const ref = doc(db, "users", uid);
    await setDoc(ref, { premium: premiumData }, { merge: true });
}

/** Cancels any active premium or trial */
export async function cancelPremium(uid: string): Promise<PremiumStatus> {
    try {
        const ref = doc(db, "users", uid);
        const data = inactive();
        await setDoc(ref, { premium: data }, { merge: true });
        return data;
    } catch (e) {
        console.error("cancelPremium error:", e);
        throw e;
    }
}

