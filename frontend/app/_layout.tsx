import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import '../firebaseConfig';
import { AuthProvider, useAuth } from './context/authContext';
import { PetProvider, usePet } from './context/petContext';
import { useVaccineNotifications } from './hooks/usePushNotifications';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    MontserratNormal: require('../assets/fonts/Montserrat-VariableFont_wght.ttf'),
    MontserratItalic: require('../assets/fonts/Montserrat-Italic-VariableFont_wght.ttf'),
    ...FontAwesome.font,
  });

  const [navReady, setNavReady] = useState(false);

  useEffect(() => {
    const clearNavState = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const navKeys = keys.filter(k =>
          k.includes('ROUTER') ||
          k.includes('Navigation') ||
          k.includes('expo-router') ||
          k.includes('EXPO_ROUTER')
        );
        if (navKeys.length > 0) {
          await AsyncStorage.multiRemove(navKeys);
        }
      } catch (e) {
        console.warn('Failed to clear nav state:', e);
      } finally {
        setNavReady(true);
      }
    };
    clearNavState();
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded || !navReady) return null;

  return (
    <AuthProvider>
      <PetProvider>
        <RootLayoutNav />
      </PetProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const { selectedPetId, petLoading } = usePet();
  const router = useRouter();

  useVaccineNotifications(user?.uid ?? null);

  useEffect(() => {
    const onBackPress = () => {
      if (user) return true;
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [user]);

useEffect(() => {
  if (loading || petLoading) return;
  if (!user) {
    router.dismissAll();
    router.replace('/root');
  } else if (!selectedPetId) {
    router.dismissAll();
    router.replace('/select_pet');
  } else {
    router.dismissAll();
    router.replace('/(tabs)/home');
  }
}, [loading, petLoading, user, selectedPetId]);

  if (loading || petLoading) return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="root" options={{ gestureEnabled: false }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="pet_profile_creation" />
      <Stack.Screen name="select_pet" options={{ gestureEnabled: false }} />
    </Stack>
  );
}