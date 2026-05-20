import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import React, { useEffect } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateFilter from '../components/date_filter';
import DeleteModal from '../components/delete_modal';
import LoadingScreen from '../components/loading_screen';
import NameFilter from '../components/name_filter';
import RecordModal from '../components/record_modal';
import { usePet } from '../context/petContext';

const TEAL = '#47D9D7';
const TEAL_LIGHT = '#D4F1F4';
const BACKGROUND_COLOR = '#FFFFFF';
const SECTION_COLOR = '#111111';
const SEARCH_INPUT = '#000000';
const CARD_SUB = '#444444';
const OVERLAY = '#00000080';
const MODAL_CLOSE = '#888888';
const INPUT_FIELD = '#222222';
const ERROR_TEXT = '#CC0000';

export default function UploadScreen() {
    const { selectedPetId } = usePet();
    const [image, setImage] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [optionsVisible, setOptionsVisible] = React.useState(false);
    const [imageForm, setImageForm] = React.useState(false);
    const [documents, setDocuments] = React.useState<any[]>([]);
    const [filteredDocuments, setFilteredDocuments] = React.useState<any[]>([]);
    const [searchValue, setSearchValue] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [documentName, setDocumentName] = React.useState("");
    const [formError, setFormError] = React.useState<string[]>([]);

    const user = auth.currentUser;

    useEffect(() => {
        if (!user) return;
        const entriesRef = query(
            collection(db, "upload_documents"),
            where("uid", "==", user.uid),
            where("pet_id", "==", selectedPetId)
        );
        const unsubscribe = onSnapshot(entriesRef, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDocuments(docs);
            setFilteredDocuments(docs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching pet documents:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user, selectedPetId]);

    const handleSearch = (text: string) => {
        setSearchValue(text);
        const q = text.toUpperCase();
        setFilteredDocuments(documents.filter(item =>
            String(item.name ?? '').toUpperCase().includes(q)
        ));
    };

    const handleFilter = (sorted: any[]) => {
        setDocuments(sorted);
        const q = searchValue.toUpperCase();
        setFilteredDocuments(sorted.filter(item =>
            String(item.name ?? '').toUpperCase().includes(q)
        ));
    };

    function validateForm(checkName: boolean) {
        const errors: string[] = [];
        if (checkName && !documentName.trim()) errors.push("name");
        setFormError(errors);
        return errors.length === 0;
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

    const uploadImage = async () => {
        if (!validateForm(true)) return;
        const storage = getStorage();
        if (!image || !user) return;
        setUploading(true);
        try {
            const fetchResponse = await fetch(image);
            const theBlob = await fetchResponse.blob();
            const storageRef = ref(storage, `uploads/${image.split('/').pop()}`);
            const uploadTask = uploadBytesResumable(storageRef, theBlob);
            setImageForm(false);
            uploadTask.on("state_changed",
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload is ${progress}% done`);
                },
                (error) => {
                    console.error('Upload error:', error);
                    setUploading(false);
                    Alert.alert('Upload failed', error.message);
                },
                async () => {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    setUploading(false);
                    await addDoc(collection(db, "upload_documents"), {
                        uid: user.uid,
                        pet_id: selectedPetId,
                        name: documentName,
                        image_path: downloadUrl,
                        created_at: new Date()
                    });
                    setDocumentName("");
                    setImage(null);
                    Alert.alert('Success', 'File uploaded!');
                }
            );
        } catch (error) {
            console.error('Upload error:', error);
            setUploading(false);
            Alert.alert('Upload failed', String(error));
        }
    };

    if (loading) {
        return <LoadingScreen message="Loading pet documents..." />;
    }

    if (uploading) {
        return <LoadingScreen message="Uploading pet document..."/>
    }

    const DocumentItem = ({ record }) => (
        <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: "/(tabs)/document_entry", params: { documentId: record.id } })}
        >
            <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{record.name}</Text>
                <Text style={styles.cardSub}>
                    Date Uploaded: {record.created_at?.toDate
                        ? record.created_at.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : record.created_at}
                </Text>
            </View>
            <View style={styles.cardActions}>
                <RecordModal status="Edit Document" documentID={record.id} name={record.name} imagePath={record.image_path} />
                <DeleteModal status="Delete Document" documentID={record.id} imagePath={record.image_path} />
            </View>
            <View style={[styles.cardAccent, { backgroundColor: TEAL }]} />
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.uploadButton} onPress={() => setOptionsVisible(true)}>
                <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.uploadButtonText}>UPLOAD DOCUMENT</Text>
            </TouchableOpacity>

            <FlatList
                data={filteredDocuments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <>
                        <Text style={styles.sectionTitle}>Uploaded Documents</Text>
                        {documents.length > 0 && (
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
                                <DateFilter entry={documents} setEntry={handleFilter} variable="created_at" />
                                <NameFilter entry={documents} setEntry={handleFilter} variable="name" />
                            </View>
                        )}
                    </>
                }
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No uploaded documents yet.</Text>
                }
                renderItem={({ item }) => <DocumentItem record={item} />}
            />

            <Modal transparent animationType="fade" visible={optionsVisible} onRequestClose={() => setOptionsVisible(false)}>
                <View style={styles.overlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Add Document</Text>
                        <TouchableOpacity style={styles.modalButton} onPress={takeImage}>
                            <Ionicons name="camera-outline" size={20} color={TEAL} style={{ marginRight: 8 }} />
                            <Text style={styles.modalButtonText}>Take Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalButton} onPress={pickImage}>
                            <Ionicons name="folder-outline" size={20} color={TEAL} style={{ marginRight: 8 }} />
                            <Text style={styles.modalButtonText}>Upload from Files</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setOptionsVisible(false)}>
                            <Text style={styles.modalCloseButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>


            <Modal transparent animationType="fade" visible={imageForm} onRequestClose={() => setImageForm(false)}>
                <View style={styles.overlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Name Your Document</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="document-outline" size={18} color={TEAL} style={{ marginRight: 6 }} />
                            <TextInput
                                style={styles.inputField}
                                placeholder="Document name"
                                placeholderTextColor="#aaa"
                                value={documentName}
                                onChangeText={(text) => {
                                    setDocumentName(text);
                                    if (text.trim()) setFormError(prev => prev.filter(e => e !== "name"));
                                }}
                            />
                        </View>
                        {formError.length > 0 && (
                            <Text style={styles.errorText}>Document name is required.</Text>
                        )}
                        <TouchableOpacity style={styles.modalButton} onPress={takeImage}>
                            <Ionicons name="camera-outline" size={20} color={TEAL} style={{ marginRight: 8 }} />
                            <Text style={styles.modalButtonText}>Take Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalButton} onPress={pickImage}>
                            <Ionicons name="folder-outline" size={20} color={TEAL} style={{ marginRight: 8 }} />
                            <Text style={styles.modalButtonText}>Upload from Files</Text>
                        </TouchableOpacity>
                        {image && (
                            <View style={{ width: 200, aspectRatio: 3 / 4, marginVertical: 10 }}>
                                <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                            </View>
                        )}
                        <TouchableOpacity
                            style={[styles.uploadConfirmButton, (!image) && { opacity: 0.5 }]}
                            onPress={uploadImage}
                            disabled={!image}
                        >
                            <Text style={styles.uploadConfirmButtonText}>Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => setImageForm(false)}>
                            <Text style={styles.modalCloseButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BACKGROUND_COLOR,
        paddingHorizontal: 16,
        paddingTop: 16
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    uploadButton: {
        backgroundColor: TEAL,
        borderRadius: 30,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    uploadButtonText: {
        color: BACKGROUND_COLOR,
        fontWeight: '700',
        fontSize: 15,
        letterSpacing: 0.5
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: SECTION_COLOR,
        marginBottom: 12
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
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
        paddingBottom: 30
    },
    emptyText: {
        textAlign: 'center',
        color: '#888',
        marginTop: 20,
        fontSize: 14
    },

    card: {
        backgroundColor: TEAL_LIGHT,
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
    },
    cardBody: {
        flex: 1,
        padding: 14
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: SECTION_COLOR,
        marginBottom: 3
    },
    cardSub: {
        fontSize: 12,
        color: CARD_SUB
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingRight: 12
    },
    cardAccent: {
        width: 6,
        alignSelf: 'stretch'
    },
    overlay: {
        flex: 1,
        backgroundColor: OVERLAY,
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalBox: {
        width: '85%',
        backgroundColor: BACKGROUND_COLOR,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center'
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: SECTION_COLOR,
        marginBottom: 16
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
    modalCloseButton: {
        marginTop: 4,
        paddingVertical: 10,
        color: TEAL
    },
    modalCloseButtonText: {
        color: MODAL_CLOSE,
        fontSize: 14
    },
    uploadConfirmButton: {
        width: '100%',
        backgroundColor: TEAL,
        borderRadius: 25,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 10,
    },
    uploadConfirmButtonText: {
        color: BACKGROUND_COLOR,
        fontWeight: '700',
        fontSize: 14
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
        width: '100%',
        height: 44,
    },
    inputField: {
        flex: 1,
        fontSize: 14,
        color: INPUT_FIELD
    },
    errorText: {
        color: ERROR_TEXT,
        fontSize: 12,
        alignSelf: 'flex-start',
        marginBottom: 8
    },
});