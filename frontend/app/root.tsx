import { router } from "expo-router";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TEAL = "#47D9D7";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_LIGHT = "#888888";

export default function LandingScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.root}>
            <View style={[styles.topContainer, { paddingTop: insets.top + 32 }]}>
                <Image
                    source={require("../assets/images/pawplan_icon.png")}
                    style={styles.icon}
                    resizeMode="contain"
                />
            </View>

            <View style={[styles.card, { paddingBottom: insets.bottom + 24 }]}>
                <Text style={styles.appName}>PawPlan</Text>
                <Text style={styles.tagline}>
                    Your smart companion for keeping your pet healthy, happy, and well-fed.
                </Text>

                <View style={{ flex: 1 }} />

                <TouchableOpacity style={styles.signUpButton} onPress={() => router.push("/signup")}>
                    <Text style={styles.signUpButtonText}>SIGN UP</Text>
                </TouchableOpacity>
                
                <Text style={styles.loginText}>
                    Already have an account?{" "}
                    <Text style={styles.loginButton} onPress={() => router.push("/login")}>
                        Sign In
                    </Text>
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: TEAL,
    },
    topContainer: {
        backgroundColor: TEAL,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 60,
    },
    icon: {
        width: 160,
        height: 160,
    },
    card: {
        flex: 1,
        backgroundColor: WHITE,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingHorizontal: 32,
        paddingTop: 36,
        alignItems: "center",
    },
    appName: {
        fontSize: 36,
        fontWeight: "800",
        color: BLACK,
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    tagline: {
        fontSize: 14,
        color: TEXT_LIGHT,
        textAlign: "center",
        lineHeight: 20,
        paddingHorizontal: 8,
    },
    signUpButton: {
        width: "100%",
        backgroundColor: TEAL,
        borderRadius: 25,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 20,
    },
    signUpButtonText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 15,
        letterSpacing: 1,
    },
    loginText: {
        fontSize: 14,
        color: TEXT_LIGHT,
        marginBottom: 30,
    },
    loginButton: {
        color: TEAL,
        fontWeight: "600",
    },
});