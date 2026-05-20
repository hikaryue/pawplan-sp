import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';

const TEAL = '#47D9D7';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

function HeaderTitle({ icon, title }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={22} color={TEAL} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#111' }}>{title}</Text>
    </View>
  );
}

function BackButton({ to }: { to: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.replace(to)} style={{ marginLeft: 12 }}>
      <Ionicons name="arrow-back" size={24} color={TEAL} />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TEAL,
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: { backgroundColor: '#FFFFFF' },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          headerTitle: () => <HeaderTitle icon="home-outline" title="HOME" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          tabBarLabel: 'HOME',
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          headerTitle: () => <HeaderTitle icon="document-text-outline" title="RECORDS" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="file-text-o" color={color} />,
          tabBarLabel: 'RECORDS',
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="meal"
        options={{
          headerTitle: () => <HeaderTitle icon="restaurant-outline" title="MEAL" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="cutlery" color={color} />,
          tabBarLabel: 'MEAL',
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          headerTitle: () => <HeaderTitle icon="cloud-upload-outline" title="UPLOAD" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="upload" color={color} />,
          tabBarLabel: 'UPLOAD',
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: () => <HeaderTitle icon="person-outline" title="PROFILE" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          tabBarLabel: 'PROFILE',
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
          name="vaccine_entry"
          options={{
              headerTitle: () => <HeaderTitle icon="fitness-outline" title="VACCINE ENTRY" />,
              headerLeft: () => <BackButton to="/(tabs)/records" />,
              href: null,
              tabBarItemStyle: { display: "none" },
              tabBarStyle: { display: "none" },
          }}
      />
      <Tabs.Screen
          name="document_entry"
          options={{
              headerTitle: () => <HeaderTitle icon="document-outline" title="DOCUMENT DETAILS" />,
              headerLeft: () => <BackButton to="/(tabs)/upload" />,
              href: null,
              tabBarItemStyle: { display: "none" },
              tabBarStyle: { display: "none" },
          }}
      />
      <Tabs.Screen
          name="meal_plan_details"
          options={{
              headerTitle: () => <HeaderTitle icon="restaurant-outline" title="MEAL PLAN DETAILS" />,
              headerLeft: () => <BackButton to="/(tabs)/meal" />,
              href: null,
              tabBarItemStyle: { display: "none" },
              tabBarStyle: { display: "none" },
          }}
      />
      <Tabs.Screen
          name="favorites"
          options={{
              headerTitle: () => <HeaderTitle icon="heart-outline" title="FAVORITE MEAL PLANS" />,
              headerLeft: () => <BackButton to="/(tabs)/meal" />,
              href: null,
              tabBarItemStyle: { display: "none" },
              tabBarStyle: { display: "none" },
          }}
      />
      <Tabs.Screen
          name="add_custom_food"
          options={{
              headerTitle: () => <HeaderTitle icon="add-circle-outline" title="ADD CUSTOM FOOD" />,
              headerLeft: () => <BackButton to="/(tabs)/meal" />,
              href: null,
              tabBarItemStyle: { display: "none" },
              tabBarStyle: { display: "none" },
          }}
      />
      <Tabs.Screen
          name="view_custom_food"
          options={{
              headerTitle: () => <HeaderTitle icon="list-outline" title="CUSTOM FOODS" />,
              headerLeft: () => <BackButton to="/(tabs)/meal" />,
              href: null,
              tabBarItemStyle: { display: "none" },
              tabBarStyle: { display: "none" },
          }}
      />
    </Tabs>
  );
}