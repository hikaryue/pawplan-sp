import { db } from '@/firebaseConfig';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { Platform } from 'react-native';

//Objects interface

interface PetProfile {
    id: string;
    uid: string;
    name: string;
}

interface VaccinationRecord {
    id: string;
    uid: string;
    pet_id: string;
    vaccination_name: string;
}

interface VaccineEntry {
    id: string;
    next_date: Timestamp | Date | string;
    status: string;
    clinic: string;
}

Notifications.setNotificationHandler({
    handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('vaccine-reminders', {
            name: 'Vaccine Reminders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'default',
        });
    }

    if (!Device.isDevice) {
        console.warn('Push notifications require a physical device.');
        return undefined;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('Permission not granted to get push token for push notification!.');
        return undefined;
    }

    const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

    if (!projectId) {
        throw new Error('Project ID not found');
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log('[Notifications] Push token:', token);
        return token;
}

//Fetches data from user
async function fetchPetsForUser(userId: string) {
    const snap = await getDocs(query(collection(db, 'pet_profile'), where('uid', '==', userId)));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PetProfile));
}

//Fetches vaccination records for pet
async function fetchVaccinationRecordsForPet(userId: string, petId: string) {
    const snap = await getDocs(query(collection(db, 'vaccination_records'), where('uid', '==', userId),where('pet_id', '==', petId)));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VaccinationRecord));
}

//Fetch vaccine entries per record
async function fetchVaccineEntries(recordId: string) {
    const snap = await getDocs(collection(db, 'vaccination_records', recordId, 'vaccine_entries'));
    return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as VaccineEntry));
}

//Converts to Date Object for comparison
function toJsDate(value: Timestamp | Date | string | any): Date {
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;

    return new Date(value);
}

//Solves how many left between current date today and next date
//Converts the date to midnight time
function getDaysLeft(nextDate: Date): number {
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetMidnight = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
    return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

//Notification Hour = 0
const REMINDER_DAYS_BEFORE = [0, 1, 3, 7];
const NOTIFICATION_HOUR = 0;

//Schedules the reminder
async function scheduleVaccineReminder(petName: string, vaccinationName: string, clinic: string, nextDate: Date, daysLeftAtTrigger: number, triggerDateParam: Date) {
    let body: string;
    
    const title = `💉 ${vaccinationName} Reminder`;

    //Checks days left before trigger and add corresponding body
    if (daysLeftAtTrigger === 0) {
        body = `${petName}'s ${vaccinationName} vaccination is due TODAY at ${clinic}!`;
    } else if (daysLeftAtTrigger === 1) {
        body = `${petName}'s ${vaccinationName} vaccination is due TOMORROW! at ${clinic}!`;
    } else {
        body = `${petName}'s ${vaccinationName} is due in ${daysLeftAtTrigger} days at ${clinic}.`;
    }

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: 'default',
            data: {
                petName,
                vaccinationName,
                daysLeft: daysLeftAtTrigger,
                nextDate: nextDate.toISOString(),
            },
            ...(Platform.OS === 'android' && { channelId: 'vaccine-reminders' }),
        },

        //Tells when to trigger
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDateParam,
        },
    });
    return id;
}

//Previous scheduleAllVaccinations
export async function scheduleSingleVaccineEntry(petName: string, vaccinationName: string, clinic: string, nextDate: Date): Promise<string[]> {
    const ids: string[] = [];

    const REMINDER_DAYS_BEFORE = [0, 1, 3, 7];
    const NOTIFICATION_HOUR = 0;

    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const targetMidnight = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());

    const daysLeft = Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return ids;

    let hasImmediateFired = false; //Prevents duplicates for vaccines due TODAY

    for (const daysBefore of REMINDER_DAYS_BEFORE) {
        if (daysBefore > daysLeft) continue;

        const triggerDate = new Date(nextDate);
        triggerDate.setDate(triggerDate.getDate() - daysBefore);
        triggerDate.setHours(NOTIFICATION_HOUR, 0, 0, 0);

        const now = new Date();

        if (triggerDate.getTime() <= now.getTime()) {

        const isToday =
            triggerDate.getFullYear() === now.getFullYear() &&
            triggerDate.getMonth() === now.getMonth() &&
            triggerDate.getDate() === now.getDate();

        if (!isToday) continue;

        //Only allow one notification for TODAY
        if (hasImmediateFired) continue;

        triggerDate.setTime(Date.now() + 5000);
        hasImmediateFired = true;
        }

        const id = await scheduleVaccineReminder(petName, vaccinationName, clinic, nextDate, daysBefore, triggerDate);

        ids.push(id);
    }

    return ids;
}