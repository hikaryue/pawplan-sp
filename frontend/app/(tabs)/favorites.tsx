// @ts-nocheck
import { db } from '@/firebaseConfig';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LoadingScreen from '../components/loading_screen';
import { usePet } from '../context/petContext';

const TEAL = "#47D9D7";
const BACKGROUND_COLOR = "#FFFFFF";
const HEADER = "#111111";
const HEADER_SUB = "#888888";
const EMPTY = "#333333";
const BLACK = "#000000";
const HEART_ACTIVE = "#E53935";
const CARD = "#444444";

const FOOD_DISPLAY_NAMES = {
    malunggay_boiled: 'Malunggay (boiled)',
    ground_beef_90_10_cooked: 'Ground Beef 90/10 (cooked)',
    ground_pork_cooked: 'Ground Pork (cooked)',
    potatoes_boiled: 'Potatoes (boiled)',
    bok_choy_boiled: 'Bok Choy (boiled)',
    celery_boiled: 'Celery (boiled)',
    broccoli_boiled: 'Broccoli (boiled)',
    kale_boiled: 'Kale (boiled)',
    bangus_cooked: 'Bangus / Milkfish (cooked)',
    tuna_yellowfin_cooked: 'Yellowfin Tuna (cooked)',
    tilapia_cooked: 'Tilapia (cooked)',
    carrots_boiled: 'Carrots (boiled)',
    chicken_liver_cooked: 'Chicken Liver (cooked)',
    beef_liver_cooked: 'Beef Liver (cooked)',
    pork_liver_cooked: 'Pork Liver (cooked)',
    iodized_salt: 'Iodized Salt',
};

const formatFoodName = (food) =>
    FOOD_DISPLAY_NAMES[food] ?? food.replace(/_/g, ' ');

const comboKey = (combo) => [...combo.foods].sort().join('|');

export default function FavoritesScreen() {
    const { selectedPetId } = usePet();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [favoriteCombos, setFavoriteCombos] = useState([]);
    const [favorites, setFavorites] = useState(new Set());

    useFocusEffect(
        useCallback(() => {
            loadFavorites();
        }, [selectedPetId])
    );

    const loadFavorites = async () => {
        if (!selectedPetId) {
            setFavoriteCombos([]);
            setFavorites(new Set());
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const savedDoc = doc(db, 'meal_plans', selectedPetId);
            const savedSnap = await getDoc(savedDoc);

            if (!savedSnap.exists()) {
                setFavoriteCombos([]);
                setFavorites(new Set());
                setLoading(false);
                return;
            }

            const saved = savedSnap.data();
            const favKeys = new Set(saved.favorites ?? []);
            const allCombos = saved.meal_plan?.combinations ?? [];
            const favCombos = allCombos.filter(combo => favKeys.has(comboKey(combo)));

            setFavorites(favKeys);
            setFavoriteCombos(favCombos);
        } catch (err) {
            console.error('Error loading favorites:', err);
        } finally {
            setLoading(false);
        }
    };

    const removeFavorite = async (combo) => {
        const key = comboKey(combo);
        const updated = new Set(favorites);
        updated.delete(key);
        setFavorites(updated);
        setFavoriteCombos(prev => prev.filter(c => comboKey(c) !== key));

        try {
            const savedDoc = doc(db, 'meal_plans', selectedPetId);
            await updateDoc(savedDoc, { favorites: Array.from(updated) });
        } catch (err) {
            console.warn('Could not update favorites:', err.message);
        }
    };

    if (loading) {
        return <LoadingScreen message="Loading favorites..." />;
    }

    if (!selectedPetId) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyTitle}>No pet selected</Text>
                <Text style={styles.emptyText}>Select a pet to view favorites.</Text>
            </View>
        );
    }

    const renderItem = ({ item, index }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() =>
                router.push({
                    pathname: '/meal_plan_details',
                    params: { combination: JSON.stringify(item) },
                })
            }
        >
            <View style={styles.cardTopRow}>
                <View style={styles.cardAccent} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Favorite #{index + 1}</Text>
                    <Text style={styles.cardFoods}>
                        {item.foods.map(formatFoodName).join(', ')}
                    </Text>
                    <View style={styles.cardMetaRow}>
                        <Text style={styles.cardMeta}>
                            {item.delivered_me?.toFixed(1)} kcal delivered
                        </Text>
                        {item.total_grams != null && (
                            <Text style={styles.cardGrams}>
                                {typeof item.total_grams === 'number'
                                    ? item.total_grams.toFixed(1)
                                    : item.total_grams}g total
                            </Text>
                        )}
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => removeFavorite(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.heartButton}
                >
                    <Text style={styles.heartIconActive}>♥</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <FlatList
            data={favoriteCombos}
            keyExtractor={(_, index) => String(index)}
            renderItem={renderItem}
            contentContainerStyle={styles.container}
            ListHeaderComponent={
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Favorites</Text>
                    {favoriteCombos.length > 0 && (
                        <Text style={styles.headerSub}>
                            {favoriteCombos.length} saved combination{favoriteCombos.length !== 1 ? 's' : ''}
                        </Text>
                    )}
                </View>
            }
            ListEmptyComponent={
                <View style={styles.center}>
                    <Text style={styles.emptyTitle}>No favorites yet</Text>
                    <Text style={styles.emptyText}>
                        Tap ♡ on any meal combination in the Meal Planner to save it here.
                    </Text>
                </View>
            }
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingHorizontal: 16,
        paddingBottom: 30,
        backgroundColor: BACKGROUND_COLOR,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: BACKGROUND_COLOR,
    },
    header: {
        paddingVertical: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: HEADER,
        marginBottom: 4,
    },
    headerSub: {
        fontSize: 13,
        color: HEADER_SUB,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: EMPTY,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: HEADER_SUB,
        textAlign: 'center',
        lineHeight: 20,
    },
    card: {
        backgroundColor: BACKGROUND_COLOR,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        elevation: 2,
        shadowColor: BLACK,
        shadowOpacity: 0.06,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    cardAccent: {
        width: 4,
        borderRadius: 2,
        backgroundColor: TEAL,
        alignSelf: 'stretch',
        marginRight: 4,
    },
    cardTitle: {
        fontWeight: '700',
        fontSize: 15,
        color: HEADER,
        marginBottom: 4,
    },
    heartButton: {
        padding: 2,
        marginLeft: 8,
    },
    heartIconActive: {
        fontSize: 22,
        color: HEART_ACTIVE,
    },
    cardFoods: {
        fontSize: 13,
        color: CARD,
        marginBottom: 8,
        lineHeight: 18,
    },
    cardMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardMeta: {
        fontSize: 12,
        color: HEADER_SUB,
    },
    cardGrams: {
        fontSize: 12,
        color: HEADER_SUB,
        fontWeight: '500',
    },
});