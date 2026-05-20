import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useCallback, useEffect } from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from "../../firebaseConfig";
import DateFilter from "../components/date_filter";
import DeleteModal from "../components/delete_modal";
import RecordModal from "../components/record_modal";

const TEAL = "#47D9D7";
const COLOR_RED = "#FF8181";
const COLOR_YELLOW = "#FAFF74";
const COLOR_GREEN = "#74FF82";
const BACKGROUND_COLOR = "#FFFFFF";
const SUMMARY_LABEL = "#222222";
const SUMMARY_COUNT = "#666666";
const VACCINE_NAME = "#111111";
const SEARCH_INPUT = "#000000";
const EMPTY_TEXT = "#888888";
const CARD_TEXT = "#333333";
const BORDER_DROPDOWN = "#E8F8F8";

export default function VaccineEntryScreen() {
    const currentUser = auth.currentUser;
    const router = useRouter();
    const [vaccineEntries, setVaccineEntries] = React.useState<Array<any>>([]);
    const [filteredEntries, setFilteredEntries] = React.useState<Array<any>>([]);
    const [searchValue, setSearchValue] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(null);

    const { vaccinationId, vaccinationName } = useLocalSearchParams<{
        vaccinationId?: string;
        vaccinationName?: string;
    }>();

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.replace('/(tabs)/records');
                return true;
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    useEffect(() => {
        if (!vaccinationId) return;

        const entriesRef = collection(db, "vaccination_records", vaccinationId, "vaccine_entries");

        const unsubscribe = onSnapshot(entriesRef, async (snapshot) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const updates: ReturnType<typeof updateDoc>[] = [];

            const entries = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                const entry: any = { ...data, id: docSnap.id };

                if (data.status !== "completed") {
                    const nextDate: Date = data.next_date.toDate();
                    const expectedStatus = nextDate < today ? "missed" : "upcoming";

                    if (data.status !== expectedStatus) {
                        const entryRef = doc(db, "vaccination_records", vaccinationId, "vaccine_entries", docSnap.id);
                        updates.push(updateDoc(entryRef, { status: expectedStatus }));
                        entry.status = expectedStatus;
                    }
                }

                return entry;
            });

            if (updates.length > 0) {
                await Promise.all(updates).catch(err => console.error("Error syncing entry statuses:", err));
            }

            setVaccineEntries(entries);
            setFilteredEntries(entries);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching vaccine entries:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [vaccinationId]);

    const handleSearch = (text: string) => {
        setSearchValue(text);
        const q = text.toUpperCase();
        setFilteredEntries(vaccineEntries.filter(item =>
            String(item.clinic ?? '').toUpperCase().includes(q)
        ));
    };

    const handleFilter = (sorted: any[]) => {
        setVaccineEntries(sorted);
        const q = searchValue.toUpperCase();
        setFilteredEntries(sorted.filter(item =>
            String(item.clinic ?? '').toUpperCase().includes(q)
        ));
    };

    async function updateStatus(entryId: string, status: string) {
        if (!vaccinationId) return;
        try {
            const entryRef = doc(db, "vaccination_records", vaccinationId, "vaccine_entries", entryId);
            await updateDoc(entryRef, { status });
            setOpenDropdownId(null);
        } catch (error) {
            console.error("Error updating status:", error);
        }
    }

    function getStatusColor(status: string) {
        if (status === "completed") return COLOR_GREEN;
        if (status === "missed") return COLOR_RED;
        return COLOR_YELLOW;
    }

    function getCardBg(status: string) {
        if (status === "completed") return "#F0FFF1";
        if (status === "missed") return "#FFF0F0";
        return "#FFFFF0";
    }

    function getStatusTextColor(status: string) {
        if (status === "completed") return "#2E7D32";
        if (status === "missed") return "#C62828";
        return "#F57F17";
    }

    const completedCount = vaccineEntries.filter(e => e.status === "completed").length;
    const pendingCount = vaccineEntries.filter(e => e.status === "upcoming").length;
    const missedCount = vaccineEntries.filter(e => e.status === "missed").length;

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text>Loading...</Text>
            </View>
        );
    }

    if (!currentUser) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={styles.title}>Not logged in</Text>
            </View>
        );
    }

    const VaccineEntry = ({ record }) => (
        <View style={[styles.card, { backgroundColor: getCardBg(record.status) }]}>
            <View style={[styles.cardAccent, { backgroundColor: getStatusColor(record.status) }]} />
            <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={[styles.statusBadge, { borderColor: getStatusColor(record.status), backgroundColor: getStatusColor(record.status) }]}
                        onPress={() => setOpenDropdownId(openDropdownId === record.id ? null : record.id)}
                    >
                        <Text style={[styles.statusBadgeText, { color: getStatusTextColor(record.status) }]}>
                            {record.status.toUpperCase()}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color={getStatusTextColor(record.status)} />
                    </TouchableOpacity>
                </View>

                {openDropdownId === record.id && (
                    <View style={styles.dropdown}>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => updateStatus(record.id, "upcoming")}
                        >
                            <View style={[styles.dropdownDot, { backgroundColor: COLOR_YELLOW }]} />
                            <Text style={styles.dropdownOption}>Upcoming</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.dropdownItem, { borderBottomWidth: 0 }]}
                            onPress={() => updateStatus(record.id, "completed")}
                        >
                            <View style={[styles.dropdownDot, { backgroundColor: COLOR_GREEN }]} />
                            <Text style={styles.dropdownOption}>Completed</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={styles.cardText}>
                    Next Vaccination Date:{" "}
                    {record.next_date?.toDate()?.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </Text>
                <Text style={styles.cardText}>
                    Last Administered:{" "}
                    {record.last_date?.toDate()?.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </Text>
                <Text style={styles.cardText}>Clinic: {record.clinic}</Text>

                <View style={styles.cardActions}>
                    <RecordModal
                        status="Edit Vaccine Entry"
                        vaccinationID={vaccinationId}
                        entryID={record.id}
                        name={vaccinationName} 
                        lastDate={record.last_date?.toDate()}
                        nextDate={record.next_date?.toDate()}
                        clinic={record.clinic}
                    />
                    <DeleteModal
                        status="Delete Vaccine Entry"
                        vaccinationID={vaccinationId}
                        entryID={record.id}
                    />
                </View>
            </View>
        </View>
    );

    const ListHeader = () => (
        <Pressable onPress={() => setOpenDropdownId(null)}>
            <View style={styles.nameCard}>
                <Text style={styles.nameCardTitle}>{vaccinationName ?? "Vaccine Name"}</Text>
            </View>

            <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                    <View style={[styles.summaryCircle, { backgroundColor: COLOR_GREEN }]}>
                        <Ionicons name="checkmark" size={24} color="#2E7D32" />
                    </View>
                    <Text style={styles.summaryLabel}>Completed</Text>
                    <Text style={styles.summaryCount}>{completedCount} vaccine{completedCount !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.summaryItem}>
                    <View style={[styles.summaryCircle, { backgroundColor: COLOR_YELLOW }]}>
                        <Ionicons name="hourglass-outline" size={24} color="#F57F17" />
                    </View>
                    <Text style={styles.summaryLabel}>Pending</Text>
                    <Text style={styles.summaryCount}>{pendingCount} vaccine{pendingCount !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.summaryItem}>
                    <View style={[styles.summaryCircle, { backgroundColor: COLOR_RED }]}>
                        <Ionicons name="alert" size={24} color="#C62828" />
                    </View>
                    <Text style={styles.summaryLabel}>Missed</Text>
                    <Text style={styles.summaryCount}>{missedCount} vaccine{missedCount !== 1 ? 's' : ''}</Text>
                </View>
            </View>

            <RecordModal
                status="Add Vaccine Entry"
                vaccinationID={vaccinationId}
                name={vaccinationName}
                />

            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={18} color={TEAL} style={{ marginRight: 6 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search..."
                        placeholderTextColor="#aaa"
                        value={searchValue}
                        onChangeText={handleSearch}
                    />
                </View>
                <DateFilter entry={vaccineEntries} setEntry={handleFilter} variable="next_date" />
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={filteredEntries}
                keyExtractor={(item) => item.id + item.status}
                renderItem={({ item }) => <VaccineEntry record={item} />}
                ListHeaderComponent={<ListHeader />}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => setOpenDropdownId(null)}
                ListEmptyComponent={<Text style={styles.emptyText}>No entries found.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
        backgroundColor: BACKGROUND_COLOR
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center"
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: "black"
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginVertical: 16,
    },
    summaryItem: {
        alignItems: "center"
    },
    summaryCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 13,
        fontWeight: "700",
        color: SUMMARY_LABEL
    },
    summaryCount: {
        fontSize: 11,
        color: SUMMARY_COUNT
    },
    nameCard: {
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        marginTop: 10,
    },
    nameCardTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: VACCINE_NAME
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
        gap: 8,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 25,
        paddingHorizontal: 12,
        backgroundColor: BACKGROUND_COLOR,
        height: 40,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: SEARCH_INPUT
    },
    listContent: {
        paddingBottom: 40 },
    emptyText: {
        textAlign: "center",
        color: EMPTY_TEXT,
        marginTop: 20
    },
    card: {
        flexDirection: "row",
        borderRadius: 12,
        marginBottom: 12,
        overflow: "hidden",
        elevation: 1,
        shadowColor: SEARCH_INPUT,
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    cardAccent: {
        width: 6,
        alignSelf: "stretch"
    },
    cardBody: {
        flex: 1,
        padding: 12
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 3,
        gap: 4,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: "700"
    },
    cardText: {
        fontSize: 13,
        color: CARD_TEXT,
        marginBottom: 2
    },
    cardActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 8,
        gap: 12,
    },
    dropdown: {
        position: "absolute",
        top: 34,
        right: 0,
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 12,
        backgroundColor: BACKGROUND_COLOR,
        zIndex: 999,
        elevation: 10,
        minWidth: 140,
        shadowColor: "black",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        overflow: "hidden",
    },
    dropdownOption: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        fontSize: 13,
        fontWeight: "600",
        color: CARD_TEXT,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_DROPDOWN,
    },
    dropdownItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_DROPDOWN,
        gap: 8,
    },
    dropdownDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
});