import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { selectionHaptic } from "../../lib/haptics";
import { colors, fontFamily } from "../../theme";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon } from "../ui/Icon";
import { filterLanguages } from "./filterLanguages";
import { LanguageRow } from "./LanguageRow";
import { LanguageSearchField } from "./LanguageSearchField";
import { LANGUAGES } from "./languages";

type Props = {
  visible: boolean;
  selectedCode: string;
  onSelect: (code: string) => void;
  onClose: () => void;
};

// Delay between showing the new selection and closing the sheet.
const CLOSE_DELAY_MS = 150;

// "Select Language" sheet. Selecting only reports the code for now.
// TODO(i18n): once expo-localization + an i18n library are added, apply the
// selected language there (and default to the device locale).
export function LanguageSheet({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const titleRef = useRef<Text>(null);
  const [query, setQuery] = useState("");
  const [pendingCode, setPendingCode] = useState(selectedCode);

  // Reset search and selection each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setQuery("");
      setPendingCode(selectedCode);
    }
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const select = (code: string) => {
    if (timer.current) return;
    Keyboard.dismiss();
    selectionHaptic();
    setPendingCode(code);
    timer.current = setTimeout(() => {
      timer.current = null;
      onSelect(code);
      // The user may already have closed the sheet during the delay.
      if (visibleRef.current) onClose();
    }, CLOSE_DELAY_MS);
  };

  const moveFocusToTitle = () => {
    if (titleRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }
  };

  const results = filterLanguages(LANGUAGES, query);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onOpened={moveFocusToTitle}
      header={
        <>
          <View style={styles.headerRow}>
            <Text ref={titleRef} style={styles.title} accessibilityRole="header">
              Select Language
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={6}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Icon
                name="close"
                size={14}
                color={colors.text}
                weight="semibold"
              />
            </Pressable>
          </View>
          <View style={styles.divider} />
        </>
      }
    >
      <View style={styles.search}>
        <LanguageSearchField value={query} onChangeText={setQuery} />
      </View>
      <FlatList
        style={styles.list}
        data={results}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <LanguageRow
            language={item}
            selected={item.code === pendingCode}
            onPress={() => select(item.code)}
          />
        )}
        extraData={pendingCode}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <Text style={styles.empty} accessibilityLiveRegion="polite">
            No languages found
          </Text>
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
    </BottomSheet>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  headerRow: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    color: colors.text,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  search: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  separator: {
    height: 8,
  },
  empty: {
    marginTop: 24,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
