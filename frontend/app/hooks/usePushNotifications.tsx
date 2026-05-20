import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { registerForPushNotificationsAsync } from '../utils/pushNotification';

export function useVaccineNotifications(userId: string | null | undefined) {
    const [expoPushToken, setExpoPushToken] = useState<string>('');
    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);
    const appState = useRef<AppStateStatus>(AppState.currentState);
    const router = useRouter();

    useEffect(() => {
        registerForPushNotificationsAsync()
            .then((token) => { if (token) setExpoPushToken(token); })
            .catch(console.error);

        notificationListener.current = Notifications.addNotificationReceivedListener(
            (notification) => {
                console.log('[Notification received]', notification.request.content.title);
            }
        );

        responseListener.current = Notifications.addNotificationResponseReceivedListener(
            (response) => {
                const data = response.notification.request.content.data as {
                    petName: string;
                    vaccinationName: string;
                    daysLeft: number;
                };

                console.log(`[Notification tapped] ${data.petName} – ${data.vaccinationName}`);

                router.push('/(tabs)/records');
            }
        );

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, []);

    useEffect(() => {
        if (!userId) return;

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (
                appState.current.match(/inactive|background/) &&
                nextState === 'active'
            ) {
                console.log('[App resumed]');
            }
            appState.current = nextState;
        });

        return () => subscription.remove();
    }, [userId]);

    return { expoPushToken };
}