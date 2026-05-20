import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface Props {
    message?: string;
}

export default function LoadingScreen({ message = "Loading..." }: Props) {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#47D9D7" />
            <Text style={styles.message}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12
    },
    message: {
        fontSize: 16,
        color: "#47D9D7"
    },
});