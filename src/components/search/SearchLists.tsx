// Main-card bodies: recent searches, browse categories and the grouped
// typeahead suggestions. Plain Views (short, bounded lists), memoized rows.
import { Image } from "expo-image";
import { memo } from "react";
import { type ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import type { Category, DiscoverySuggestionsResponse } from "../../lib/discovery/types";
import { colors, fontFamily } from "../../theme";
import { Icon, type IconName } from "../ui/Icon";
import { CATEGORY_IMAGES } from "./categoryImages";
import { searchStyles } from "./searchStyles";

const Row = memo(function Row({
  icon,
  image,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
  tile = false,
}: {
  icon: IconName;
  // Full-colour art shown instead of the symbol icon (never tinted).
  image?: ImageSourcePropType;
  title: string;
  subtitle?: string;
  onPress: () => void;
  accessibilityLabel: string;
  tile?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed && searchStyles.pressed]}
    >
      {/* 3D art sits directly on the row (no coloured tile behind it). */}
      <View style={image ? styles.artFrame : tile ? styles.tile : styles.iconPlain}>
        {image ? (
          // Decorative: the row's label already names the category.
          <Image
            source={image}
            style={styles.art}
            contentFit="contain"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : (
          <Icon name={icon} size={tile ? 22 : 18} color={colors.textMuted} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={searchStyles.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

export const RecentSearches = memo(function RecentSearches({
  terms,
  onSelect,
  onClear,
}: {
  terms: string[];
  onSelect: (term: string) => void;
  onClear: () => void;
}) {
  // Hidden entirely for a new customer.
  if (terms.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={searchStyles.sectionTitle} accessibilityRole="header">
          Recent searches
        </Text>
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search history"
          hitSlop={8}
          style={({ pressed }) => pressed && searchStyles.pressed}
        >
          <Text style={searchStyles.linkText}>Clear history</Text>
        </Pressable>
      </View>
      {terms.map((t) => (
        <Row
          key={t.toLowerCase()}
          icon="clock"
          title={t}
          onPress={() => onSelect(t)}
          accessibilityLabel={`Recent search, ${t}`}
        />
      ))}
    </View>
  );
});

export const BrowseCategories = memo(function BrowseCategories({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={[searchStyles.sectionTitle, styles.sectionHeaderText]} accessibilityRole="header">
        Browse categories
      </Text>
      {categories.map((c) => (
        <Row
          key={c.id}
          icon={c.icon}
          image={CATEGORY_IMAGES[c.id]}
          tile
          title={c.label}
          subtitle={c.scope === "food" ? "Food" : "Groceries"}
          onPress={() => onSelect(c.id)}
          accessibilityLabel={`Browse ${c.label}`}
        />
      ))}
    </View>
  );
});

export const SuggestionList = memo(function SuggestionList({
  suggestions,
  onQuery,
  onItem,
  onStore,
}: {
  suggestions: DiscoverySuggestionsResponse;
  onQuery: (text: string) => void;
  onItem: (id: string) => void;
  onStore: (id: string) => void;
}) {
  const { queries, items, stores } = suggestions;
  return (
    <View>
      {queries.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.groupLabel]} accessibilityRole="header">
            Search suggestions
          </Text>
          {queries.map((q) => (
            <Row
              key={q.text}
              icon="search"
              title={q.text}
              onPress={() => onQuery(q.text)}
              accessibilityLabel={`Search for ${q.text}`}
            />
          ))}
        </View>
      ) : null}
      {items.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.groupLabel} accessibilityRole="header">
            Items
          </Text>
          {items.map((i) => (
            <Row
              key={i.item_id}
              icon="orders"
              title={`${i.name} — ${i.vendor_name}`}
              onPress={() => onItem(i.item_id)}
              accessibilityLabel={`Item, ${i.name} from ${i.vendor_name}`}
            />
          ))}
        </View>
      ) : null}
      {stores.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.groupLabel} accessibilityRole="header">
            Stores
          </Text>
          {stores.map((s) => (
            <Row
              key={s.vendor_id}
              icon="store"
              title={s.name}
              onPress={() => onStore(s.vendor_id)}
              accessibilityLabel={`Store, ${s.name}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionHeaderText: {
    marginBottom: 4,
  },
  groupLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 2,
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    // Soft grey (not orange) behind the category art.
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  artFrame: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  art: {
    width: 40,
    height: 40,
  },
  iconPlain: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.text,
  },
});
