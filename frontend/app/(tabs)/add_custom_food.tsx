import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { usePet } from '../context/petContext';

const TEAL = '#47D9D7';
const TEAL_LIGHT = '#D4F1F4';
const WHITE = '#FFFFFF';
const TEXT_MID = '#555555';
const ERROR_TEXT = '#CC0000';
const ERROR_BG = '#FFE5E5';
const BORDER_LIGHT = '#CCCCCC';
const PLACEHOLDER = '#AAAAAA';
const UNIT_INACTIVE = '#E8E8E8';
const UNIT_INACTIVE_TEXT = '#999999';
const OVERLAY = '#00000099'

const TOP_5 = ['Crude_Protein', 'Total_Fat', 'Moisture', 'Crude_Ash', 'Fiber'];

const EXTRA_NUTRIENTS = [
    'Arginine', 'Histidine', 'Isoleucine', 'Methionine', 'Methionine_Cystine',
    'Leucine', 'Lysine', 'Phenylalanine', 'Phenylalanine_Tyrosine',
    'Threonine', 'Tryptophan', 'Valine', 'Taurine',
    'Linoleic_Acid', 'Arachidonic_Acid',
    'Calcium', 'Phosphorus', 'Magnesium', 'Sodium', 'Potassium', 'Chloride',
    'Iron', 'Copper', 'Zinc', 'Manganese', 'Selenium', 'Iodine',
    'Vitamins_A', 'Cholecalciferol', 'Vitamin_E', 'Thiamin', 'Riboflavin',
    'Pyridoxine', 'Niacin', 'Pantothenic_Acid', 'Cobalamin', 'Folic_Acid', 'Choline',
];

const formatLabel = (key: string) => key.replace(/_/g, ' ');

type UnitType = 'mg' | '%' | 'IU';

const VITAMINS_IU_ONLY = ['Vitamins_A'];
const VITAMIN_D3 = 'Cholecalciferol';
const VITAMIN_E = 'Vitamin_E';

type NutrientEntry = { value: number; unit: string };

