import { auth, db } from "@/firebaseConfig";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LoadingScreen from "./components/loading_screen";
import { usePet } from "./context/petContext";

const TEAL = "#47D9D7";
const TEAL_LIGHT = "#D4F1F4";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_MID = "#555555";
const TEXT_LIGHT = "#888888";

function calcAge(birthday: string): string {
    if (!birthday) return "Unknown";
    const birth = new Date(birthday);
    if (isNaN(birth.getTime())) return "Unknown";
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (now.getDate() < birth.getDate()) months--;
    if (months < 0) { years--; months += 12; }
    if (years <= 0 && months <= 0) return "< 1 month old";
    if (years === 0) return `${months} month${months !== 1 ? "s" : ""} old`;
    if (months === 0) return `${years} year${years !== 1 ? "s" : ""} old`;
    return `${years} year${years !== 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""} old`;
}

export default function SelectPetScreen() {
    const [petProfiles, setPetProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tempSelectedId, setTempSelectedId] = useState<string | null>(null);
    const currentUser = auth.currentUser;
    const { selectedPetId, setSelectedPetId } = usePet();

    useEffect(() => {
        const fetchPetProfiles = async () => {
            if (!currentUser) { setLoading(false); return; }
            try {
                const petsQuery = query(collection(db, "pet_profile"), where("uid", "==", currentUser.uid));
                const querySnapshot = await getDocs(petsQuery);
                const pets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPetProfiles(pets);
            } catch (error) {
                console.error("Error fetching pet profiles:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPetProfiles();
    }, [currentUser]);

    //Pre-select the currently active pet when screen loads
    useEffect(() => {
        if (selectedPetId) setTempSelectedId(selectedPetId);
    }, [selectedPetId]);

    const handleSelectPet = async () => {
        if (!tempSelectedId) return;
        //Only now commit to context + AsyncStorage
        await setSelectedPetId(tempSelectedId);
        router.replace("/home");
    };

    if (loading) {
        return <LoadingScreen message="Fetching pet profiles..." />;
    }

    return (
        <View style={styles.root}>
            <View style={styles.topContainer}>
                <TouchableOpacity onPress={() => router.replace("/home")} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={16} color={WHITE} />
                    <Text style={styles.backText}>BACK</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.card}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.title}>Select a Pet Profile</Text>
                    <Text style={styles.subtitle}>
                        Choose the pet you'd like to manage from your profiles below.
                    </Text>

                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => router.replace("/pet_profile_creation")}
                    >
                        <Text style={styles.createButtonText}>CREATE PET PROFILE</Text>
                    </TouchableOpacity>

                    <Text style={styles.sectionLabel}>PET PROFILES</Text>

                    {petProfiles.length === 0 ? (
                        <Text style={styles.emptyText}>No pet profiles yet.</Text>
                    ) : (
                        petProfiles.map((pet) => {
                            const isSelected = tempSelectedId === pet.id;
                            const isCat = pet.type?.toLowerCase() === "cat";
                            return (
                                <Pressable
                                    key={pet.id}
                                    style={[styles.petCard, isSelected && styles.petCardSelected]}
                                    onPress={() => setTempSelectedId(isSelected ? null : pet.id)}
                                >
                                    <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                                        <MaterialCommunityIcons
                                            name={isCat ? "cat" : "dog"}
                                            size={40}
                                            color={isSelected ? WHITE : TEAL}
                                        />
                                    </View>

                                    <View style={styles.petInfo}>
                                        <Text style={styles.petName}>{pet.name}</Text>
                                        <Text style={styles.petDetail}>{pet.breed ?? "Unknown breed"}</Text>
                                        <Text style={styles.petDetail}>
                                            {pet.birthday
                                                ? new Date(pet.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                                                : "No birthday set"}
                                        </Text>
                                        <Text style={styles.petDetail}>{calcAge(pet.birthday)}</Text>
                                    </View>

                                    {isSelected && (
                                        <Ionicons name="checkmark-circle" size={22} color={TEAL} style={{ alignSelf: "center" }} />
                                    )}
                                </Pressable>
                            );
                        })
                    )}
                </ScrollView>

                {tempSelectedId && (
                    <View style={styles.floatingButton}>
                        <TouchableOpacity style={styles.selectButton} onPress={handleSelectPet}>
                            <Text style={styles.selectButtonText}>SELECT PET</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: TEAL
    },
    topContainer: {
        paddingTop: 64,
        paddingHorizontal: 20,
        paddingBottom: 100
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    backText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 0.5
    },
    card: {
        flex: 1,
        backgroundColor: WHITE,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        overflow: "hidden"
    },
    scrollContent: {
        padding: 24,
        paddingTop: 20,
        paddingBottom: 100
    },
    title: {
        fontSize: 26,
        fontWeight: "800",
        color: BLACK,
        textAlign: "center",
        marginBottom: 8
    },
    subtitle: {
        fontSize: 13,
        color: TEXT_LIGHT,
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 18,
        paddingHorizontal: 8
    },
    createButton: {
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 25,
        paddingVertical: 13,
        alignItems: "center",
        marginBottom: 28
    },
    createButtonText: {
        color: TEAL,
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 1
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: "800",
        color: BLACK,
        letterSpacing: 0.5,
        marginBottom: 12
    },
    emptyText: {
        textAlign: "center",
        color: TEXT_LIGHT,
        marginTop: 20,
        fontSize: 14
    },
    petCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: WHITE,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: "#E0E0E0",
        padding: 14,
        marginBottom: 12,
        gap: 14
    },
    petCardSelected: {
        borderColor: TEAL,
        backgroundColor: TEAL_LIGHT
    },
    iconBox: {
        width: 64,
        height: 64,
        borderRadius: 14,
        backgroundColor: TEAL_LIGHT,
        alignItems: "center",
        justifyContent: "center"
    },
    iconBoxSelected: {
        backgroundColor: TEAL
    },
    petInfo: {
        flex: 1
    },
    petName: {
        fontSize: 16,
        fontWeight: "700",
        color: BLACK,
        marginBottom: 3
    },
    petDetail: {
        fontSize: 13,
        color: TEXT_MID,
        marginBottom: 1
    },
    floatingButton: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: WHITE,
        borderTopWidth: 1,
        borderTopColor: "#F0F0F0"
    },
    selectButton: {
        backgroundColor: TEAL,
        borderRadius: 25,
        paddingVertical: 14,
        marginBottom: 30,
        alignItems: "center"
    },
    selectButtonText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 15,
        letterSpacing: 0.5
    }
});