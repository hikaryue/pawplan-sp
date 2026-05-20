import { auth } from "@/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TEAL = "#47D9D7";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_LIGHT = "#888888";
const PLACEHOLDER = "#AAAAAA";
const ERROR_RED = "#CC0000";
const ERROR_BG = "#FFE5E5";

export default function LogInScreen() {
    const insets = useSafeAreaInsets();

    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [showPass, setShowPass] = React.useState(false);
    const [error, setError] = React.useState("");

    function logIn() {
        if (!email.trim() || !password.trim()) {
            setError("Please enter your email and password.");
            return;
        }
        setError("");
        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                router.replace("/select_pet");
            })
            .catch((e) => {
                if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential")
                    setError("Invalid email or password.");
                else if (e.code === "auth/invalid-email")
                    setError("Please enter a valid email address.");
                else
                    setError("Login failed. Please try again.");
            });
    }

    return (
        <View style={styles.root}>
            <View style={[styles.topContainer, { paddingTop: insets.top + 16 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={16} color={WHITE} />
                    <Text style={styles.backText}>BACK</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.card}>
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.title}>Welcome Back</Text>

                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Email"
                            placeholderTextColor={PLACEHOLDER}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <Ionicons name="mail-outline" size={18} color={TEAL} />
                    </View>

                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Password"
                            placeholderTextColor={PLACEHOLDER}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPass}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowPass(p => !p)}>
                            <Ionicons name={showPass ? "eye-outline" : "lock-closed-outline"} size={18} color={TEAL} />
                        </TouchableOpacity>
                    </View>

                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity style={styles.signInButton} onPress={logIn}>
                        <Text style={styles.signInText}>SIGN IN</Text>
                    </TouchableOpacity>

                    <Text style={styles.signUpText}>
                        Don't have an account?{" "}
                        <Text style={styles.signUpLink} onPress={() => router.replace("/signup")}>
                            Sign Up
                        </Text>
                    </Text>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: TEAL
    },
    topContainer: {
        paddingHorizontal: 20,
        paddingBottom: 60
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4
    },
    backText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 13,
        letterSpacing: 0.5
    },
    card: {
        flex: 1,
        backgroundColor: WHITE,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        overflow: "hidden"
    },
    scrollContent: {
        padding: 28,
        paddingTop: 32,
        alignItems: "center"
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: BLACK,
        marginBottom: 28,
        textAlign: "center"
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: TEAL,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 52,
        width: "100%",
        marginBottom: 14
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: BLACK
    },
    errorBox: {
        width: "100%",
        backgroundColor: ERROR_BG,
        borderRadius: 10,
        padding: 12,
        marginBottom: 14
    },
    errorText: {
        color: ERROR_RED,
        fontSize: 12
    },
    signInButton: {
        width: "100%",
        backgroundColor: TEAL,
        borderRadius: 25,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 20
    },
    signInText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 15,
        letterSpacing: 1
    },
    signUpText: {
        fontSize: 14,
        color: TEXT_LIGHT,
        marginTop: 285,
        marginBottom: 30
    },
    signUpLink: {
        color: TEAL,
        fontWeight: "600"
    }
});