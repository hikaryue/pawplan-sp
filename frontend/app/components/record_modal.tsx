import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from "expo-notifications";
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import React from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { auth, db } from "../../firebaseConfig";
import { usePet } from "../context/petContext";
import { scheduleSingleVaccineEntry } from "../utils/pushNotification";

const TEAL = "#47D9D7";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_DARK = "#222222";
const TEXT_MID = "#555555";
const TEXT_LIGHT = "#888888";
const PLACEHOLDER = "#aaaaaa";
const BORDER_LIGHT = "#cccccc";
const ERROR_BG = "#ffe5e5";
const ERROR_BORDER = "#ff4d4d";
const ERROR_TEXT = "#cc0000";

type PetProfile = {
  id: string;
  uid: string;
  name: string;
};

export default function RecordModal({ status, vaccinationID, entryID, name, lastDate, nextDate, clinic, documentID, imagePath }: { status: string, vaccinationID?: string, entryID?: string, name?: string, lastDate?: Date, nextDate?: Date, clinic?: string, documentID?: string, imagePath?: string }) {
    const currentUser = auth.currentUser;
    const { selectedPetId } = usePet();
    const [modalVisible, setModalVisible] = React.useState(false);
    const [showLastDatePicker, setShowLastDatePicker] = React.useState(false);
    const [showNextDatePicker, setShowNextDatePicker] = React.useState(false);
    const [vaccineLastDate, setLastDate] = React.useState(lastDate ?? new Date());
    const [vaccineNextDate, setNextDate] = React.useState(nextDate ?? new Date());
    const [lastDateSet, setLastDateSet] = React.useState(!!lastDate);
    const [nextDateSet, setNextDateSet] = React.useState(!!nextDate);
    const [vaccineName, setVaccineName] = React.useState(name ?? "");
    const [vaccineClinic, setClinic] = React.useState(clinic ?? "");
    const [vaccineEntries, setVaccineEntries] = React.useState<any[]>([]);
    const [submitting, setSubmitting] = React.useState(false);
    const [entry_id, setEntryID] = React.useState("");
    const [formError, setFormError] = React.useState<string[]>([]);
    const [documentName, setDocumentName] = React.useState("");
    const [uploading, setUploading] = React.useState(false);
    const [optionsVisible, setOptionsVisible] = React.useState(false);
    const [imageForm, setImageForm] = React.useState(false);
    const [image, setImage] = React.useState<string | null>(null);

    const user = auth.currentUser;

    React.useEffect(() => {
        if (modalVisible) {
            if (entryID) setEntryID(entryID);
            if (lastDate) { setLastDate(lastDate); setLastDateSet(true); } else { setLastDate(new Date()); setLastDateSet(false); }
            if (nextDate) { setNextDate(nextDate); setNextDateSet(true); } else { setNextDate(new Date()); setNextDateSet(false); }
            if (clinic !== undefined) setClinic(clinic);
            if (name !== undefined && !documentID) {
                setVaccineName(name);
            } else if (name !== undefined && documentID) {
                setDocumentName(name);
            }
            setImage(null);
            setFormError([]);
        }
    }, [modalVisible]);

    function validateForm(checkName: boolean, checkClinic?: boolean, checkImage?: boolean) {
        const errors: string[] = [];
        if (checkName && !vaccineName.trim()) errors.push("name");
        if (!checkClinic) {
            if (checkClinic && !vaccineClinic.trim()) errors.push("clinic");
        }
        if (checkImage && !imagePath?.trim()) errors.push("image");
        setFormError(errors);
        return errors.length === 0;
    }

    async function addVaccination() {
        if (!validateForm(true, true)) return;
        if (submitting) return;
        setSubmitting(true);
        try {
            const user = auth.currentUser;
            if (!user) return;
            const docRef = await addDoc(collection(db, "vaccination_records"), {
                uid: user.uid,
                pet_id: selectedPetId,
                vaccination_name: vaccineName,
            });
            const entriesRef = collection(db, "vaccination_records", docRef.id, "vaccine_entries");
            const petsSnap = await getDocs(
                query(collection(db, "pet_profile"), where("uid", "==", user.uid))
            );

            const pets = petsSnap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as { uid: string; name: string })
            }));

            const pet = pets.find(p => p.id === selectedPetId);
            if (!pet) return;

            const notificationIds = await scheduleSingleVaccineEntry(
                pet.name,
                vaccineName,
                vaccineClinic,
                vaccineNextDate
            );

            //Save entry with id
            await addDoc(entriesRef, {
                last_date: vaccineLastDate,
                next_date: vaccineNextDate,
                clinic: vaccineClinic,
                status: "upcoming",
                notification_ids: notificationIds 
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            setVaccineName("");
            setClinic("");
            setLastDate(new Date());
            setNextDate(new Date());
            setLastDateSet(false);
            setNextDateSet(false);
            setFormError([]);
            setModalVisible(false);
        } catch (error) {
            console.error("Error adding vaccination record:", error);
        } finally {
            setSubmitting(false);
        }
    }

    async function addVaccineEntry() {
        if (!validateForm(false, true)) return;
        if (submitting) return;

        setSubmitting(true);

        try {
            const user = auth.currentUser;
            if (!user || !vaccinationID || !selectedPetId) return;

            const entriesRef = collection(
                db,
                "vaccination_records",
                vaccinationID,
                "vaccine_entries"
            );

            const petsSnap = await getDocs(
                query(collection(db, "pet_profile"), where("uid", "==", user.uid))
            );

            const pets = petsSnap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as { uid: string; name: string })
            }));

            const pet = pets.find(p => p.id === selectedPetId);
            if (!pet) return;

            const notificationIds = await scheduleSingleVaccineEntry(
                pet.name,
                name ?? vaccineName,
                vaccineClinic,
                vaccineNextDate
            );

            await addDoc(entriesRef, {
                last_date: vaccineLastDate,
                next_date: vaccineNextDate,
                clinic: vaccineClinic,
                status: "upcoming",
                notification_ids: notificationIds
            });

            setClinic("");
            setLastDate(new Date());
            setNextDate(new Date());
            setLastDateSet(false);
            setNextDateSet(false);
            setFormError([]);
            setModalVisible(false);

        } catch (error) {
            console.error("Error adding vaccine entry:", error);
        } finally {
            setSubmitting(false);
        }
    }

    async function editVaccination() {
        if (!validateForm(true, false)) return;
        if (submitting || !vaccinationID) return;

        setSubmitting(true);

        try {
            const user = auth.currentUser;
            if (!user || !selectedPetId) return;

            const recordRef = doc(db, "vaccination_records", vaccinationID);
            await updateDoc(recordRef, { vaccination_name: vaccineName });

            const entriesRef = collection(
                db,
                "vaccination_records",
                vaccinationID,
                "vaccine_entries"
            );

            const entriesSnap = await getDocs(entriesRef);

            const petsSnap = await getDocs(
                query(collection(db, "pet_profile"), where("uid", "==", user.uid))
            );

            const pets = petsSnap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as { uid: string; name: string })
            }));

            const pet = pets.find(p => p.id === selectedPetId);
            if (!pet) return;

            for (const docSnap of entriesSnap.docs) {
                const data = docSnap.data();
                const entryId = docSnap.id;

                const entryRef = doc(
                    db,
                    "vaccination_records",
                    vaccinationID,
                    "vaccine_entries",
                    entryId
                );

                if (data.notification_ids) {
                    for (const id of data.notification_ids) {
                        await Notifications.cancelScheduledNotificationAsync(id);
                    }
                }

                const nextDate = data.next_date.toDate();

                const newIds = await scheduleSingleVaccineEntry(
                    pet.name,
                    vaccineName, 
                    data.clinic,
                    nextDate
                );

                await updateDoc(entryRef, {
                    notification_ids: newIds
                });
            }

            setVaccineName("");
            setFormError([]);
            setModalVisible(false);

        } catch (error) {
            console.error("Error updating vaccination record:", error);
        } finally {
            setSubmitting(false);
        }
    }

   async function editVaccineEntry() {
        if (!validateForm(false, true)) return;
        if (submitting || !vaccinationID || !entry_id) return;

        setSubmitting(true);

        try {
            const user = auth.currentUser;
            if (!user || !selectedPetId) return;

            const entryRef = doc(
                db,
                "vaccination_records",
                vaccinationID,
                "vaccine_entries",
                entry_id
            );

            const entrySnap = await getDoc(entryRef);
            const existingData = entrySnap.data();

            if (existingData?.notification_ids) {
                for (const id of existingData.notification_ids) {
                    await Notifications.cancelScheduledNotificationAsync(id);
                }
            }

            const updateData = {
                last_date: vaccineLastDate,
                next_date: vaccineNextDate,
                clinic: vaccineClinic,
                status: "upcoming",
            };

            const petsSnap = await getDocs(
                query(collection(db, "pet_profile"), where("uid", "==", user.uid))
            );

            const pets = petsSnap.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as { uid: string; name: string })
            }));

            const pet = pets.find(p => p.id === selectedPetId);
            if (!pet) return;

            const newIds = await scheduleSingleVaccineEntry(
                pet.name,
                name ?? vaccineName,
                vaccineClinic,
                vaccineNextDate
            );

            await updateDoc(entryRef, {
                ...updateData,
                notification_ids: newIds
            });

        
            setClinic("");
            setFormError([]);
            setModalVisible(false);

        } catch (error) {
            console.error("Error updating vaccine entry:", error);
        } finally {
            setSubmitting(false);
        }
    }

    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert('Permission required', 'Permission to access the media library is required.');
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
        if (!result.canceled) setImage(result.assets[0].uri);
        setOptionsVisible(false);
        setImageForm(true);
    };

    const takeImage = async () => {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted || !libraryPermission.granted) {
            Alert.alert('Permission required', 'Permission to access the camera is required.');
            return;
        }
        let result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1 });
        if (!result.canceled) setImage(result.assets[0].uri);
        setOptionsVisible(false);
        setImageForm(true);
    };

    async function editDocument() {
        if (!documentName.trim()) { setFormError(["name"]); return; }
        if (submitting || !documentID) return;
        setSubmitting(true);
        try {
            const user = auth.currentUser;
            if (!user) return;
            const updateData: Record<string, any> = { name: documentName };
            if (imagePath) {
                try {
                    const storage = getStorage();
                    const decodedPath = decodeURIComponent(imagePath.split('/o/')[1].split('?')[0]);
                    const oldRef = ref(storage, decodedPath);
                    await deleteObject(oldRef);
                } catch (deleteError) {
                    console.warn("Could not delete old image:", deleteError);
                }
            }
            if (image) {
                setUploading(true);
                const storage = getStorage();
                const fetchResponse = await fetch(image);
                const theBlob = await fetchResponse.blob();
                const storageRef = ref(storage, `uploads/${image.split('/').pop()}`);
                const uploadTask = uploadBytesResumable(storageRef, theBlob);
                uploadTask.on("state_changed",
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`Upload is ${progress}% done`);
                    },
                    (error) => {
                        console.error("Upload error:", error);
                        Alert.alert("Upload failed", error.message);
                        setUploading(false);
                        setSubmitting(false);
                    },
                    async () => {
                        updateData.image_path = await getDownloadURL(uploadTask.snapshot.ref);
                        const entryRef = doc(db, "upload_documents", documentID);
                        await updateDoc(entryRef, updateData);
                        setUploading(false);
                        setSubmitting(false);
                        setDocumentName("");
                        setImage(null);
                        setFormError([]);
                        setModalVisible(false);
                    }
                );
            } else {
                const entryRef = doc(db, "upload_documents", documentID);
                await updateDoc(entryRef, updateData);
                setSubmitting(false);
                setDocumentName("");
                setImage(null);
                setFormError([]);
                setModalVisible(false);
            }
        } catch (error) {
            console.error("Error updating document:", error);
            Alert.alert("Update failed", String(error));
            setSubmitting(false);
        }
    }

    function handleSubmit() {
        if (status === "Add Vaccination") addVaccination();
        else if (status === "Edit Vaccination") editVaccination();
        else if (status === "Add Vaccine Entry") addVaccineEntry();
        else if (status === "Edit Vaccine Entry") editVaccineEntry();
        else editDocument();
    }

    function getModalTitle() {
        if (status === "Add Vaccination") return "Vaccination Entry";
        if (status === "Add Vaccine Entry") return `Entry for ${name ?? "Vaccine"}`;
        if (status === "Edit Vaccination") return "Edit Vaccination";
        if (status === "Edit Vaccine Entry") return "Edit Vaccine Entry";
        return "Edit Document";
    }

    if (!currentUser) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Not logged in</Text>
            </View>
        );
    }

    const isAddAction = status === "Add Vaccination" || status === "Add Vaccine Entry";
    const isEditDocument = status === "Edit Document";
    const isEditAction = status === "Edit Vaccination" || status === "Edit Vaccine Entry";
    const showVaccineName = status === "Add Vaccination" || status === "Edit Vaccination";
    const showDatesAndClinic = status === "Add Vaccination" || status === "Add Vaccine Entry" || status === "Edit Vaccine Entry";

    return (
        <View style={isAddAction ? styles.addButtonWrapper : undefined}>
            {isAddAction ? (
                <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
                    <Text style={styles.addButtonText}>+ {status.toUpperCase()}</Text>
                </TouchableOpacity>
            ) : isEditDocument || isEditAction ? (
                <TouchableOpacity onPress={() => setModalVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="pencil" size={26} color={BLACK} />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity onPress={() => setModalVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={26} color={BLACK} />
                </TouchableOpacity>
            )}

            <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.overlay}>
                    <View style={styles.card}>

                        <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                            <Ionicons name="close" size={20} color={WHITE} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>{getModalTitle()}</Text>

                        {showVaccineName && (
                            <>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.input}
                                        onChangeText={(text) => {
                                            setVaccineName(text);
                                            if (text.trim()) setFormError(prev => prev.filter(e => e !== "name"));
                                        }}
                                        value={vaccineName}
                                        placeholder="Enter Vaccination Name"
                                        placeholderTextColor={PLACEHOLDER}
                                    />
                                    <MaterialCommunityIcons name="needle" size={20} color={TEAL} style={styles.inputIcon} />
                                </View>
                                <Text style={styles.inputLabel}>Enter Vaccination Name</Text>
                            </>
                        )}

                        {showDatesAndClinic && (
                            <>
                                <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowLastDatePicker(true)}>
                                    <Text style={[styles.input, { color: lastDateSet ? TEXT_DARK : PLACEHOLDER, paddingTop: 11 }]}>
                                        {lastDateSet
                                            ? vaccineLastDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                                            : "Enter Last Vaccination Date"}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color={TEAL} style={styles.inputIcon} />
                                </TouchableOpacity>
                                <Text style={styles.inputLabel}>Enter Last Vaccination Date</Text>

                                <DateTimePickerModal
                                    isVisible={showLastDatePicker}
                                    mode="date"
                                    display="default"
                                    date={vaccineLastDate}
                                    onConfirm={(selectedDate) => { setLastDate(selectedDate); setLastDateSet(true); setShowLastDatePicker(false); }}
                                    onCancel={() => setShowLastDatePicker(false)}
                                />

                                <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowNextDatePicker(true)}>
                                    <Text style={[styles.input, { color: nextDateSet ? TEXT_DARK : PLACEHOLDER, paddingTop: 11 }]}>
                                        {nextDateSet
                                            ? vaccineNextDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                                            : "Enter Next Vaccination Date"}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color={TEAL} style={styles.inputIcon} />
                                </TouchableOpacity>
                                <Text style={styles.inputLabel}>Enter Next Vaccination Date</Text>

                                <DateTimePickerModal
                                    isVisible={showNextDatePicker}
                                    mode="date"
                                    display="default"
                                    date={vaccineNextDate}
                                    onConfirm={(selectedDate) => { setNextDate(selectedDate); setNextDateSet(true); setShowNextDatePicker(false); }}
                                    onCancel={() => setShowNextDatePicker(false)}
                                />

                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.input}
                                        onChangeText={(text) => {
                                            setClinic(text);
                                            if (text.trim()) setFormError(prev => prev.filter(e => e !== "clinic"));
                                        }}
                                        value={vaccineClinic}
                                        placeholder="Enter Clinic / Hospital"
                                        placeholderTextColor={PLACEHOLDER}
                                    />
                                    <MaterialCommunityIcons name="paw-outline" size={20} color={TEAL} style={styles.inputIcon} />
                                </View>
                                <Text style={styles.inputLabel}>Enter Clinic / Hospital</Text>
                            </>
                        )}

                        {isEditDocument && (
                            <>
                                {uploading ? (
                                    <View style={{ padding: 20, alignItems: 'center' }}>
                                        <Text>Uploading, please wait...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.input}
                                                onChangeText={(text) => {
                                                    setDocumentName(text);
                                                    if (text.trim()) setFormError(prev => prev.filter(e => e !== "name"));
                                                }}
                                                value={documentName}
                                                placeholder="Document Name"
                                                placeholderTextColor={PLACEHOLDER}
                                            />
                                            <Ionicons name="document-outline" size={20} color={TEAL} style={styles.inputIcon} />
                                        </View>
                                        <Text style={styles.inputLabel}>Document Name</Text>
                                        <TouchableOpacity style={styles.modalButton} onPress={takeImage}>
                                            <Ionicons name="camera-outline" size={20} color={TEAL} style={{ marginRight: 8 }} />
                                            <Text style={styles.modalButtonText}>Take Photo</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.modalButton} onPress={pickImage}>
                                            <Ionicons name="folder-outline" size={20} color={TEAL} style={{ marginRight: 8 }} />
                                            <Text style={styles.modalButtonText}>Upload from Files</Text>
                                        </TouchableOpacity>
                                        {image && (
                                            <View style={{ width: 200, aspectRatio: 3 / 4, marginTop: 8 }}>
                                                <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                            </View>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {formError.length > 0 && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorTitle}>Missing required fields!</Text>
                                <Text style={styles.errorText}>
                                    {formError.length === 2
                                        ? "Name and clinic are required."
                                        : formError[0] === "name"
                                        ? "Name is required."
                                        : "Clinic is required."}
                                </Text>
                            </View>
                        )}

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelButtonText}>CANCEL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmButton} onPress={handleSubmit} disabled={submitting}>
                                <Text style={styles.confirmButtonText}>
                                    {status.includes("Edit") ? "SAVE" : "ADD"}
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
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: BLACK
    },
    info: {
        fontSize: 18,
        color: BLACK,
        marginVertical: 4
    },
    petCard: {
        backgroundColor: TEXT_LIGHT,
        padding: 16,
        marginVertical: 8,
        borderRadius: 12,
        width: "90%",
        alignItems: "center"
    },
    selectedCard: {
        borderColor: TEXT_MID,
        borderWidth: 2
    },
    addButtonWrapper: {
        width: '100%',
        paddingHorizontal: 16,
        marginVertical: 8
    },
    addButton: {
        backgroundColor: TEAL,
        borderRadius: 30,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    addButtonText: {
        color: WHITE,
        fontWeight: '700',
        fontSize: 15,
        letterSpacing: 0.5
    },

    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    card: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 24,
        width: "100%",
        position: "relative",
    },
    closeButton: {
        position: "absolute",
        top: -14,
        right: -14,
        backgroundColor: TEAL,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: TEXT_DARK,
        marginBottom: 20
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 4,
        backgroundColor: WHITE,
    },
    input: {
        flex: 1,
        height: 44,
        fontSize: 14,
        color: TEXT_DARK
    },
    inputIcon: {
        marginLeft: 8
    },
    inputLabel: {
        fontSize: 11,
        color: TEXT_LIGHT,
        marginBottom: 12,
        marginLeft: 4
    },
    errorBox: {
        backgroundColor: ERROR_BG,
        borderColor: ERROR_BORDER,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,
    },
    errorTitle: {
        color: ERROR_TEXT,
        fontWeight: "bold",
        fontSize: 14,
        marginBottom: 4
    },
    errorText: {
        color: ERROR_TEXT,
        fontSize: 13
    },
    buttonRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 16,
        gap: 10
    },
    cancelButton: {
        borderWidth: 1.5,
        borderColor: BORDER_LIGHT,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 9,
    },
    cancelButtonText: {
        color: TEXT_MID,
        fontWeight: "600",
        fontSize: 13
    },
    confirmButton: {
        backgroundColor: TEAL,
        borderRadius: 20,
        paddingHorizontal: 24,
        paddingVertical: 9,
    },
    confirmButtonText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 13
    },
    modalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 25,
        paddingVertical: 11,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    modalButtonText: {
        color: TEAL,
        fontWeight: '600',
        fontSize: 14
    },
});