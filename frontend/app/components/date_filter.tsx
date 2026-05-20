import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const TEAL = "#47D9D7";

export default function DateFilter({ entry, setEntry, variable }: { entry: any[], setEntry: (v: any[]) => void, variable: string }) {
    const sortByNewest = () => {
        const sorted = [...entry].sort((a, b) => b[variable].toMillis() - a[variable].toMillis());
        setEntry(sorted);
    };

    const sortByOldest = () => {
        const sorted = [...entry].sort((a, b) => a[variable].toMillis() - b[variable].toMillis());
        setEntry(sorted);
    };

    return (
        <View style={styles.row}>
            <TouchableOpacity style={styles.button} onPress={sortByNewest} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="arrow-up-circle-outline" size={26} color={TEAL} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={sortByOldest} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="arrow-down-circle-outline" size={26} color={TEAL} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 4,
    },
    button: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});