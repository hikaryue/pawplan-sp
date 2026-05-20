import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { generateOtp, sendOtp } from "./utils/sendOTP";
import { storeOtp } from "./utils/storeOTP";

const TEAL = "#47D9D7";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_LIGHT = "#888888";
const PLACEHOLDER = "#AAAAAA";
const ERROR_RED = "#cc0000";
const ERROR_BG = "#ffe5e5";

export default function SignUpScreen() {
    const insets = useSafeAreaInsets();

    const [fullName, setFullName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [showPass, setShowPass] = React.useState(false);
    const [formError, setFormError] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(false);

    async function signUp() {
        const errors: string[] = [];
        if (!fullName.trim()) errors.push("Please enter your full name.");
        if (!email.trim()) errors.push("Please enter your email.");
        if (!/(?=.*[a-z])/.test(password)) errors.push("Password must contain at least one lowercase letter.");
        if (!/(?=.*[A-Z])/.test(password)) errors.push("Password must contain at least one uppercase letter.");
        if (!/(?=.*[0-9])/.test(password)) errors.push("Password must contain at least one number.");
        if (!/(?=.{8,})/.test(password))   errors.push("Password must be at least 8 characters long.");

        if (errors.length > 0) { setFormError(errors); return; }
        setFormError([]);
        setLoading(true);

        try {
            const otp = generateOtp();
            storeOtp(otp); //Store in memory, not in URL
            await sendOtp(email, otp);
            router.push({
                pathname: "/otp_verification",
                params: { email, password },
            });
        } catch (e) {
            setFormError(["Failed to send OTP. Please check your email and try again."]);
        } finally {
            setLoading(false);
        }
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
                    <Text style={styles.title}>Hello There</Text>

                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Full Name"
                            placeholderTextColor={PLACEHOLDER}
                            value={fullName}
                            onChangeText={setFullName}
                        />
                        <Ionicons name="person-outline" size={18} color={TEAL} />
                    </View>

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
                            <Ionicons name={showPass ? "eye-outline" : "eye-off-outline"} size={18} color={TEAL} />
                        </TouchableOpacity>
                    </View>

                    {formError.length > 0 && (
                        <View style={styles.errorBox}>
                            {formError.map((e, i) => (
                                <Text key={i} style={styles.errorText}>• {e}</Text>
                            ))}
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.signUpButton, loading && { opacity: 0.6 }]}
                        onPress={signUp}
                        disabled={loading}
                    >
                        <Text style={styles.signUpButtonText}>
                            {loading ? "SENDING OTP..." : "SIGN UP"}
                        </Text>
                    </TouchableOpacity>

                    <Text style={styles.loginText}>
                        Already have an account?{" "}
                        <Text style={styles.loginButton} onPress={() => router.replace("/login")}>
                            Sign In
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
        alignItems: "center", gap: 4
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
        fontSize: 12,
        marginBottom: 2
    },
    signUpButton: {
        width: "100%",
        backgroundColor: TEAL,
        borderRadius: 25,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 20,
        marginTop: 8
    },
    signUpButtonText: {
        color: WHITE,
        fontWeight: "700",
        fontSize: 15,
        letterSpacing: 1
    },
    loginText: {
        fontSize: 14,
        color: TEXT_LIGHT,
        marginBottom: 30
    },
    loginButton: {
        color: TEAL,
        fontWeight: "600"
    },
});