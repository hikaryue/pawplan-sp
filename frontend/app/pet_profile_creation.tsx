import { auth, db } from "@/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TEAL = "#47D9D7";
const TEAL_LIGHT = "#D4F1F4";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_LIGHT = "#888888";
const BORDER = "#CCCCCC";
const PLACEHOLDER = "#AAAAAA";
const TOTAL_PAGES = 3;
const FOOTER_BORDER_TOP = "#F0F0F0";

//Classes key and their label
const CAT_CLASSES = [
    { key: "domestic_lean", label: "Lean" },
    { key: "domestic_overweight", label: "Overweight" },
];

const DOG_CLASSES = [
    {key: "active_laboratory_kennel_dogs", label: "Active / Kennel Dog", note: "Average for laboratory kennel dogs or active pet dogs"},
    {key: "young_adult_laboratory_active_pet_dogs", label: "Young Adult Active Pet Dog", note: "Above average — young adult lab or active pet dogs"},
    {key: "adult_laboratory_active_great_dane_pet_dogs", label: "Adult Active Dog (Great Dane)", note: "Above average — adult lab/active Great Danes"},
    {key: "adult_laboratory_active_terrier_pet_dogs", label: "Adult Active Dog (Terrier)", note: "Above average — adult lab/active terriers"},
    {key: "inactive_pet_dogs", label: "Inactive Pet Dog", note: "Below average — inactive pet dogs"},
];

type ShellProps = {
    children: React.ReactNode;
    page: number;
    onNext: () => void;
    onPrev?: () => void;
    nextLabel?: string;
    nextDisabled?: boolean;
    bottomInset: number;
};

