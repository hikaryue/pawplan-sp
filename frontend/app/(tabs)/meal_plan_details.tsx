import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';

const TEAL = "#47D9D7";
const TEAL_LIGHT = "#D4F1F4";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_MID = "#555555";
const TEXT_LIGHT = "#888888";
const BORDER = "#E8F8F8";

type Combination = {
    foods: string[];
    energy_status: string;
    me_required: number;
    delivered_me: number;
    solution: Record<string, number>;
    custom_food_details: object;
    total_grams?: number;
};

export default function MealPlanDetails() {
    const { combination } = useLocalSearchParams();
    const router = useRouter();

    const data: Combination = JSON.parse(combination as string);
    const portions = Object.entries(data.solution);

    const totalGrams = data.total_grams ?? 0;

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                router.replace('/(tabs)/meal');
                return true;
            });
            return () => subscription.remove();
        }, [])
    );

    return (
        <ScrollView contentContainerStyle={styles.container}>

            <View style={styles.energyCard}>
                <View style={styles.energyHalf}>
                    <Text style={styles.energyNumber}>{data.me_required.toFixed(1)}</Text>
                    <Text style={styles.energyUnit}>kcal</Text>
                    <Text style={styles.energyLabel}>Required</Text>
                </View>
                <View style={styles.energyDivider} />
                <View style={styles.energyHalf}>
                    <Text style={styles.energyNumber}>{data.delivered_me.toFixed(1)}</Text>
                    <Text style={styles.energyUnit}>kcal</Text>
                    <Text style={styles.energyLabel}>Delivered</Text>
                </View>
            </View>

            <Text style={styles.totalGrams}>
                TOTAL GRAMS: {Number(totalGrams).toFixed(1)} g
            </Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Portions</Text>
                {portions.map(([food, amount]) => (
                    <View key={food} style={styles.row}>
                        <Text style={styles.foodName}>{food.replace(/_/g, ' ')}</Text>
                        <Text style={styles.foodAmount}>{(Number(amount) * 100).toFixed(1)} g</Text>
                    </View>
                ))}
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: WHITE,
    },
    energyCard: {
        flexDirection: 'row',
        borderRadius: 16,
        marginBottom: 10,
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    energyHalf: {
        flex: 1,
        alignItems: 'center',
    },
    energyNumber: {
        fontSize: 40,
        fontWeight: '800',
        color: TEAL,
        lineHeight: 44,
    },
    energyUnit: {
        fontSize: 14,
        fontWeight: '600',
        color: TEAL,
        marginBottom: 6,
    },
    energyLabel: {
        fontSize: 13,
        color: TEXT_LIGHT,
        fontWeight: '500',
    },
    energyDivider: {
        width: 1.5,
        height: 70,
        backgroundColor: TEAL,
        opacity: 0.4,
    },
    totalGrams: {
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: TEAL,
        marginBottom: 16,
    },
    section: {
        marginBottom: 24,
        backgroundColor: TEAL_LIGHT,
        borderRadius: 14,
        overflow: "hidden",
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: WHITE,
        backgroundColor: TEAL,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    foodName: {
        fontSize: 14,
        color: TEXT_MID,
        textTransform: 'capitalize',
        flex: 1,
    },
    foodAmount: {
        fontSize: 14,
        color: BLACK,
        fontWeight: '700',
    },
});