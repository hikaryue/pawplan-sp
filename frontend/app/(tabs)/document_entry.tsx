import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Image, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../../firebaseConfig";
import LoadingScreen from "../components/loading_screen";

const TEAL = "#47D9D7";
const TEAL_LIGHT = "#D4F1F4";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_MID = "#444444";
const TEXT_LIGHT = "#888888";

export default function DocumentEntryScreen() {
    const currentUser = auth.currentUser;
    const router = useRouter();
    const { documentId } = useLocalSearchParams<{ documentId?: string }>();
    const [imageLoading, setImageLoading] = useState(true);
    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.replace('/(tabs)/upload');
                return true;
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();;
        }, [])
    );

    useEffect(() => {
        if (!documentId) return;
        const docRef = doc(db, "upload_documents", documentId);
        const unsubscribe = onSnapshot(
            docRef,
            (snap) => {
                if (snap.exists()) setRecord({ id: snap.id, ...snap.data() });
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching document:", error);
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, [documentId]);

    if (loading) return <LoadingScreen message="Loading document..." />;

    if (!currentUser || !record) {
        return (
            <View style={styles.center}>
                <Text style={styles.title}>Document not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.cardAccent} />
                <View style={styles.cardBody}>
                    <Text style={styles.title}>{record.name}</Text>
                    <Text style={styles.dateText}>
                        Created:{" "}
                        {record.created_at?.toDate().toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </Text>
                </View>
            </View>

            <View style={styles.imageWrapper}>
                {imageLoading && (
                    <View style={styles.imageLoading}>
                        <Text style={styles.imageLoadingText}>Loading image...</Text>
                    </View>
                )}
                <Image
                    source={{ uri: record.image_path }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoadStart={() => setImageLoading(true)}
                    onLoadEnd={() => setImageLoading(false)}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: WHITE,
        paddingHorizontal: 12,
        paddingTop: 16
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: WHITE
    },
    card: {
        flexDirection: "row",
        backgroundColor: TEAL_LIGHT,
        borderRadius: 14,
        marginBottom: 20,
        overflow: "hidden"
    },
    cardAccent: {
        width: 6,
        backgroundColor: TEAL
    },
    cardBody: {
        flex: 1,
        padding: 16
    },
    title: {
        fontSize: 20,
        fontWeight: "800",
        color: BLACK,
        marginBottom: 6
    },
    dateText: {
        fontSize: 13,
        color: TEXT_MID
    },

    imageWrapper: {
        width: "100%",
        aspectRatio: 3 / 4,
        borderRadius: 16,
        overflow: "hidden"
    },
    image: {
        width: "100%",
        height: "100%"
    },
    imageLoading: {
        position: "absolute",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: TEAL_LIGHT,
        zIndex: 1
    },
    imageLoadingText: {
        fontSize: 14,
        color: TEXT_LIGHT
    },
});