function Shell({ children, page, onNext, onPrev, nextLabel = "NEXT", nextDisabled = false, bottomInset }: ShellProps) {
    return (
        <View style={styles.root}>
            <View style={styles.topContainer} />
            <View style={styles.card}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.title}>Pet Profile Creation</Text>
                    {children}
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
                    {/*Progress dots*/}
                    <View style={styles.dotsRow}>
                        {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
                            <View
                                key={i}
                                style={[styles.dot, page === i + 1 && styles.dotActive]}
                            />
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.nextButton, nextDisabled && { opacity: 0.45 }]}
                        onPress={onNext}
                        disabled={nextDisabled}
                    >
                        <Text style={styles.nextButtonText}>{nextLabel}</Text>
                    </TouchableOpacity>

                    {onPrev && (
                        <TouchableOpacity style={styles.backLink} onPress={onPrev}>
                            <Text style={styles.backLinkText}>← Back</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

export default function PetProfileCreationScreen() {
    const insets = useSafeAreaInsets();

    const [petType, setPetType] = React.useState<"cat" | "dog" | null>(null);
    const [petName, setPetName] = React.useState("");
    const [petBreed, setPetBreed] = React.useState("");
    const [birthday, setBirthday] = React.useState(new Date());
    const [showPicker, setShowPicker] = React.useState(false);
    const [weight, setWeight] = React.useState("");
    const [petClass, setPetClass] = React.useState<string | null>(null);
    const [page, setPage] = React.useState(1);

    const isCat = petType === "cat";

    const handleSetPetType = (value: "cat" | "dog") => {
        if (value === petType) return;
        setPetType(value);
        setPetName("");
        setPetBreed("");
        setBirthday(new Date());
        setWeight("");
        setPetClass(null);
    };

    //Validating that each page has content before next
    const validatePage1 = () => {
        if (!petType) {
            Alert.alert("Required", "Please select Cat or Dog before continuing.");
            return false;
        }
        return true;
    };

    const validatePage2 = () => {
        if (!petName.trim()) {
            Alert.alert("Required", "Please enter your pet's name.");
            return false;
        }
        if (!weight.trim() || isNaN(parseFloat(weight))) {
            Alert.alert("Required", "Please enter a valid weight.");
            return false;
        }
        return true;
    };

    const validatePage3 = () => {
        if (!petClass) {
            Alert.alert("Required", isCat ? "Please select a body condition." : "Please select an activity level.");
            return false;
        }
        return true;
    };

    async function savePetProfile() {
        if (!validatePage3()) return;
        const user = auth.currentUser;
        if (!user) return;
        await addDoc(collection(db, "pet_profile"), {
            uid: user.uid,
            type: petType,
            name: petName,
            breed: petBreed,
            birthday: birthday.toISOString().split("T")[0],
            weight: parseFloat(weight) || null,
            petClass: petClass,
        });
        router.replace("/select_pet");
    }

    //Page 1: Cat or Dog selection
    if (page === 1) {
        return (
            <Shell
                page={page}
                onNext={() => { if (validatePage1()) setPage(2); }}
                nextDisabled={!petType}
                bottomInset={insets.bottom}
            >
                <Text style={styles.pageSubtitle}>SELECT CAT OR DOG</Text>

                <View style={styles.typeColumn}>
                    {([
                        { label: "CAT", value: "cat" as const, icon: "cat" as const },
                        { label: "DOG", value: "dog" as const, icon: "dog" as const },
                    ]).map(({ label, value, icon }) => {
                        const selected = petType === value;
                        return (
                            <TouchableOpacity
                                key={value}
                                style={[styles.typeCard, selected && styles.typeCardSelected]}
                                onPress={() => handleSetPetType(value)}
                            >
                                <MaterialCommunityIcons
                                    name={icon}
                                    size={120}
                                    color={selected ? TEAL : BLACK}
                                />
                                <Text style={[styles.typeLabel, selected && { color: TEAL }]}>{label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Shell>
        );
    }

    //Page 2: Basic info
    if (page === 2) {
        return (
            <Shell
                page={page}
                onNext={() => { if (validatePage2()) setPage(3); }}
                onPrev={() => setPage(1)}
                nextDisabled={!petName.trim() || !weight.trim()}
                bottomInset={insets.bottom}
            >
                <Text style={styles.pageSubtitle}>BASIC INFORMATION</Text>

                <Text style={styles.fieldLabel}>Pet Name *</Text>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Buddy"
                        placeholderTextColor={PLACEHOLDER}
                        onChangeText={setPetName}
                        value={petName}
                    />
                </View>

                <Text style={styles.fieldLabel}>Breed</Text>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Labrador Retriever"
                        placeholderTextColor={PLACEHOLDER}
                        onChangeText={setPetBreed}
                        value={petBreed}
                    />
                </View>

                <Text style={styles.fieldLabel}>Birthday</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
                    <Text style={styles.dateButtonText}>
                        {birthday.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </Text>
                </TouchableOpacity>
                <DateTimePickerModal
                    isVisible={showPicker}
                    mode="date"
                    date={birthday}
                    onConfirm={(d) => { setBirthday(d); setShowPicker(false); }}
                    onCancel={() => setShowPicker(false)}
                />

                <Text style={styles.fieldLabel}>Current Weight (kg) *</Text>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 5.2"
                        placeholderTextColor={PLACEHOLDER}
                        keyboardType="decimal-pad"
                        onChangeText={setWeight}
                        value={weight}
                    />
                </View>

                <Text style={styles.requiredText}>* Required fields</Text>
            </Shell>
        );
    }

    //Page 3: Activity/Body Class
    const classList = isCat ? CAT_CLASSES : DOG_CLASSES;

    return (
        <Shell
            page={page}
            onNext={savePetProfile}
            onPrev={() => setPage(2)}
            nextLabel="CREATE PROFILE"
            nextDisabled={!petClass}
            bottomInset={insets.bottom}
        >
            <Text style={styles.pageSubtitle}>
                {isCat ? "SELECT BODY CONDITION" : "SELECT ACTIVITY LEVEL"}
            </Text>

            {classList.map(({ key, label, note }: any) => {
                const selected = petClass === key;
                return (
                    <TouchableOpacity
                        key={key}
                        style={[styles.classCard, selected && styles.classCardSelected]}
                        onPress={() => setPetClass(key)}
                    >
                        <View style={[styles.classRadio, selected && styles.classRadioSelected]}>
                            {selected && <View style={styles.classRadioDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.classLabel, selected && { color: TEAL }]}>{label}</Text>
                            {note && <Text style={styles.classNote}>{note}</Text>}
                        </View>
                    </TouchableOpacity>
                );
            })}
        </Shell>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1, 
        backgroundColor: TEAL
    },
    topContainer: {
        paddingTop: 64,
        paddingBottom: 100,
    },
    card: {
        flex: 1,
        backgroundColor: WHITE,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        overflow: "hidden",
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: "800",
        color: BLACK,
        textAlign: "center",
        marginBottom: 4,
    },
    pageSubtitle: {
        fontSize: 13,
        fontWeight: "700",
        color: TEXT_LIGHT,
        textAlign: "center",
        letterSpacing: 1,
        marginBottom: 24,
        marginTop: 4,
    },
    typeColumn: {
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        marginTop: 8,
    },
    typeCard: {
        width: "100%",
        height: 180,
        borderRadius: 20,
        backgroundColor: TEAL_LIGHT,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        borderWidth: 2,
        borderColor: "transparent",
    },
    typeCardSelected: {
        borderWidth: 2.5,
        borderColor: TEAL,
        backgroundColor: TEAL_LIGHT,
    },
    typeLabel: {
        fontWeight: "800",
        fontSize: 22,
        color: BLACK,
        letterSpacing: 2,
    },

    fieldLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: TEAL,
        marginBottom: 6,
        marginTop: 14,
    },
    inputWrapper: {
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        justifyContent: "center",
    },
    input: {
        fontSize: 15,
        color: BLACK,
    },
    dateButton: {
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        justifyContent: "center",
    },
    dateButtonText: {
        fontSize: 15,
        color: BLACK,
    },
    requiredText: {
        fontSize: 11,
        color: TEXT_LIGHT,
        marginTop: 12,
    },
    classCard: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: BORDER,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        gap: 12,
        backgroundColor: WHITE,
    },
    classCardSelected: {
        borderColor: TEAL,
        backgroundColor: TEAL_LIGHT,
    },
    classRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: BORDER,
        alignItems: "center",
        justifyContent: "center",
    },
    classRadioSelected: {
        borderColor: TEAL,
    },
    classRadioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: TEAL,
    },
    classLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: BLACK,
        marginBottom: 2,
    },
    classNote: {
        fontSize: 11,
        color: TEXT_LIGHT,
        lineHeight: 16,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 10,
        backgroundColor: WHITE,
        borderTopWidth: 1,
        borderTopColor: FOOTER_BORDER_TOP,
    },
    dotsRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 6,
        marginBottom: 14,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: TEAL_LIGHT,
    },
    dotActive: {
        backgroundColor: TEAL,
        width: 20,
    },
    nextButton: {
        backgroundColor: TEAL,
        borderRadius: 25,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 30,
    },
    nextButtonText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 15,
        letterSpacing: 0.5,
    },
    backLink: {
        alignItems: "center",
        marginBottom: 30,
    },
    backLinkText: {
        color: TEXT_LIGHT,
        fontSize: 13,
    },
});