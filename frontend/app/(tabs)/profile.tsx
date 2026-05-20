import { auth, db } from "@/firebaseConfig";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import LoadingScreen from "../components/loading_screen";
import { usePet } from "../context/petContext";

const TEAL = "#47D9D7";
const TEAL_LIGHT = "#D4F1F4";
const BACKGROUND_COLOR = "#FFFFFF";
const OVERLAY = "#00000066";
const LABEL = "#555555";
const INPUT = "#CCCCCC";
const CANCEL_TEXT = "#888888";
const TEXT_LIGHT = "#888888";

const CAT_CLASSES = [
    { key: "domestic_lean", label: "Lean" },
    { key: "domestic_overweight", label: "Overweight" },
];

const DOG_CLASSES = [
    { key: "active_laboratory_kennel_dogs", label: "Active / Kennel Dog", note: "Average for laboratory kennel dogs or active pet dogs" },
    { key: "young_adult_laboratory_active_pet_dogs", label: "Young Adult Active Pet Dog", note: "Above average — young adult lab or active pet dogs" },
    { key: "adult_laboratory_active_great_dane_pet_dogs", label: "Adult Active Dog (Great Dane)", note: "Above average — adult lab/active Great Danes" },
    { key: "adult_laboratory_active_terrier_pet_dogs", label: "Adult Active Dog (Terrier)", note: "Above average — adult lab/active terriers" },
    { key: "inactive_pet_dogs", label: "Inactive Pet Dog", note: "Below average — inactive pet dogs" },
];

const petClassLabels: Record<string, string> = {
    domestic_lean: "Lean",
    domestic_overweight: "Overweight",
    inactive_pet_dogs: "Inactive Pet Dog",
    active_laboratory_kennel_dogs: "Active / Kennel Dog",
    young_adult_laboratory_active_pet_dogs: "Young Adult Active Pet Dog",
    adult_laboratory_active_great_dane_pet_dogs: "Adult Active Dog (Great Dane)",
    adult_laboratory_active_terrier_pet_dogs: "Adult Active Dog (Terrier)",
};

function getPetClassLabel(value: string): string {
    return petClassLabels[value] ?? value;
}

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

type ClassOption = { key: string; label: string; note?: string };

type ClassDropdownProps = {
    options: ClassOption[];
    value: string;
    onChange: (key: string) => void;
    placeholder?: string;
};

