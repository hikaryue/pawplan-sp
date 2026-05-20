import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

const TEAL = "#47D9D7";
const SEARCH_CONTAINER = "#FFFFFF";
const SEARCH_INPUT = "000000";
const EMPTY_INPUT = "#666666";

type SearchProps<T> = {
    DATA: T[];
    searchKey: keyof T;
    renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement | null;
};

function Search<T extends { id?: string }>({ DATA, searchKey, renderItem }: SearchProps<T>) {
    const [data, setData] = React.useState<T[]>(DATA);
    const [searchValue, setSearchValue] = React.useState('');

    const arrayholder = React.useRef<T[]>(DATA);

    React.useEffect(() => {
        setData(DATA);
        arrayholder.current = DATA;
    }, [DATA]);

    const searchFunction = (text: string) => {
        const query = text.toUpperCase();
        const updatedData = arrayholder.current.filter((item) => {
            const value = item[searchKey];
            if (value == null) return false;
            return String(value).toUpperCase().includes(query);
        });
        setData(updatedData);
        setSearchValue(text);
    };

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={18} color={TEAL} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search..."
                    value={searchValue}
                    onChangeText={searchFunction}
                    placeholderTextColor="#aaa"
                />
            </View>

            <FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={(item, index) => item.id || String(index)}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    searchValue ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No results found</Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 25,
        marginHorizontal: 16,
        marginVertical: 8,
        borderWidth: 1.5,
        borderColor: TEAL,
        backgroundColor: SEARCH_CONTAINER,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 6,
    },
    searchInput: {
        flex: 1,
        height: 40,
        fontSize: 15,
        color: SEARCH_INPUT,
    },
    listContent: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: EMPTY_INPUT,
    },
});

export default Search;