export default function AddCustomFoodScreen() {
    const router = useRouter();
    const { selectedPetId } = usePet();
    const user = auth.currentUser;

    const { editId, editData } = useLocalSearchParams<{ editId?: string; editData?: string }>();

    const [foodName, setFoodName] = useState('');
    const [size, setSize] = useState('');
    const [energyKcal, setEnergyKcal] = useState('');
    const [top5Values, setTop5Values] = useState<Record<string, string>>({});
    const [addedNutrients, setAddedNutrients] = useState<string[]>([]);
    const [nutrientValues, setNutrientValues] = useState<Record<string, string>>({});
    const [nutrientUnits, setNutrientUnits] = useState<Record<string, UnitType>>({});
    const [showPicker, setShowPicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    //Populate fields when editing
    useEffect(() => {
        if (!editData) return;
        try {
            const item = JSON.parse(editData);
            setFoodName(item.name ?? '');
            setSize(item.size != null ? String(item.size) : '');
            setEnergyKcal(item.energy_kcal_per_kg != null ? String(item.energy_kcal_per_kg) : '');

            const nutrients: Record<string, { value: number; unit: string }> = item.nutrients ?? {};

            const t5: Record<string, string> = {};
            TOP_5.forEach(k => {
                if (nutrients[k]) t5[k] = String(nutrients[k].value);
            });
            setTop5Values(t5);

            const extraKeys = Object.keys(nutrients).filter(k => !TOP_5.includes(k));
            setAddedNutrients(extraKeys);

            const vals: Record<string, string> = {};
            const units: Record<string, UnitType> = {};
            extraKeys.forEach(k => {
                vals[k] = String(nutrients[k].value);
                units[k] = nutrients[k].unit as UnitType;
            });
            setNutrientValues(vals);
            setNutrientUnits(units);
        } catch (e) {
            console.error('Failed to parse editData', e);
        }
    }, [editData]);

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                router.replace('/(tabs)/meal');
                return true;
            });
            return () => subscription.remove();
        }, [router])
    );

    const availableToAdd = EXTRA_NUTRIENTS.filter(n => !addedNutrients.includes(n));

    const addNutrient = (nutrient: string) => {
        setAddedNutrients(prev => [...prev, nutrient]);

        let defaultUnit: UnitType = 'mg';
        if (VITAMINS_IU_ONLY.includes(nutrient) || nutrient === VITAMIN_D3) {
            defaultUnit = 'IU';
        } else if (nutrient === VITAMIN_E) {
            defaultUnit = 'IU';
        }

        setNutrientUnits(prev => ({ ...prev, [nutrient]: defaultUnit }));
        setShowPicker(false);
    };

    const removeNutrient = (nutrient: string) => {
        setAddedNutrients(prev => prev.filter(n => n !== nutrient));
        setNutrientValues(prev => {
            const copy = { ...prev };
            delete copy[nutrient];
            return copy;
        });
        setNutrientUnits(prev => {
            const copy = { ...prev };
            delete copy[nutrient];
            return copy;
        });
    };

    const toggleUnit = (nutrient: string) => {
        if (VITAMINS_IU_ONLY.includes(nutrient)) return;

        if (nutrient === VITAMIN_D3) {
            setNutrientUnits(prev => ({
                ...prev,
                [nutrient]: prev[nutrient] === 'IU' ? 'mg' : 'IU',
            }));
            return;
        }

        if (nutrient === VITAMIN_E) {
            setNutrientUnits(prev => ({
                ...prev,
                [nutrient]: prev[nutrient] === 'IU' ? '%' : 'IU',
            }));
            return;
        }

        setNutrientUnits(prev => ({
            ...prev,
            [nutrient]: prev[nutrient] === 'mg' ? '%' : 'mg',
        }));
    };

    const handleSubmit = async () => {
        if (!foodName.trim()) {
            setError('Food name is required.');
            return;
        }
        if (!user) return;

        setSubmitting(true);
        setError('');

        try {
            const nutrients: Record<string, NutrientEntry> = {};

            TOP_5.forEach(key => {
                if (top5Values[key]?.trim()) {
                    const val = parseFloat(top5Values[key].trim());
                    if (!isNaN(val)) {
                        nutrients[key] = { value: val, unit: '%' };
                    }
                }
            });

            addedNutrients.forEach(key => {
                if (!nutrientValues[key]?.trim()) return;
                const raw = parseFloat(nutrientValues[key].trim());
                if (isNaN(raw)) return;

                const unit = nutrientUnits[key] ?? 'mg';
                nutrients[key] = { value: raw, unit };
            });

            if (editId) {
                await updateDoc(doc(db, 'custom_foods', editId), {
                    name: foodName.trim(),
                    size: size.trim() ? parseFloat(size.trim()) : null,
                    energy_kcal_per_kg: energyKcal.trim() ? parseFloat(energyKcal.trim()) : null,
                    nutrients,
                    updated_at: new Date(),
                });
            } else {
                await addDoc(collection(db, 'custom_foods'), {
                    uid: user.uid,
                    pet_id: selectedPetId,
                    name: foodName.trim(),
                    size: size.trim() ? parseFloat(size.trim()) : null,
                    energy_kcal_per_kg: energyKcal.trim() ? parseFloat(energyKcal.trim()) : null,
                    nutrients,
                    created_at: new Date(),
                });
            }

            router.replace('/(tabs)/view_custom_food');
        } catch (err) {
            console.error('Error saving custom food:', err);
            setError('Failed to save. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.sectionLabel}>Food Name</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="fast-food-outline" size={18} color={TEAL} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Homemade Chicken & Rice"
                        placeholderTextColor={PLACEHOLDER}
                        value={foodName}
                        onChangeText={setFoodName}
                    />
                </View>

                <Text style={styles.sectionLabel}>General Info</Text>
                <View style={styles.infoRow}>
                    <View style={styles.infoFieldWrapper}>
                        <Text style={styles.infoFieldLabel}>Size (g)</Text>
                        <View style={styles.infoInputWrapper}>
                            <Ionicons name="scale-outline" size={16} color={TEAL} style={{ marginRight: 6 }} />
                            <TextInput
                                style={styles.infoInput}
                                placeholder="100"
                                keyboardType="decimal-pad"
                                value={size}
                                onChangeText={setSize}
                            />
                            <Text style={styles.infoUnit}>g</Text>
                        </View>
                    </View>

                    <View style={styles.infoFieldWrapper}>
                        <Text style={styles.infoFieldLabel}>Energy (kcal/kg)</Text>
                        <View style={styles.infoInputWrapper}>
                            <Ionicons name="flash-outline" size={16} color={TEAL} style={{ marginRight: 6 }} />
                            <TextInput
                                style={styles.infoInput}
                                placeholder="3500"
                                keyboardType="decimal-pad"
                                value={energyKcal}
                                onChangeText={setEnergyKcal}
                            />
                            <Text style={styles.infoUnit}>kcal</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Main Nutrients (%)</Text>
                {TOP_5.map(key => (
                    <View key={key} style={styles.nutrientRow}>
                        <Text style={styles.nutrientLabel}>{formatLabel(key)}</Text>
                        <View style={styles.nutrientInputWrapper}>
                            <TextInput
                                style={styles.nutrientInput}
                                keyboardType="decimal-pad"
                                value={top5Values[key] ?? ''}
                                onChangeText={v => setTop5Values(prev => ({ ...prev, [key]: v }))}
                            />
                            <Text style={styles.unitLabel}>%</Text>
                        </View>
                    </View>
                ))}

                {addedNutrients.length > 0 && (
                    <>
                        <Text style={styles.sectionLabel}>Additional Nutrients</Text>
                        {addedNutrients.map(key => {
                            const currentUnit = nutrientUnits[key] ?? 'mg';
                            const isIUOnly = VITAMINS_IU_ONLY.includes(key);
                            const isVitaminD3 = key === VITAMIN_D3;
                            const isVitaminE = key === VITAMIN_E;

                            return (
                                <View key={key} style={styles.nutrientRow}>
                                    <Text style={styles.nutrientLabel}>{formatLabel(key)}</Text>
                                    <View style={styles.nutrientInputWrapper}>
                                        <TextInput
                                            style={styles.nutrientInput}
                                            keyboardType="decimal-pad"
                                            value={nutrientValues[key] ?? ''}
                                            onChangeText={v => setNutrientValues(prev => ({ ...prev, [key]: v }))}
                                        />

                                        {isIUOnly ? (
                                            <Text style={[styles.unitLabel, { marginLeft: 12 }]}>IU</Text>
                                        ) : isVitaminD3 || isVitaminE ? (
                                            <View style={styles.unitToggle}>
                                                <TouchableOpacity
                                                    style={[styles.unitToggleBtn, currentUnit === 'IU' && styles.unitToggleBtnActive]}
                                                    onPress={() => toggleUnit(key)}
                                                >
                                                    <Text style={[styles.unitToggleBtnText, currentUnit === 'IU' && styles.unitToggleBtnTextActive]}>IU</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.unitToggleBtn, ((isVitaminD3 && currentUnit === 'mg') || (isVitaminE && currentUnit === '%')) && styles.unitToggleBtnActive]}
                                                    onPress={() => toggleUnit(key)}
                                                >
                                                    <Text style={[styles.unitToggleBtnText, ((isVitaminD3 && currentUnit === 'mg') || (isVitaminE && currentUnit === '%')) && styles.unitToggleBtnTextActive]}>
                                                        {isVitaminD3 ? 'mg' : '%'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={styles.unitToggle}>
                                                <TouchableOpacity
                                                    style={[styles.unitToggleBtn, currentUnit === 'mg' && styles.unitToggleBtnActive]}
                                                    onPress={() => toggleUnit(key)}
                                                >
                                                    <Text style={[styles.unitToggleBtnText, currentUnit === 'mg' && styles.unitToggleBtnTextActive]}>mg</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.unitToggleBtn, currentUnit === '%' && styles.unitToggleBtnActive]}
                                                    onPress={() => toggleUnit(key)}
                                                >
                                                    <Text style={[styles.unitToggleBtnText, currentUnit === '%' && styles.unitToggleBtnTextActive]}>%</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        <TouchableOpacity onPress={() => removeNutrient(key)} style={{ marginLeft: 8 }}>
                                            <Ionicons name="close-circle" size={20} color={ERROR_TEXT} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}

                {availableToAdd.length > 0 && (
                    <TouchableOpacity style={styles.addNutrientBtn} onPress={() => setShowPicker(true)}>
                        <Ionicons name="add-circle-outline" size={20} color={TEAL} style={{ marginRight: 6 }} />
                        <Text style={styles.addNutrientBtnText}>Add Nutrient</Text>
                    </TouchableOpacity>
                )}

                <Modal
                    visible={showPicker}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowPicker(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowPicker(false)}
                    >
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Choose a nutrient</Text>
                            <ScrollView style={styles.modalScroll} nestedScrollEnabled>
                                {availableToAdd.map(n => (
                                    <TouchableOpacity
                                        key={n}
                                        style={styles.modalItem}
                                        onPress={() => addNutrient(n)}
                                    >
                                        <Text style={styles.modalItemText}>{formatLabel(n)}</Text>
                                        <Ionicons name="add" size={20} color={TEAL} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPicker(false)}>
                                <Text style={styles.modalCloseText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {error ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(tabs)/meal')}>
                        <Text style={styles.cancelBtnText}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        <Text style={styles.saveBtnText}>
                            {submitting ? 'SAVING...' : editId ? 'UPDATE' : 'SAVE'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, backgroundColor: WHITE, paddingBottom: 40 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: TEAL, marginBottom: 8, marginTop: 16 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: TEAL, borderRadius: 12, paddingHorizontal: 12, height: 48 },
    input: { flex: 1, fontSize: 15 },
    infoRow: { flexDirection: 'row', gap: 12 },
    infoFieldWrapper: { flex: 1 },
    infoFieldLabel: { fontSize: 12, marginBottom: 6 },
    infoInputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: TEAL, borderRadius: 12, paddingHorizontal: 10, height: 46 },
    infoInput: { flex: 1 },
    infoUnit: { fontSize: 12 },
    nutrientRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, backgroundColor: TEAL_LIGHT, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    nutrientLabel: { flex: 1 },
    nutrientInputWrapper: { flexDirection: 'row', alignItems: 'center' },
    nutrientInput: { borderWidth: 1.5, borderColor: TEAL, borderRadius: 8, paddingHorizontal: 10, width: 70, textAlign: 'right' },
    unitLabel: { marginLeft: 6, fontSize: 14, color: TEXT_MID },
    unitToggle: { flexDirection: 'row', marginLeft: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1.5, borderColor: TEAL },
    unitToggleBtn: { paddingHorizontal: 8, paddingVertical: 5, backgroundColor: UNIT_INACTIVE },
    unitToggleBtnActive: { backgroundColor: TEAL },
    unitToggleBtnText: { fontSize: 12, fontWeight: '700', color: UNIT_INACTIVE_TEXT },
    unitToggleBtnTextActive: { color: WHITE },
    addNutrientBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: TEAL, borderRadius: 25, paddingVertical: 10, paddingHorizontal: 16, marginTop: 8, alignSelf: 'flex-start' },
    addNutrientBtnText: { color: TEAL, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: OVERLAY, justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: WHITE, borderRadius: 16, padding: 16, maxHeight: '70%' },
    modalTitle: { fontSize: 16, fontWeight: '700', color: TEAL, textAlign: 'center', marginBottom: 12 },
    modalScroll: { maxHeight: 320 },
    modalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT },
    modalItemText: { fontSize: 15, color: TEXT_MID },
    modalCloseBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: TEAL_LIGHT, borderRadius: 12 },
    modalCloseText: { color: TEAL, fontWeight: '600' },
    errorBox: { backgroundColor: ERROR_BG, borderRadius: 8, padding: 12, marginTop: 12 },
    errorText: { color: ERROR_TEXT, textAlign: 'center' },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
    cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: TEAL, borderRadius: 20, paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { color: TEAL, fontWeight: '600' },
    saveBtn: { flex: 1, backgroundColor: TEAL, borderRadius: 20, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { color: WHITE, fontWeight: '600' },
});