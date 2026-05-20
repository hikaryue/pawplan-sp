import { Ionicons } from '@expo/vector-icons';
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth, db } from "../../firebaseConfig";
import DeleteModal from "../components/delete_modal";
import LoadingScreen from "../components/loading_screen";
import NameFilter from "../components/name_filter";
import RecordModal from "../components/record_modal";
import { usePet } from "../context/petContext";

const TEAL = "#47D9D7";
const TEAL_LIGHT = "#D4F1F4";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_DARK = "#111111";
const TEXT_MID = "#444444";
const PLACEHOLDER = "#aaaaaa";
const BORDER_SELECTED = "#007BFF";

export default function RecordsScreen() {
    const { selectedPetId } = usePet();
    const [vaccineRecords, setVaccineRecords] = React.useState<any[]>([]);
    const [filteredRecords, setFilteredRecords] = React.useState<any[]>([]);
    const [searchValue, setSearchValue] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;

        const entriesRef = query(
            collection(db, "vaccination_records"),
            where("uid", "==", currentUser.uid),
            where("pet_id", "==", selectedPetId)
        );

        const unsubscribe = onSnapshot(entriesRef, (snapshot) => {
            const vaccines = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setVaccineRecords(vaccines);
            setFilteredRecords(vaccines);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching vaccine entries:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, selectedPetId]);

    const handleSearch = (text: string) => {
        setSearchValue(text);
        const q = text.toUpperCase();
        setFilteredRecords(vaccineRecords.filter(item =>
            String(item.vaccination_name ?? '').toUpperCase().includes(q)
        ));
    };

    const handleFilter = (sorted: any[]) => {
        setVaccineRecords(sorted);
        const q = searchValue.toUpperCase();
        setFilteredRecords(sorted.filter(item =>
            String(item.vaccination_name ?? '').toUpperCase().includes(q)
        ));
    };

    if (loading) {
        return <LoadingScreen message="Fetching pet vaccination records..." />;
    }

    const VaccineItem = ({ record }) => (
        <Pressable
            style={[styles.card, selectedPetId === record.id && styles.selectedCard]}
            onPress={() =>
                router.push({
                    pathname: "/(tabs)/vaccine_entry",
                    params: { vaccinationId: record.id, vaccinationName: record.vaccination_name },
                })
            }
        >
            <View style={styles.cardContent}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{record.vaccination_name}</Text>
                    {record.updatedAt && (
                        <Text style={styles.cardSub}>
                            Date Last Modified:{" "}
                            {record.updatedAt?.toDate
                                ? record.updatedAt.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" })
                                : record.updatedAt}
                        </Text>
                    )}
                </View>
                <View style={styles.cardActions}>
                    <RecordModal status="Edit Vaccination" vaccinationID={record.id} name={record.vaccination_name} />
                    <DeleteModal status="Delete Vaccination" vaccinationID={record.id} />
                </View>
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <RecordModal status="Add Vaccination" />

            {vaccineRecords.length === 0 ? (
                <Text style={styles.info}>No vaccination records yet</Text>
            ) : (
                <>
                    <View style={styles.searchRow}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search-outline" size={18} color={TEAL} style={{ marginRight: 6 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search..."
                                placeholderTextColor={PLACEHOLDER}
                                value={searchValue}
                                onChangeText={handleSearch}
                            />
                        </View>
                        <NameFilter entry={vaccineRecords} setEntry={handleFilter} variable="vaccination_name" />
                    </View>

                    <FlatList
                        data={filteredRecords}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <VaccineItem record={item} />}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <Text style={styles.info}>No results found</Text>
                        }
                    />
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: WHITE,
    },
    info: {
        fontSize: 18,
        color: BLACK,
        marginVertical: 4,
        textAlign: "center",
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
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
        backgroundColor: WHITE,
        height: 40,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: BLACK,
    },
    listContent: {
        paddingBottom: 20,
    },
    card: {
        backgroundColor: TEAL_LIGHT,
        borderRadius: 16,
        padding: 16,
        marginVertical: 6,
        marginHorizontal: 16,
    },
    selectedCard: {
        borderColor: BORDER_SELECTED,
        borderWidth: 2,
    },
    cardContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: TEXT_DARK,
        marginBottom: 4,
    },
    cardSub: {
        fontSize: 12,
        color: TEXT_MID,
    },
    cardActions: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
    },
});