import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { BackHandler, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePet } from '../context/petContext';

const TEAL = '#47D9D7';
const TEAL_LIGHT = '#D4F1F4';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const TEXT_MID = '#555555';
const TEXT_LIGHT = '#888888';
const RED = '#FF4D4D';

export default function ViewCustomFoodsScreen() {
    const router = useRouter();
    const { selectedPetId } = usePet();
    const user = auth.currentUser;
    const [foods, setFoods] = useState<{ id: string; [key: string]: any }[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                router.replace('/(tabs)/meal');
                return true;
            });
            return () => subscription.remove();
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            if (!user || !selectedPetId) {
                setLoading(false);
                return;
            }
            const q = query(
                collection(db, 'custom_foods'),
                where('uid', '==', user.uid),
                where('pet_id', '==', selectedPetId)
            );
            const unsubscribe = onSnapshot(q, (snap) => {
                setFoods(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            });
            return () => unsubscribe();
        }, [user, selectedPetId])
    );

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'custom_foods', id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleEdit = (item: any) => {
        router.push({
            pathname: '/(tabs)/add_custom_food',
            params: { editId: item.id, editData: JSON.stringify(item) },
        });
    }; 
    const formatNutrient = (key: string, data: any) => {
        const label = key.replace(/_/g, ' ');

        if (data && typeof data === 'object' && 'value' in data && 'unit' in data) {
            return `${label}: ${data.value} ${data.unit}`;
        }
        return `${label}: ${data}`;
    };

    const renderItem = ({ item }: { item: any }) => {
        const nutrients = item.nutrients || {};

        //Show Top 5 macros first. Always in %
        const top5Display = ['Crude_Protein', 'Total_Fat', 'Moisture', 'Crude_Ash', 'Fiber']
            .map(k => nutrients[k] ? formatNutrient(k, nutrients[k]) : null)
            .filter(Boolean)
            .join(' • ');

        // Show other nutrients (max 4 for clean look)
        const extraDisplay = Object.entries(nutrients)
            .filter(([k]) => !['Crude_Protein', 'Total_Fat', 'Moisture', 'Crude_Ash', 'Fiber'].includes(k))
            .slice(0, 4)
            .map(([k, v]) => formatNutrient(k, v))
            .join(' • ');

        return (
            <View style={styles.card}>
                <View style={styles.cardAccent} />
                <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.name}</Text>

                    {item.energy_kcal_per_kg && (
                        <Text style={styles.cardImportant}>
                            Energy: {item.energy_kcal_per_kg} kcal/kg
                        </Text>
                    )}
                    {item.size && (
                        <Text style={styles.cardImportant}>
                            Size: {item.size} g
                        </Text>
                    )}

                    {top5Display && (
                        <Text style={styles.cardSub}>{top5Display}</Text>
                    )}
                    {extraDisplay && (
                        <Text style={[styles.cardSub, { marginTop: 4, opacity: 0.85 }]}>
                            {extraDisplay}
                        </Text>
                    )}
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEdit(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="pencil" size={22} color={TEAL} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDelete(item.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="trash-outline" size={22} color={RED} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(tabs)/add_custom_food')}>
                <Ionicons name="add" size={20} color={WHITE} style={{ marginRight: 6 }} />
                <Text style={styles.addButtonText}>ADD CUSTOM FOOD</Text>
            </TouchableOpacity>

            {loading ? (
                <Text style={styles.emptyText}>Loading custom foods...</Text>
            ) : foods.length === 0 ? (
                <Text style={styles.emptyText}>No custom foods added yet.</Text>
            ) : (
                <FlatList
                    data={foods}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 30 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: WHITE,
        paddingHorizontal: 16,
        paddingTop: 16
    },
    addButton: {
        backgroundColor: TEAL,
        borderRadius: 30,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    addButtonText: {
        color: WHITE,
        fontWeight: '700',
        fontSize: 15,
        letterSpacing: 0.5
    },
    emptyText: {textAlign: 'center',
        color: TEXT_LIGHT,
        marginTop: 40,
        fontSize: 14
    },
    card: {
        flexDirection: 'row',
        backgroundColor: TEAL_LIGHT,
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        alignItems: 'center',
    },
    cardAccent: {
        width: 6,
        alignSelf: 'stretch',
        backgroundColor: TEAL
    },
    cardBody: {
        flex: 1,
        padding: 14
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: BLACK,
        marginBottom: 6
    },
    cardImportant: {
        fontSize: 13,
        color: TEXT_MID,
        marginBottom: 2
    },
    cardSub: {
        fontSize: 12.5,
        color: TEXT_MID,
        lineHeight: 18
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingRight: 10,
    },
    actionButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});