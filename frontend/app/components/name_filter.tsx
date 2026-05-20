import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const TEAL = "#47D9D7";

export default function NameFilter({ entry, setEntry, variable }: { entry: any[], setEntry: (v: any[]) => void, variable: string }) {
    const sortAZ = () => {
        const sorted = [...entry].sort((a, b) => a[variable].localeCompare(b[variable]));
        setEntry(sorted);
    };

    const sortZA = () => {
        const sorted = [...entry].sort((a, b) => b[variable].localeCompare(a[variable]));
        setEntry(sorted);
    };

    return (
        <View style={styles.row}>
            <TouchableOpacity style={styles.button} onPress={sortAZ} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="sort-alphabetical-ascending" size={26} color={TEAL} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={sortZA} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="sort-alphabetical-descending" size={26} color={TEAL} />
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