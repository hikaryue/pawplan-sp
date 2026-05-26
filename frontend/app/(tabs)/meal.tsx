//@ts-nocheck
import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MealFilterModal from '../components/meal_filter';
import { usePet } from '../context/petContext';

const TEAL = '#47D9D7';
const TEAL_LIGHT = '#B8E6E6';

const RAILWAY_BASE_URL = 'https://pawplan-api-production.up.railway.app';
const EMPTY_FILTER = { include: [], exclude: [] };
const SORT_MODES = ['none', 'asc', 'desc'];
const SORT_ICONS = { none: '⇅', asc: '↑', desc: '↓' };
const POLL_INTERVAL_MS = 15_000;
const PAGE_SIZE = 50;

const jobStorageKey = (petId: string) => `meal_plan_job_${petId}`;

const FOOD_DISPLAY_NAMES = {
    malunggay_boiled: 'Malunggay (boiled)',
    ground_beef_90_10_cooked: 'Ground Beef 90/10 (cooked)',
    ground_pork_cooked: 'Ground Pork (cooked)',
    potatoes_boiled: 'Potatoes (boiled)',
    bok_choy_boiled: 'Bok Choy (boiled)',
    broccoli_boiled: 'Broccoli (boiled)',
    kale_boiled: 'Kale (boiled)',
    bangus_cooked: 'Bangus / Milkfish (cooked)',
    tuna_yellowfin_cooked: 'Yellowfin Tuna (cooked)',
    tilapia_cooked: 'Tilapia (cooked)',
    carrots_boiled: 'Carrots (boiled)',
    chicken_liver_cooked: 'Chicken Liver (cooked)',
    pork_liver_cooked: 'Pork Liver (cooked)',
    iodized_salt: 'Iodized Salt',
    yellow_corn_boiled: 'Yellow Corn (boiled)',
    green_peas_boiled: 'Green Peas (boiled)',
    green_beans_snap_boiled: 'Baguio Beans (boiled)',
    lettuce_boiled: 'Lettuce (raw)',
};

const TOP_5_SET = new Set(['Crude_Protein', 'Total_Fat', 'Moisture', 'Crude_Ash', 'Fiber']);
const IU_SET = new Set(['Vitamins_A', 'Cholecalciferol']);

const formatFoodName = (food) => FOOD_DISPLAY_NAMES[food] ?? food.replace(/_/g, ' ');
const comboKey = (combo) => [...combo.foods].sort().join('|');

const buildCustomFoodsFingerprint = (customFoods) =>
    JSON.stringify(
        customFoods
            .map(d => ({
                id: d.id,
                name: d.name,
                nutrients: Object.fromEntries(
                    Object.entries(d.nutrients ?? {})
                        .sort(([a], [b]) => a.localeCompare(b)) 
                        .map(([nutrientKey, nutrientData]) => {
                            if (nutrientData && typeof nutrientData === 'object' && 'value' in nutrientData) {
                                return [
                                    nutrientKey,
                                    Object.fromEntries(
                                        Object.entries(nutrientData).sort(([a], [b]) => a.localeCompare(b))
                                    )
                                ];
                            }
                            return [nutrientKey, nutrientData];
                        })
                ),
                energy_kcal_per_kg: d.energy_kcal_per_kg ?? null,
                size: d.size ?? null,
            }))
            .sort((a, b) => a.id.localeCompare(b.id))
    );

const normaliseWeight = (w: any): number | null => {
    const n = parseFloat(String(w));
    return isNaN(n) ? null : n;
};

