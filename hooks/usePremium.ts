// hooks/usePremium.ts
// Global hook to access the synchronized premium state
import { usePremiumContext } from "../context/PremiumContext";

export function usePremium() {
    return usePremiumContext();
}