function ClassDropdown({ options, value, onChange, placeholder = "Select a class" }: ClassDropdownProps) {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find((o) => o.key === value)?.label;

    return (
        <View>
            <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setOpen(true)}
                activeOpacity={0.7}
            >
                <Text style={[styles.dropdownTriggerText, !selectedLabel && styles.dropdownPlaceholder]}>
                    {selectedLabel ?? placeholder}
                </Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={TEAL} />
            </TouchableOpacity>

            {open && (
                <View style={styles.dropdownList}>
                    {options.map(({ key, label, note }) => {
                        const selected = value === key;
                        return (
                            <TouchableOpacity
                                key={key}
                                style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                                onPress={() => { onChange(key); setOpen(false); }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.classRadio, selected && styles.classRadioSelected]}>
                                    {selected && <View style={styles.classRadioDot} />}
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.dropdownItemLabel, selected && { color: TEAL }]}>
                                        {label}
                                    </Text>
                                    {note ? (
                                        <Text style={styles.dropdownItemNote}>{note}</Text>
                                    ) : null}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

export default function ProfileScreen() {
    const { selectedPetId } = usePet();
    const [petData, setPetData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editVisible, setEditVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editForm, setEditForm] = useState({
        birthday: "",
        petClass: "",
        weight: "",
    });

    const router = useRouter();

    function handleLogout() {
        signOut(auth).then(() => {
            router.replace("/root");
        });
    }

    function handleSwitch() {
        router.push("/select_pet");
    }

    function openEdit() {
        setEditForm({
            birthday: petData?.birthday || "",
            petClass: petData?.petClass || "",
            weight: petData?.weight?.toString() || "",
        });
        setEditVisible(true);
    }

    async function handleSave() {
        if (!selectedPetId) return;
        setSaving(true);
        try {
            const docRef = doc(db, "pet_profile", selectedPetId);
            await updateDoc(docRef, {
                birthday: editForm.birthday,
                petClass: editForm.petClass,
                weight: editForm.weight,
            });
            setPetData((prev: any) => ({ ...prev, ...editForm }));
            setEditVisible(false);
        } catch (error) {
            console.error("Error updating pet data:", error);
        } finally {
            setSaving(false);
        }
    }

    useEffect(() => {
        const fetchPetData = async () => {
            if (!selectedPetId) {
                setPetData(null);
                setLoading(false);
                return;
            }
            try {
                const docRef = doc(db, "pet_profile", selectedPetId);
                const docSnap = await getDoc(docRef);
                setPetData(docSnap.exists() ? docSnap.data() : null);
            } catch (error) {
                console.error("Error fetching pet data:", error);
                setPetData(null);
            } finally {
                setLoading(false);
            }
        };
        fetchPetData();
    }, [selectedPetId]);

    if (loading) {
        return <LoadingScreen message="Fetching pet profile details..." />;
    }

    if (!petData) {
        return (
            <View style={styles.center}>
                <Text style={styles.title}>No pet selected</Text>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text>Logout</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const petType = (petData.type || "").toLowerCase();
    const petIcon = petType.includes("cat") ? "cat" : "dog";
    const isCat = petType.includes("cat");
    const classList = isCat ? CAT_CLASSES : DOG_CLASSES;
    const dropdownLabel = isCat ? "Body Condition" : "Activity Level";

    return (
        <View style={styles.container}>
            {/* Details Card */}
            <View style={styles.card}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>DETAILS</Text>
                    <Text style={styles.cardDetail}>Pet Name: {petData.name}</Text>
                    <Text style={styles.cardDetail}>Breed: {petData.breed}</Text>
                    <Text style={styles.cardDetail}>Date of Birth: {petData.birthday}</Text>
                    <Text style={styles.cardDetail}>Age: {calcAge(petData.birthday)}</Text>
                    {petData.petClass ? (
                        <Text style={styles.cardDetail}>Class: {getPetClassLabel(petData.petClass)}</Text>
                    ) : null}
                    {petData.weight ? (
                        <Text style={styles.cardDetail}>Weight: {petData.weight} kg</Text>
                    ) : null}
                </View>
                <View style={styles.iconWrapper}>
                    <MaterialCommunityIcons name={petIcon} size={90} color="#FFFFFF" />
                </View>
            </View>

            <TouchableOpacity style={styles.outlineButton} onPress={openEdit}>
                <Ionicons name="pencil-outline" size={18} color={TEAL} style={styles.buttonIcon} />
                <Text style={styles.outlineButtonText}>EDIT PROFILE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.outlineButton} onPress={handleSwitch}>
                <Ionicons name="swap-horizontal-outline" size={18} color={TEAL} style={styles.buttonIcon} />
                <Text style={styles.outlineButtonText}>SWITCH PET PROFILE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.logoutButtonText}>LOG OUT</Text>
            </TouchableOpacity>

            {/* Edit Modal */}
            <Modal visible={editVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={styles.modalTitle}>Edit Pet Details</Text>

                            <Text style={styles.label}>Birthday</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.birthday}
                                onChangeText={(v) => setEditForm((p) => ({ ...p, birthday: v }))}
                                placeholder="e.g. 2020-04-15"
                            />

                            {/* Class Dropdown */}
                            <Text style={styles.label}>{dropdownLabel}</Text>
                            <ClassDropdown
                                options={classList}
                                value={editForm.petClass}
                                onChange={(key) => setEditForm((p) => ({ ...p, petClass: key }))}
                                placeholder={`Select ${dropdownLabel.toLowerCase()}`}
                            />

                            <Text style={styles.label}>Weight (kg)</Text>
                            <TextInput
                                style={styles.input}
                                value={editForm.weight}
                                onChangeText={(v) => setEditForm((p) => ({ ...p, weight: v }))}
                                placeholder="e.g. 4.5"
                                keyboardType="decimal-pad"
                            />

                            <TouchableOpacity
                                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveText}>Save</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setEditVisible(false)}
                                disabled={saving}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: BACKGROUND_COLOR,
        justifyContent: "center",
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        marginBottom: 20,
    },
    card: {
        backgroundColor: TEAL,
        borderRadius: 20,
        padding: 24,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: "900",
        color: BACKGROUND_COLOR,
        marginBottom: 10,
        letterSpacing: 1,
    },
    cardDetail: {
        fontSize: 14,
        color: BACKGROUND_COLOR,
        marginBottom: 3,
        fontWeight: "500",
    },
    iconWrapper: {
        marginLeft: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    outlineButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 30,
        paddingVertical: 14,
        marginBottom: 12,
    },
    outlineButtonText: {
        color: TEAL,
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    buttonIcon: {
        marginRight: 8,
    },
    logoutButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: TEAL,
        borderRadius: 30,
        paddingVertical: 14,
        marginBottom: 12,
    },
    logoutButtonText: {
        color: BACKGROUND_COLOR,
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: OVERLAY,
        justifyContent: "flex-end",
    },
    modalContainer: {
        backgroundColor: BACKGROUND_COLOR,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
        maxHeight: "90%",
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: LABEL,
        marginBottom: 4,
        marginTop: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: INPUT,
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
    },
    dropdownTrigger: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: INPUT,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 13,
    },
    dropdownTriggerText: {
        fontSize: 16,
        color: "#000000",
        flex: 1,
    },
    dropdownPlaceholder: {
        color: "#AAAAAA",
    },
    dropdownList: {
        borderWidth: 1,
        borderColor: INPUT,
        borderRadius: 10,
        marginTop: 4,
        overflow: "hidden",
        backgroundColor: BACKGROUND_COLOR,
    },
    dropdownItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 11,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F0F0F0",
    },
    dropdownItemSelected: {
        backgroundColor: TEAL_LIGHT,
    },
    dropdownItemLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: "#000000",
        marginBottom: 1,
    },
    dropdownItemNote: {
        fontSize: 11,
        color: TEXT_LIGHT,
        lineHeight: 15,
    },
    classRadio: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: INPUT,
        alignItems: "center",
        justifyContent: "center",
    },
    classRadioSelected: {
        borderColor: TEAL,
    },
    classRadioDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: TEAL,
    },

    saveButton: {
        marginTop: 24,
        backgroundColor: TEAL,
        padding: 14,
        borderRadius: 12,
        alignItems: "center",
    },
    saveText: {
        color: BACKGROUND_COLOR,
        fontSize: 16,
        fontWeight: "bold",
    },
    cancelButton: {
        marginTop: 10,
        padding: 14,
        alignItems: "center",
    },
    cancelText: {
        color: CANCEL_TEXT,
        fontSize: 16,
    },
});