export default function MealScreen() {
    const { selectedPetId } = usePet();

    const selectedPetIdRef = useRef(selectedPetId);
    useEffect(() => { selectedPetIdRef.current = selectedPetId; }, [selectedPetId]);

    const [loading, setLoading] = useState(false);
    const [loadingCached, setLoadingCached] = useState(false);
    const [error, setError] = useState(null);
    const [mealPlan, setMealPlan] = useState(null);
    const [isFromCache, setIsFromCache] = useState(false);
    const [generateMessage, setGenerateMessage] = useState(null);
    const [favorites, setFavorites] = useState(new Set());
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [sortMode, setSortMode] = useState('none');
    const [currentPage, setCurrentPage] = useState(1);

    const [filterVisible, setFilterVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('include');
    const [filter, setFilter] = useState(EMPTY_FILTER);
    const [pendingFilter, setPendingFilter] = useState(EMPTY_FILTER);

    const isRunning = useRef(false);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingJobRef = useRef<{ jobId: string; pet: any; fingerprint: string } | null>(null);

    const schedulePollRef = useRef(null);

    const router = useRouter();
    const [petType, setPetType] = useState<string | null>(null);
    const petLabel = petType?.toLowerCase() === 'cat' ? 'CAT' : 'DOG';

    const cycleSortMode = () => {
        setSortMode(prev => {
            const idx = SORT_MODES.indexOf(prev);
            return SORT_MODES[(idx + 1) % SORT_MODES.length];
        });
    };

    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active' && pendingJobRef.current) {
                const { jobId, pet, fingerprint } = pendingJobRef.current;
                schedulePollRef.current?.(jobId, pet, fingerprint);
            }
        });
        return () => {
            sub.remove();
            clearPollTimer();
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (!selectedPetId) {
                setMealPlan(null);
                setIsFromCache(false);
                setGenerateMessage(null);
                setFavorites(new Set());
                setShowFavoritesOnly(false);
                setSortMode('none');
                setPetType(null);
                isRunning.current = false;
                return;
            }
            checkForSavedPlanOrGenerate();
            return () => {
                if (!pendingJobRef.current) isRunning.current = false;
            };
        }, [selectedPetId])
    );

    const clearPollTimer = () => {
        if (pollTimerRef.current !== null) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    const getPetInfo = async () => {
        const petId = selectedPetIdRef.current;
        if (!petId) throw new Error('No pet selected.');
        const petSnap = await getDoc(doc(db, 'pet_profile', petId));
        if (!petSnap.exists()) throw new Error('Pet profile not found.');
        return { id: petSnap.id, ...petSnap.data() };
    };

    const getCustomFoods = async () => {
        try {
            const user = auth.currentUser;
            const petId = selectedPetIdRef.current;
            if (!user || !petId) return [];
            const snap = await getDocs(query(
                collection(db, 'custom_foods'),
                where('uid', '==', user.uid),
                where('pet_id', '==', petId)
            ));
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
            return [];
        }
    };

    const VALID_UNITS = new Set(['%', 'mg', 'IU']);
    const VALID_NUTRIENTS = new Set([
        'Crude_Protein', 'Total_Fat', 'Moisture', 'Crude_Ash', 'Fiber',
        'Arginine', 'Histidine', 'Isoleucine', 'Methionine', 'Methionine_Cystine',
        'Leucine', 'Lysine', 'Phenylalanine', 'Phenylalanine_Tyrosine',
        'Threonine', 'Tryptophan', 'Valine', 'Taurine',
        'Linoleic_Acid', 'Arachidonic_Acid',
        'Calcium', 'Phosphorus', 'Magnesium', 'Sodium', 'Potassium', 'Chloride',
        'Iron', 'Copper', 'Zinc', 'Manganese', 'Selenium', 'Iodine',
        'Vitamins_A', 'Cholecalciferol', 'Vitamin_E', 'Thiamin', 'Riboflavin',
        'Pyridoxine', 'Niacin', 'Pantothenic_Acid', 'Cobalamin', 'Folic_Acid', 'Choline',
    ]);

    const buildCustomParam = (customFoodDocs) => {
        return customFoodDocs.map(doc => {
            const entry: any = { name: doc.name };
            const nutrients = doc.nutrients ?? {};
            for (const [key, data] of Object.entries(nutrients)) {
                if (!VALID_NUTRIENTS.has(key)) continue;
                let value: number | null = null;
                let unit: string | null = null;
                if (data && typeof data === 'object' && 'value' in data && 'unit' in data) {
                    value = Number(data.value);
                    unit = String(data.unit).trim();
                } else if (data != null) {
                    value = Number(data);
                    if (TOP_5_SET.has(key)) unit = '%';
                    else if (IU_SET.has(key)) unit = 'IU';
                    else if (key === 'Vitamin_E') unit = value < 10 ? '%' : 'IU';
                    else unit = 'mg';
                }
                if (value === null || isNaN(value) || !unit || !VALID_UNITS.has(unit)) continue;
                entry[key] = { value, unit };
            }
            if (doc.energy_kcal_per_kg != null && !isNaN(doc.energy_kcal_per_kg))
                entry.energy = Number(doc.energy_kcal_per_kg);
            if (doc.size != null && !isNaN(doc.size))
                entry.size = Number(doc.size);
            return entry;
        });
    };

    const loadFavorites = (savedData) => {
        setFavorites(new Set(savedData.favorites ?? []));
    };

    const toggleFavorite = async (combo) => {
        const key = comboKey(combo);
        const updated = new Set(favorites);
        if (updated.has(key)) { updated.delete(key); } else { updated.add(key); }
        setFavorites(updated);
        try {
            await updateDoc(doc(db, 'meal_plans', selectedPetIdRef.current), { favorites: Array.from(updated) });
        } catch (err) {
            console.warn('Could not save favorite:', err.message);
        }
    };

    const deleteSavedMealPlan = async () => {
        try {
            await deleteDoc(doc(db, 'meal_plans', selectedPetIdRef.current));
        } catch (err) {
            console.warn('Could not delete old meal plan:', err.message);
        }
    };

    const notifyRailwayCleanup = async () => {
        try {
            const data = await (await fetch(`${RAILWAY_BASE_URL}/cleanup`, { method: 'GET' })).json();
            console.log('Railway cleanup:', data);
        } catch (err) {
            console.warn('Railway cleanup call failed:', err.message);
        }
    };

    const saveJobId = async (petId: string, jobId: string) => {
        try { await AsyncStorage.setItem(jobStorageKey(petId), jobId); }
        catch (e) { console.warn('Could not persist job_id:', e); }
    };

    const clearJobId = async (petId: string) => {
        try { await AsyncStorage.removeItem(jobStorageKey(petId)); }
        catch (e) { console.warn('Could not clear job_id:', e); }
    };

    const loadJobId = async (petId: string): Promise<string | null> => {
        try { return await AsyncStorage.getItem(jobStorageKey(petId)); }
        catch { return null; }
    };

    const pollOnce = async (jobId: string, pet: any, fingerprint: string) => {
        const petId = selectedPetIdRef.current;
        try {
            const res = await fetch(`${RAILWAY_BASE_URL}/meal-plan-status/${jobId}`);
            if (!res.ok) { schedulePollRef.current?.(jobId, pet, fingerprint); return; }
            const job = await res.json();

            if (job.status === 'done') {
                clearPollTimer();
                pendingJobRef.current = null;
                await clearJobId(petId);
                const data = job.result;
                if (data && 'error' in data) {
                    setGenerateMessage(null);
                    setError(data.error);
                    setLoading(false);
                    isRunning.current = false;
                    return;
                }
                await deleteSavedMealPlan();
                await saveMealPlan(pet, data, fingerprint);
                await notifyRailwayCleanup();
                setMealPlan(data);
                setIsFromCache(false);
                setGenerateMessage(null);
                setShowFavoritesOnly(false);
                setSortMode('none');
                setFilter(EMPTY_FILTER);
                setPendingFilter(EMPTY_FILTER);
                setLoading(false);
                isRunning.current = false;

            } else if (job.status === 'failed') {
                clearPollTimer();
                pendingJobRef.current = null;
                await clearJobId(petId);
                setGenerateMessage(null);
                setError(job.error ?? 'Generation failed on the server.');
                setLoading(false);
                isRunning.current = false;

            } else if (job.status === 'not_found') {
                clearPollTimer();
                pendingJobRef.current = null;
                await clearJobId(petId);
                setGenerateMessage("Server restarted — restarting generation…\nThis may take 10–20 minutes, please wait. Don't switch to any accounts / pet profiles or exit the app from background or exit the app from background");
                await runGeneration();

            } else {
                schedulePollRef.current?.(jobId, pet, fingerprint);
            }
        } catch (err) {
            console.warn('Poll error:', err.message);
            schedulePollRef.current?.(jobId, pet, fingerprint);
        }
    };

    const schedulePoll = (jobId: string, pet: any, fingerprint: string) => {
        clearPollTimer();
        if (AppState.currentState !== 'active') return;
        pollTimerRef.current = setTimeout(() => pollOnce(jobId, pet, fingerprint), POLL_INTERVAL_MS);
    };

    schedulePollRef.current = schedulePoll;

    const checkForSavedPlanOrGenerate = async () => {
        if (isRunning.current) return;
        isRunning.current = true;
        const petId = selectedPetIdRef.current;
        try {
            setLoadingCached(true);
            setError(null);
            setGenerateMessage(null);
            setShowFavoritesOnly(false);
            setSortMode('none');

            const existingJobId = await loadJobId(petId);
            if (existingJobId) {
                const res = await fetch(`${RAILWAY_BASE_URL}/meal-plan-status/${existingJobId}`);
                const job = res.ok ? await res.json() : { status: 'not_found' };
                if (job.status === 'pending' || job.status === 'running') {
                    const pet = await getPetInfo();
                    setPetType(pet.type);
                    setLoadingCached(false);
                    setLoading(true);
                    setGenerateMessage("Generation is still in progress…\nThis may take 10–20 minutes, please wait. Don't switch to any accounts / pet profiles or exit the app from background");
                    const fingerprint = await AsyncStorage.getItem(`meal_plan_fp_${petId}`) ?? '';
                    pendingJobRef.current = { jobId: existingJobId, pet, fingerprint };
                    schedulePoll(existingJobId, pet, fingerprint);
                    return;
                }
                await clearJobId(petId);
            }

            const savedSnap = await getDoc(doc(db, 'meal_plans', petId));
            if (!savedSnap.exists()) {
                setMealPlan(null);
                setLoadingCached(false);
                setGenerateMessage("No saved plan found. Generating a meal plan for you…\nThis may take 10–20 minutes, please wait. Don't switch to any accounts / pet profiles or exit the app from background");
                await runGeneration();
                return;
            }

            const saved = savedSnap.data();
            const pet = await getPetInfo();
            setPetType(pet.type);
            const customFoods = await getCustomFoods();
            const currentFingerprint = buildCustomFoodsFingerprint(customFoods);
            const savedFingerprint = saved.custom_foods_fingerprint ?? null;

            const sameType = saved.pet_type === pet.type;
            const sameClass = saved.pet_class === pet.petClass;
            const sameWeight = normaliseWeight(saved.weight) === normaliseWeight(pet.weight);
            const sameCustomFoods =
            customFoods.length === 0
                ? true
                : savedFingerprint === currentFingerprint;

            if (sameType && sameClass && sameWeight && sameCustomFoods) {
                setMealPlan(saved.meal_plan);
                setIsFromCache(true);
                loadFavorites(saved);
                setLoadingCached(false);
                isRunning.current = false;
            } else {
                const changes = [];
                if (!sameType) changes.push('pet type');
                if (!sameClass) changes.push('activity class');
                if (!sameWeight) changes.push('weight');
                if (!sameCustomFoods) changes.push('custom foods');
                setMealPlan(saved.meal_plan);
                setIsFromCache(true);
                loadFavorites(saved);
                setLoadingCached(false);
                setGenerateMessage(`Changes detected in ${changes.join(' and ')}. Regenerating meal plan…\nThis may take 10–20 minutes, please wait. Don't switch to any accounts / pet profiles or exit the app from background. After generating, all meal plans will now be automatically saved to your account`);
                await runGeneration();
            }
        } catch (err) {
            setLoadingCached(false);
            setGenerateMessage(null);
            setError(err instanceof Error ? err.message : 'Unknown error occurred.');
            isRunning.current = false;
        }
    };

    const saveMealPlan = async (pet, data, fingerprint) => {
        const petId = selectedPetIdRef.current;
        await setDoc(doc(db, 'meal_plans', petId), {
            pet_id: petId,
            pet_type: pet.type,
            pet_class: pet.petClass,
            weight: normaliseWeight(pet.weight),
            meal_plan: data,
            favorites: Array.from(favorites),
            custom_foods_fingerprint: fingerprint,
            generated_at: new Date().toISOString(),
        });
    };

    const runGeneration = async () => {
        const petId = selectedPetIdRef.current;
        setLoading(true);
        setError(null);
        try {
            const pet = await getPetInfo();
            const customFoods = await getCustomFoods();
            const fingerprint = buildCustomFoodsFingerprint(customFoods);
            await AsyncStorage.setItem(`meal_plan_fp_${petId}`, fingerprint);

            const params = new URLSearchParams({ CLASS: pet.type.toLowerCase(), WEIGHT: String(normaliseWeight(pet.weight)) });
            if (pet.petClass) params.set('ACTIVE', pet.petClass);
            if (customFoods.length > 0) {
                const parsedCustom = buildCustomParam(customFoods);
                console.log('CUSTOM JSON:', JSON.stringify(parsedCustom, null, 2));
                params.set('CUSTOM', JSON.stringify(parsedCustom));
            }
            if (filter.include.length > 0) params.set('REQUIRED', filter.include.join(','));
            if (filter.exclude.length > 0) params.set('EXCLUDE', filter.exclude.join(','));

            const startRes = await fetch(`${RAILWAY_BASE_URL}/meal-plan-start?${params.toString()}`, { method: 'GET' });
            if (!startRes.ok) {
                const text = await startRes.text();
                throw new Error(`Server error ${startRes.status}: ${text}`);
            }
            const startData = await startRes.json();
            if ('error' in startData) throw new Error(startData.error);

            const { job_id: jobId } = startData;
            await saveJobId(petId, jobId);
            pendingJobRef.current = { jobId, pet, fingerprint };
            schedulePoll(jobId, pet, fingerprint);

        } catch (err) {
            setGenerateMessage(null);
            setError(err instanceof Error ? err.message : 'Unknown error occurred.');
            setLoading(false);
            isRunning.current = false;
        }
    };

    const filteredCombinations = useMemo(() => {
        if (!mealPlan) return [];
        let result = mealPlan.combinations.filter(combo => {
            const hasAllIncluded = filter.include.every(f => combo.foods.includes(f));
            const hasNoneExcluded = filter.exclude.every(f => !combo.foods.includes(f));
            const isFavorited = showFavoritesOnly ? favorites.has(comboKey(combo)) : true;
            return hasAllIncluded && hasNoneExcluded && isFavorited;
        });
        if (sortMode === 'asc') result = [...result].sort((a, b) => (a.total_grams ?? 0) - (b.total_grams ?? 0));
        if (sortMode === 'desc') result = [...result].sort((a, b) => (b.total_grams ?? 0) - (a.total_grams ?? 0));
        return result;
    }, [mealPlan, filter, showFavoritesOnly, favorites, sortMode]);

    useEffect(() => { setCurrentPage(1); }, [filteredCombinations]);

    const allFoods = useMemo(() => {
        if (!mealPlan) return [];
        const foodSet = new Set();
        mealPlan.combinations.forEach(combo => combo.foods.forEach(f => foodSet.add(f)));
        return Array.from(foodSet);
    }, [mealPlan]);

    const totalPages = Math.max(1, Math.ceil(filteredCombinations.length / PAGE_SIZE));
    const paginatedCombinations = filteredCombinations.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    const toggleFoodInFilter = (food, tab) => {
        setPendingFilter(prev => {
            const updated = prev[tab].includes(food) ? prev[tab].filter(f => f !== food) : [...prev[tab], food];
            const opposite = tab === 'include' ? 'exclude' : 'include';
            return { ...prev, [tab]: updated, [opposite]: prev[opposite].filter(f => f !== food) };
        });
    };

    const hasActiveFilter = filter.include.length > 0 || filter.exclude.length > 0;
    const isBusy = loading || loadingCached;

    const renderHeader = () => (
        <View style={styles.header}>
            {!selectedPetId && <Text style={styles.noPetText}>Select a pet to generate a meal plan.</Text>}
            {error && <Text style={styles.errorText}>{error}</Text>}
            {loadingCached && !loading && <Text style={styles.statusText}>Checking for a saved meal plan…</Text>}
            {loading && generateMessage && <Text style={styles.statusText}>{generateMessage}</Text>}

            <View style={styles.button}>
                {isBusy
                    ? <ActivityIndicator color="white" />
                    : <View style={styles.buttonInner}>
                        <Ionicons name="shuffle-outline" size={18} color="white" style={{ marginRight: 6 }} />
                        <Text style={styles.buttonText}>GENERATE</Text>
                    </View>
                }
            </View>

            <View style={styles.customButtonRow}>
                <TouchableOpacity style={styles.customButton} onPress={() => router.push('/(tabs)/add_custom_food')}>
                    <Ionicons name="add-circle-outline" size={16} color={TEAL} style={{ marginRight: 6 }} />
                    <Text style={styles.customButtonText}>ADD {petLabel} FOOD</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.customButton} onPress={() => router.push('/(tabs)/view_custom_food')}>
                    <Ionicons name="list-outline" size={16} color={TEAL} style={{ marginRight: 6 }} />
                    <Text style={styles.customButtonText}>VIEW {petLabel} FOODS</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.disclaimerText}>
                Generation is fully automatic. A new meal plan is generated only when
                your pet has no existing plan, or when their weight, activity class, or custom foods change.
            </Text>

            {mealPlan && favorites.size > 0 && (
                <TouchableOpacity
                    onPress={() => setShowFavoritesOnly(prev => !prev)}
                    style={[styles.favButton, showFavoritesOnly && styles.favButtonActive]}
                >
                    <Text style={[styles.favButtonText, showFavoritesOnly && styles.favButtonTextActive]}>
                        {showFavoritesOnly
                            ? `Showing ${favorites.size} favorite${favorites.size > 1 ? 's' : ''} · tap to show all`
                            : `♥  View favorites (${favorites.size})`}
                    </Text>
                </TouchableOpacity>
            )}

            {mealPlan && (
                <View style={styles.metaRow}>
                    <Text style={styles.totalText}>
                        {filteredCombinations.length} of {mealPlan.total_valid_combinations} combinations
                        {loading && '  •  Regenerating…'}
                    </Text>
                    <View style={styles.metaButtons}>
                        <TouchableOpacity
                            onPress={cycleSortMode}
                            style={[styles.sortButton, sortMode !== 'none' && styles.sortButtonActive]}
                        >
                            <Text style={[styles.sortButtonIcon, sortMode !== 'none' && styles.sortButtonTextActive]}>
                                {SORT_ICONS[sortMode]}
                            </Text>
                            <Text style={[styles.sortButtonLabel, sortMode !== 'none' && styles.sortButtonTextActive]}>g</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { setPendingFilter(filter); setFilterVisible(true); }}
                            style={[styles.filterButton, hasActiveFilter && styles.filterButtonActive]}
                        >
                            <Text style={[styles.filterButtonText, hasActiveFilter && styles.filterButtonTextActive]}>
                                Filter{hasActiveFilter ? ` (${filter.include.length + filter.exclude.length})` : ''}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {mealPlan && totalPages > 1 && (
                <View>
                    <View style={styles.paginationRow}>
                        <TouchableOpacity
                            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                        >
                            <Text style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}>‹ Prev</Text>
                        </TouchableOpacity>

                        <Text style={styles.pageInfo}>
                            Page {currentPage} of {totalPages}
                        </Text>

                        <TouchableOpacity
                            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
                        >
                            <Text style={[styles.pageButtonText, currentPage === totalPages && styles.pageButtonTextDisabled]}>Next ›</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.displayingText}>
                        Displaying {Math.min(currentPage * PAGE_SIZE, filteredCombinations.length)} of {filteredCombinations.length} entries
                    </Text>
                </View>
            )}
        </View>
    );

    const renderItem = ({ item, index }) => {
        const key = comboKey(item);
        const isFav = favorites.has(key);
        return (
            <TouchableOpacity
                style={[styles.card, isFav && styles.cardFavorited]}
                onPress={() => router.push({ pathname: '/meal_plan_details', params: { combination: JSON.stringify(item) } })}
            >
                <View style={styles.cardAccent} />
                <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle}>Option {(currentPage - 1) * PAGE_SIZE + index + 1}</Text>
                        <TouchableOpacity onPress={() => toggleFavorite(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={[styles.heartIcon, isFav && styles.heartIconActive]}>{isFav ? '♥' : '♡'}</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.cardFoods}>
                        {item.foods.map(formatFoodName).join(', ')}
                    </Text>
                    <View style={styles.cardMetaRow}>
                        <Text style={styles.cardMeta}>{item.delivered_me.toFixed(1)} kcal delivered</Text>
                        {item.total_grams != null && (
                            <Text style={styles.cardGrams}>
                                {typeof item.total_grams === 'number' ? item.total_grams.toFixed(1) : item.total_grams}g total
                            </Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <FlatList
                data={paginatedCombinations}
                keyExtractor={(_, index) => String((currentPage - 1) * PAGE_SIZE + index)}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.container}
                ListEmptyComponent={
                    mealPlan && !isBusy
                        ? <Text style={styles.emptyText}>
                            {showFavoritesOnly
                                ? 'No favorites yet. Tap ♡ on any combination to save it.'
                                : 'No combinations match your filter.'}
                        </Text>
                        : null
                }
            />
            <MealFilterModal
                visible={filterVisible}
                allFoods={allFoods}
                pendingFilter={pendingFilter}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onToggle={toggleFoodInFilter}
                onApply={() => { setFilter(pendingFilter); setFilterVisible(false); }}
                onClear={() => { setFilter(EMPTY_FILTER); setPendingFilter(EMPTY_FILTER); setFilterVisible(false); }}
                onClose={() => setFilterVisible(false)}
                formatFoodName={formatFoodName}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 30, backgroundColor: '#ffffff' },
    header: { paddingVertical: 24, alignItems: 'center' },
    noPetText: { fontSize: 13, color: '#888888', marginBottom: 12 },
    statusText: { fontSize: 13, color: '#555555', textAlign: 'center', lineHeight: 20, marginBottom: 10, paddingHorizontal: 8 },
    disclaimerText: { fontSize: 11, color: '#aaaaaa', textAlign: 'center', marginTop: 8, marginBottom: 4, lineHeight: 16, paddingHorizontal: 8 },
    errorText: { fontSize: 13, color: '#c0392b', marginBottom: 12, textAlign: 'center' },
    button: { width: '100%', paddingVertical: 13, borderRadius: 25, alignItems: 'center', marginBottom: 4, marginTop: 8, backgroundColor: TEAL },
    buttonInner: { flexDirection: 'row', alignItems: 'center' },
    buttonText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
    customButtonRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 8 },
    customButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: TEAL, borderRadius: 25, paddingVertical: 10 },
    customButtonText: { color: TEAL, fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
    favButton: { width: '100%', paddingVertical: 10, borderRadius: 25, borderWidth: 1.5, borderColor: TEAL, alignItems: 'center', marginTop: 8, backgroundColor: 'transparent' },
    favButtonActive: { backgroundColor: TEAL, borderColor: TEAL },
    favButtonText: { fontSize: 14, color: TEAL, fontWeight: '500' },
    favButtonTextActive: { color: '#ffffff' },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 12 },
    totalText: { fontSize: 13, color: '#888888', flexShrink: 1 },
    metaButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sortButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1.5, borderColor: TEAL, gap: 2 },
    sortButtonActive: { borderColor: TEAL, backgroundColor: TEAL },
    sortButtonIcon: { fontSize: 13, color: TEAL, fontWeight: '600' },
    sortButtonLabel: { fontSize: 13, color: TEAL },
    sortButtonTextActive: { color: '#ffffff' },
    filterButton: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: TEAL },
    filterButtonActive: { borderColor: TEAL, backgroundColor: TEAL },
    filterButtonText: { fontSize: 13, color: TEAL },
    filterButtonTextActive: { color: '#ffffff' },
    emptyText: { textAlign: 'center', color: '#888888', marginTop: 20, fontSize: 14, paddingHorizontal: 16 },
    card: { flexDirection: 'row', backgroundColor: '#f9fefe', borderRadius: 12, marginBottom: 10, borderWidth: 1.5, borderColor: TEAL_LIGHT, overflow: 'hidden' },
    cardFavorited: { borderColor: TEAL, backgroundColor: '#e8fafa' },
    cardAccent: { width: 5, backgroundColor: TEAL },
    cardContent: { flex: 1, padding: 14 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    cardTitle: { fontWeight: 'bold', fontSize: 16, color: '#111111' },
    heartIcon: { fontSize: 22, color: TEAL_LIGHT },
    heartIconActive: { color: TEAL },
    cardFoods: { fontSize: 14, color: '#333333', marginBottom: 8 },
    cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardMeta: { fontSize: 12, color: '#888888' },
    cardGrams: { fontSize: 12, color: '#888888', fontWeight: '500' },
    paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 10, marginBottom: 2 },
    displayingText: { fontSize: 12, color: '#888888', textAlign: 'center', width: '100%', marginTop: 4 },
    pageButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: TEAL },
    pageButtonDisabled: { borderColor: '#CCCCCC' },
    pageButtonText: { fontSize: 13, color: TEAL, fontWeight: '600' },
    pageButtonTextDisabled: { color: '#CCCCCC' },
    pageInfo: { fontSize: 13, color: '#555555', fontWeight: '500' },
});