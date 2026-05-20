import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useAuth } from "./authContext";

type PetContextType = {
    selectedPetId: string | null;
    petLoading: boolean;
    setSelectedPetId: (id: string | null) => void;
};

const PetContext = createContext<PetContextType | undefined>(undefined);

export const PetProvider = ({ children }: { children: ReactNode }) => {
    const [selectedPetId, setSelectedPetIdState] = useState<string | null>(null);
    const [petLoading, setPetLoading] = useState(true);
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;

        if (user) {
            const loadPetId = async () => {
                try {
                    const savedId = await AsyncStorage.getItem("selectedPetId");
                    if (savedId) setSelectedPetIdState(savedId);
                } catch (e) {
                    console.error("Failed to load pet ID:", e);
                } finally {
                    setPetLoading(false);
                }
            };
            loadPetId();
        } else {
            AsyncStorage.removeItem("selectedPetId").catch(() => {});
            setSelectedPetIdState(null);
            setPetLoading(false);
        }
    }, [user, loading]);

    const setSelectedPetId = async (id: string | null) => {
        try {
            if (id) {
                await AsyncStorage.setItem("selectedPetId", id);
            } else {
                await AsyncStorage.removeItem("selectedPetId");
            }
            setSelectedPetIdState(id);
        } catch (e) {
            console.error("Failed to save pet ID:", e);
        }
    };

    return (
        <PetContext.Provider value={{ selectedPetId, petLoading, setSelectedPetId }}>
            {children}
        </PetContext.Provider>
    );
};

export const usePet = () => {
    const context = useContext(PetContext);
    if (!context) throw new Error("usePet must be used within PetProvider");
    return context;
};