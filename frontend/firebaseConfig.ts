import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// @ts-ignore: getReactNativePersistence exists in the RN bundle but is missing from TS types
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from 'expo-constants';
import { getReactNativePersistence, initializeAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseKey,
  authDomain: "pawplan-355c0.firebaseapp.com",
  projectId: "pawplan-355c0",
  storageBucket: "pawplan-355c0.firebasestorage.app",
  messagingSenderId: "717520968402",
  appId: "1:717520968402:web:132eb5f7cf269533d42b0b",
  measurementId: "G-N4XGRLTWG7"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);

console.log("Firebase Connected");