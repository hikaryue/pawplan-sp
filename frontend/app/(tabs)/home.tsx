import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Timestamp, collection, doc, endAt, getDoc, getDocs, orderBy, query, startAt, where } from "firebase/firestore";
import React, { useCallback, useRef } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../firebaseConfig";
import LoadingScreen from "../components/loading_screen";
import { usePet } from "../context/petContext";

const TEAL = "#47D9D7";
const WHITE = "#FFFFFF";
const STAT_LABEL = "#333333";
const STAT_SUB = "#666666";
const DATE_RANGE = "#888888";
const SECTION = "#222222"
const VACCINE = "#555555";
const VACCINE_CARD = "#000000"

export default function HomeScreen() {
    const { selectedPetId } = usePet();
    const [petData, setPetData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [upcomingVaccines, setUpcomingVaccines] = React.useState<any[]>([]);
    const [documentCount, setDocumentCount] = React.useState(0);
    const [favoriteCount, setFavoriteCount] = React.useState(0);
    const hasLoadedOnce = useRef(false);

    useFocusEffect(
        useCallback(() => {
            const fetchAll = async () => {
                if (!hasLoadedOnce.current) {
                    setLoading(true);
                }
                await fetchPetData();
                await getVaccines();
                await getDocumentCount();
                await getFavoriteCount();
                setLoading(false);
                hasLoadedOnce.current = true;
            };
            fetchAll();
        }, [selectedPetId])
    );

    const fetchPetData = async () => {
        if (!selectedPetId) {
            setPetData(null);
            return;
        }
        try {
            const docRef = doc(db, "pet_profile", selectedPetId);
            const docSnap = await getDoc(docRef);
            setPetData(docSnap.exists() ? docSnap.data() : null);
        } catch (error) {
            console.error("Error fetching pet data:", error);
            setPetData(null);
        }
    };

    const getDocumentCount = async () => {
        if (!selectedPetId) {
            setDocumentCount(0);
            return;
        }
        try {
            const user = auth.currentUser;
            if (!user) return;
            const q = query(
                collection(db, "upload_documents"),
                where("uid", "==", user.uid),
                where("pet_id", "==", selectedPetId)
            );
            const snap = await getDocs(q);
            setDocumentCount(snap.size);
        } catch (error) {
            console.error("Error fetching document count:", error);
        }
    };

    const getFavoriteCount = async () => {
        if (!selectedPetId) {
            setFavoriteCount(0);
            return;
        }
        try {
            const savedDoc = doc(db, "meal_plans", selectedPetId);
            const savedSnap = await getDoc(savedDoc);
            if (savedSnap.exists()) {
                const favs = savedSnap.data().favorites ?? [];
                setFavoriteCount(favs.length);
            } else {
                setFavoriteCount(0);
            }
        } catch (error) {
            console.error("Error fetching favorite count:", error);
        }
    };

    function getLastDate() {
        const now = new Date();
        const next = new Date(now);
        next.setDate(now.getDate() + 90);
        return next;
    }

    const getVaccines = async () => {
        if (!selectedPetId) return;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = getLastDate();
        try {
            const q = query(collection(db, "vaccination_records"), where("pet_id", "==", selectedPetId));
            const records = await getDocs(q);
            let vaccines: any[] = [];
            for (const record of records.docs) {
                const entries = collection(db, "vaccination_records", record.id, "vaccine_entries");
                const entries90 = query(
                    entries,
                    orderBy("next_date", "asc"),
                    startAt(Timestamp.fromDate(start)),
                    endAt(Timestamp.fromDate(end))
                );
                const entriesSnapshot = await getDocs(entries90);
                entriesSnapshot.forEach((entryDoc) => {
                    vaccines.push({
                        id: entryDoc.id,
                        vaccination_name: record.data().vaccination_name,
                        ...entryDoc.data(),
                    });
                });
            }
            vaccines = vaccines.filter((v) => v.status !== "completed");
            vaccines.sort((a, b) => a.next_date.toDate() - b.next_date.toDate());
            setUpcomingVaccines(vaccines);
        } catch (error) {
            console.error("Error fetching vaccines:", error);
        }
    };

    function calcAge(birthday: string): string {
        if (!birthday) return "Unknown";
        const birth = new Date(birthday);
        if (isNaN(birth.getTime())) return "Unknown";
        const now = new Date();
        let years = now.getFullYear() - birth.getFullYear();
        let months = now.getMonth() - birth.getMonth();
        if (now.getDate() < birth.getDate()) months--;
        if (months < 0) {
            years--;
            months += 12;
        }
        if (years <= 0 && months <= 0) return "< 1 month old";
        if (years === 0) return `${months} month${months !== 1 ? "s" : ""} old`;
        if (months === 0) return `${years} year${years !== 1 ? "s" : ""} old`;
        return `${years} year${years !== 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""} old`;
    }

    const sortByOldest = () => {
        setUpcomingVaccines(
            [...upcomingVaccines].sort((a, b) => b.next_date.toMillis() - a.next_date.toMillis())
        );
    };

    const sortByNewest = () => {
        setUpcomingVaccines(
            [...upcomingVaccines].sort((a, b) => a.next_date.toMillis() - b.next_date.toMillis())
        );
    };

    if (loading) {
        return <LoadingScreen message="Fetching pet profile..." />;
    }

    if (!petData) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>No pet selected</Text>
            </View>
        );
    }

    const petType = (petData.type || "").toLowerCase();
    const petIcon = petType.includes("cat") ? "cat" : "dog";

    const quickStats = [
        { icon: "needle", label: "Vaccines", sub: upcomingVaccines.length > 0 ? `${upcomingVaccines.length} due` : "None due" },
        { icon: "file-document-outline", label: "Documents", sub: documentCount > 0 ? `${documentCount} uploaded` : "None uploaded" },
        { icon: "star-outline", label: "Favorites", sub: favoriteCount > 0 ? `${favoriteCount} saved` : "None saved" },
    ];

    const now = new Date();
    const end90 = getLastDate();
    const dateLabel = `${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${end90.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

    return (
        <FlatList
            style={{ flex: 1, backgroundColor: "#FFFFFF" }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            data={upcomingVaccines}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
                <>
                    <View style={styles.welcomeCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.welcomeTitle}>Welcome!</Text>
                            <Text style={styles.welcomeDetail}>Pet Name: {petData.name}</Text>
                            <Text style={styles.welcomeDetail}>Breed: {petData.breed}</Text>
                            <Text style={styles.welcomeDetail}>Date of Birth: {petData.birthday}</Text>
                            <Text style={styles.welcomeDetail}>Age: {calcAge(petData.birthday)}</Text>
                        </View>
                        <View style={styles.petIconWrapper}>
                            <MaterialCommunityIcons name={petIcon} size={80} color="#FFFFFF" />
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        {quickStats.map((stat) => (
                            <View key={stat.label} style={styles.statItem}>
                                <View style={styles.statCircle}>
                                    <MaterialCommunityIcons name={stat.icon as any} size={26} color="#FFFFFF" />
                                </View>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                                <Text style={styles.statSub}>{stat.sub}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.dateRange}>{dateLabel}</Text>
                        <Text style={styles.sectionTitle}>Upcoming Vaccination Dates</Text>
                        <View style={styles.sortRow}>
                            <TouchableOpacity style={styles.sortButton} onPress={sortByNewest}>
                                <Text style={styles.sortButtonText}>Newest First</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.sortButton, { marginLeft: 8 }]} onPress={sortByOldest}>
                                <Text style={styles.sortButtonText}>Oldest First</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            }
            ListEmptyComponent={
                <Text style={styles.emptyText}>No upcoming vaccines in the next 90 days.</Text>
            }
            renderItem={({ item }) => (
                <View style={styles.vaccineCard}>
                    <View style={styles.vaccineAccent} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.vaccineName}>{item.vaccination_name}</Text>
                        {item.appointment_time && (
                            <Text style={styles.vaccineDetail}>Appointment Time: {item.appointment_time}</Text>
                        )}
                        {item.last_administered && (
                            <Text style={styles.vaccineDetail}>
                                Last Administered:{" "}
                                {item.last_administered?.toDate
                                    ? item.last_administered.toDate().toLocaleDateString()
                                    : item.last_administered}
                            </Text>
                        )}
                        {item.clinic && (
                            <Text style={styles.vaccineDetail}>Clinic: {item.clinic}</Text>
                        )}
                    </View>
                    <Text style={styles.vaccineDate}>
                        {item.next_date?.toDate().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </Text>
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
    },
    welcomeCard: {
        backgroundColor: TEAL,
        borderRadius: 16,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    welcomeTitle: {
        fontSize: 26,
        fontWeight: "bold",
        color: WHITE,
        marginBottom: 8,
    },
    welcomeDetail: {
        fontSize: 14,
        color: WHITE,
        marginBottom: 2,
    },
    petIconWrapper: {
        width: 90,
        height: 90,
        justifyContent: "center",
        alignItems: "center",
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: TEAL,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 6,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: STAT_LABEL,
    },
    statSub: {
        fontSize: 11,
        color: STAT_SUB,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    dateRange: {
        fontSize: 12,
        color: DATE_RANGE,
        marginBottom: 2,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: SECTION,
        marginBottom: 8,
    },
    sortRow: {
        flexDirection: "row",
        marginBottom: 4,
    },
    sortButton: {
        backgroundColor: TEAL,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    sortButtonText: {
        color: WHITE,
        fontSize: 12,
        fontWeight: "600",
    },
    vaccineCard: {
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "flex-start",
        shadowColor: VACCINE_CARD,
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    vaccineAccent: {
        width: 4,
        borderRadius: 2,
        backgroundColor: TEAL,
        alignSelf: "stretch",
        marginRight: 12,
    },
    vaccineName: {
        fontSize: 16,
        fontWeight: "700",
        color: SECTION,
        marginBottom: 4,
    },
    vaccineDetail: {
        fontSize: 13,
        color: VACCINE,
        marginBottom: 2,
    },
    vaccineDate: {
        fontSize: 12,
        color: TEAL,
        fontWeight: "600",
        marginLeft: 8,
        minWidth: 80,
        textAlign: "right",
    },
    emptyText: {
        fontSize: 15,
        color: DATE_RANGE,
        textAlign: "center",
        marginTop: 20,
    },
});