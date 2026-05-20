import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../firebaseConfig";
import { generateOtp, sendOtp } from "./utils/sendOTP";
import { clearOtp, getOtp, storeOtp } from "./utils/storeOTP";

const TEAL = "#47D9D7";
const TEAL_LIGHT = "#D4F1F4";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const TEXT_LIGHT = "#888888";
const ERROR_RED = "#CC0000";
const ERROR_BG = "#FFE5E5";
const BORDER_COLOR = "#CCCCCC";

export default function OtpVerificationScreen() {
    const insets = useSafeAreaInsets();
    const { email, password } = useLocalSearchParams<{ email: string; password: string}>();
    const [otp, setOtp] = React.useState(["", "", "", "", "", ""]);
    const [error, setError] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [resendTimer, setResendTimer] = React.useState(60);
    const inputs = useRef<TextInput[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setResendTimer(t => (t > 0 ? t - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleChange = (text: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = text;
        setOtp(newOtp);
        if (text && index < 5) inputs.current[index + 1]?.focus();
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const verifyOtp = async () => {
        const code = otp.join("");
        if (code.length < 6) { setError("Please enter all 6 digits."); return; }

        const expected = getOtp();
        if (!expected) { setError("OTP has expired. Please request a new one."); return; }
        if (code !== expected) { setError("Invalid OTP. Please try again."); return; }

        clearOtp(); //Clear after use. For one time

        setError("");
        setLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            router.replace("/pet_profile_creation");
        } catch (e: any) {
            if (e.code === "auth/email-already-in-use")
                setError("This email is already registered.");
            else
                setError("Account creation failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const resendOtp = async () => {
        if (resendTimer > 0) return;
        try {
            const newOtp = generateOtp();
            storeOtp(newOtp); //Update with new OTP
            await sendOtp(email, newOtp);
            setOtp(["", "", "", "", "", ""]);
            setResendTimer(60);
            setError("");
            inputs.current[0]?.focus();
        } catch {
            setError("Failed to resend OTP. Please try again.");
        }
    };

    return (
        <View style={styles.root}>
            <View style={[styles.topContainer, { paddingTop: insets.top + 16 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={16} color={WHITE} />
                    <Text style={styles.backText}>BACK</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.card}>
                <View style={styles.content}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="mail-open-outline" size={36} color={TEAL} />
                    </View>

                    <Text style={styles.title}>Verify Email</Text>
                    <Text style={styles.subtitle}>
                        Enter the 6-digit code sent to{"\n"}
                        <Text style={styles.emailText}>{email}</Text>
                    </Text>

                    <View style={styles.otpRow}>
                        {otp.map((digit, i) => (
                            <TextInput
                                key={i}
                                ref={r => { if (r) inputs.current[i] = r; }}
                                style={[styles.otpBox, digit && styles.otpBoxFilled]}
                                value={digit}
                                onChangeText={t => handleChange(t.slice(-1), i)}
                                onKeyPress={e => handleKeyPress(e, i)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                            />
                        ))}
                    </View>

                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity style={[styles.verifyButton, loading && { opacity: 0.6 }]} onPress={verifyOtp} disabled={loading}>
                        <Text style={styles.verifyButtonText}>
                            {loading ? "VERIFYING..." : "VERIFY"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={resendOtp} disabled={resendTimer > 0}>
                        <Text style={[styles.resendText, resendTimer > 0 && { color: TEXT_LIGHT }]}>
                            {resendTimer > 0
                                ? `Resend code in ${resendTimer}s`
                                : "Resend OTP"}
                        </Text>
                    </TouchableOpacity>
                </View>
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
    content: {
        flex: 1, 
        padding: 28, 
        alignItems: "center", 
        paddingTop: 36
    },
    iconCircle: {
        width: 80, 
        height: 80, 
        borderRadius: 40, 
        backgroundColor: TEAL_LIGHT, 
        alignItems: "center", 
        justifyContent: "center", 
        marginBottom: 20
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: BLACK, 
        marginBottom: 10, 
        textAlign: "center"
    },
    subtitle: {
        fontSize: 14, 
        color: TEXT_LIGHT, 
        textAlign: "center", 
        lineHeight: 22, 
        marginBottom: 32
    },
    emailText: {
        color: TEAL, 
        fontWeight: "600" 
    },
    otpRow: {
        flexDirection: "row", 
        gap: 10, marginBottom: 24 
    },
    otpBox: {
        width: 46, 
        height: 56, 
        borderWidth: 1.5, 
        borderColor: BORDER_COLOR, 
        borderRadius: 12, 
        textAlign: "center", 
        fontSize: 22, 
        fontWeight: "700", 
        color: BLACK, 
        backgroundColor: WHITE
    },
    otpBoxFilled: {
        borderColor: TEAL,
        backgroundColor: TEAL_LIGHT
    },
    errorBox: {
        width: "100%",
        backgroundColor: ERROR_BG, 
        borderRadius: 10, 
        padding: 12, 
        marginBottom: 16 
    },
    errorText: {
        color: ERROR_RED, 
        fontSize: 12, 
        textAlign: "center" 
    },
    verifyButton: {
        width: "100%", 
        backgroundColor: TEAL, 
        borderRadius: 25, 
        paddingVertical: 16, 
        alignItems: "center", 
        marginBottom: 20
    },
    verifyButtonText: { 
        color: WHITE, 
        fontWeight: "700",
        fontSize: 15,
        letterSpacing: 1
    },
    resendText: {
        fontSize: 14,
        color: TEAL, 
        fontWeight: "600", 
        marginBottom: 30
    },
});