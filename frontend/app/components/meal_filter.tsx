import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TEAL = "#47D9D7";
const TEAL_LIGHT = "#B8E6E6";
const OVERLAY = "#00000066";
const MODAL_TITLE = "#111111";
const TAB_TEXT = "#555555";
const CHECKBOX_BORDER = "#CCCCCC"
const CHECKBOX_LABEL = "#333333"
const CHECKBOX_DISABLED = "#AAAAAA"

export default function MealFilterModal({
    visible,
    allFoods,
    pendingFilter,
    activeTab,
    onTabChange,
    onToggle,
    onApply,
    onClear,
    onClose,
    formatFoodName,
}) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>Filter</Text>

                    <View style={styles.tabs}>
                        {['include', 'exclude'].map(tab => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tab, activeTab === tab && styles.tabActive]}
                                onPress={() => onTabChange(tab)}
                            >
                                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                    {tab === 'include' ? 'Includes' : 'Excludes'}
                                    {pendingFilter[tab].length > 0 ? ` (${pendingFilter[tab].length})` : ''}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView style={styles.checkboxList}>
                        {allFoods.map(food => {
                            const isChecked  = pendingFilter[activeTab].includes(food);
                            const isOpposite = activeTab === 'include'
                                ? pendingFilter.exclude.includes(food)
                                : pendingFilter.include.includes(food);

                            return (
                                <TouchableOpacity
                                    key={food}
                                    style={styles.checkboxRow}
                                    onPress={() => onToggle(food, activeTab)}
                                    disabled={isOpposite}
                                >
                                    <View style={[
                                        styles.checkbox,
                                        isChecked  && styles.checkboxChecked,
                                        isOpposite && styles.checkboxDisabled,
                                    ]}>
                                        {isChecked && <Text style={styles.checkmark}>✓</Text>}
                                    </View>
                                    <Text style={[
                                        styles.checkboxLabel,
                                        isOpposite && styles.checkboxLabelDisabled,
                                    ]}>
                                        {formatFoodName(food)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.modalActions}>
                        <TouchableOpacity onPress={onClear} style={styles.clearButton}>
                            <Text style={styles.clearButtonText}>Clear</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onApply} style={styles.applyButton}>
                            <Text style={styles.applyButtonText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: OVERLAY,
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 20,
        maxHeight: '70%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: MODAL_TITLE,
        marginBottom: 16,
        textAlign: 'center',
    },
    tabs: {
        flexDirection: 'row',
        marginBottom: 12,
        borderRadius: 8,
        backgroundColor: TEAL_LIGHT,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    tabActive: {
        backgroundColor: 'white',
    },
    tabText: {
        fontSize: 14,
        color: TAB_TEXT,
    },
    tabTextActive: {
        color: TEAL,
        fontWeight: 'bold',
    },
    checkboxList: {
        marginBottom: 16,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: TEAL_LIGHT,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: CHECKBOX_BORDER,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: TEAL,
        borderColor: TEAL,
    },
    checkboxDisabled: {
        backgroundColor: TEAL_LIGHT,
        borderColor: TEAL_LIGHT,
    },
    checkmark: {
        color: 'white',
        fontSize: 13,
        fontWeight: 'bold',
    },
    checkboxLabel: {
        fontSize: 14,
        color: CHECKBOX_LABEL,
        textTransform: 'capitalize',
    },
    checkboxLabelDisabled: {
        color: CHECKBOX_DISABLED,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
    },
    clearButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: TEAL,
        alignItems: 'center',
    },
    clearButtonText: {
        fontSize: 15,
        color: TEAL,
        fontWeight: '600',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: TEAL,
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 15,
        color: 'white',
        fontWeight: 'bold',
    },
});