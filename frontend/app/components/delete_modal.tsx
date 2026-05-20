import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { deleteObject, getStorage, ref } from "firebase/storage";
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../firebaseConfig";

const TEAL = "#47D9D7";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const GRAY = "#888888";
const RED = "#FF4D4D";
const OVERLAY = "#00000066"

export default function DeleteModal({status, vaccinationID, entryID, documentID, imagePath} : { status: string, vaccinationID?: string, entryID?: string, documentID?: string, imagePath?: string }) {
    const [modalVisible, setModalVisible] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);

    async function deleteVaccination() { 
        if (submitting || !vaccinationID) return;
        setSubmitting(true);
        try {
            const docRef = doc(db, "vaccination_records", vaccinationID);
            await deleteDoc(docRef);
            setModalVisible(false);
        } catch (error) {
            console.error("Error deleting vaccination record:", error);
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteEntry() {
        if (submitting || !vaccinationID || !entryID) return;
        setSubmitting(true);
        try {
            const user = auth.currentUser;
            if (!user) return;
            const entriesRef = collection(db, "vaccination_records", vaccinationID, "vaccine_entries");
            const snapshot = await getDocs(entriesRef);
            if (snapshot.size === 1) {
                const vaccinationRef = doc(db, "vaccination_records", vaccinationID);
                router.replace('/records');
                await deleteDoc(vaccinationRef);
            } else {
                const docRef = doc(db, "vaccination_records", vaccinationID, "vaccine_entries", entryID);
                await deleteDoc(docRef);
            }
            setModalVisible(false);
        } catch (error) {   
            console.error("Error deleting entry:", error);
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteDocument() { 
        if (submitting || !documentID || !imagePath) return;
        setSubmitting(true);
        const storage = getStorage();
        try {
            const storageRef = ref(storage, imagePath);
            const docRef = doc(db, "upload_documents", documentID);
            await deleteDoc(docRef);
            await deleteObject(storageRef);
            setModalVisible(false);
        } catch (error) {
            console.error("Error deleting document record:", error);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <View>
            <TouchableOpacity onPress={() => setModalVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={24} color={BLACK} />
            </TouchableOpacity>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(!modalVisible)}
            >
                <View style={styles.overlay}>
                    <View style={styles.sheet}>
                        <Text style={styles.title}>Delete Record</Text>
                        <Text style={styles.message}>
                            Are you sure you want to delete this record? This action is permanent and cannot be undone.
                        </Text>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.deleteButton, submitting && styles.disabledButton]}
                                disabled={submitting}
                                onPress={() => {
                                    if (status === "Delete Vaccination") {
                                        deleteVaccination();
                                    } else if (status === "Delete Vaccine Entry") {
                                        deleteEntry();
                                    } else {
                                        deleteDocument();
                                    }
                                }}
                            >
                                <Text style={styles.deleteText}>
                                    {submitting ? "Deleting..." : "Confirm"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: OVERLAY,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    sheet: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 28,
        width: "100%",
        shadowColor: BLACK,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: BLACK,
        marginBottom: 10,
        textAlign: "center",
    },
    message: {
        fontSize: 14,
        color: GRAY,
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    cancelText: {
        color: TEAL,
        fontWeight: "700",
        fontSize: 15,
    },
    deleteButton: {
        flex: 1,
        backgroundColor: RED,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    disabledButton: {
        opacity: 0.6,
    },
    deleteText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 15,
    },
});