import React, { createContext, useContext, useEffect, useState } from "react";
import { PremiumStatus } from "../models/types";
import { getPremiumStatus, activateTrial as doActivateTrial, cancelPremium as doCancelPremium } from "../services/premium";
import { useAuth } from "../context/AuthContext";


interface PremiumContextType {
    isPremium: boolean;
    status: PremiumStatus | null;
    loading: boolean;
    trialAvailable: boolean;
    activateTrial: () => Promise<void>;
    cancelPremium: () => Promise<void>;
    refresh: () => Promise<void>;
}

const INACTIVE: PremiumStatus = {
    plan: "none",
    activatedAt: null,
    expiresAt: null,
    isActive: false,
};

const PremiumContext = createContext<PremiumContextType>({
    isPremium: false,
    status: null,
    loading: true,
    trialAvailable: false,
    activateTrial: async () => {},
    cancelPremium: async () => {},
    refresh: async () => {},
});

export const usePremiumContext = () => useContext(PremiumContext);

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const uid = user?.id;

    const [status, setStatus] = useState<PremiumStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        if (!uid) {
            setStatus(INACTIVE);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const s = await getPremiumStatus(uid);
            setStatus(s);
        } catch {
            setStatus(INACTIVE);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [uid]);

    const activateTrial = async () => {
        if (!uid) return;
        const s = await doActivateTrial(uid);
        setStatus(s);
    };

    const cancelPremium = async () => {
        if (!uid) return;
        const s = await doCancelPremium(uid);
        setStatus(s);
    };

    const isPremium = status?.isActive === true;
    const trialAvailable = !status || status.plan === "none";

    return (
        <PremiumContext.Provider 
            value={{ 
                isPremium, 
                status, 
                loading, 
                trialAvailable, 
                activateTrial, 
                cancelPremium,
                refresh: load 
            }}
        >
            {children}
        </PremiumContext.Provider>
    );
};

