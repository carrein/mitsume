import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AddIcon, CanvasIcon } from '@/components/icons';
import { ThemedView } from '@/components/themed-view';
import { AccentColor, OnAccentColor, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { CanvasMeta } from '@/notes/types';

const BUTTON_SIZE = 40;
const ICON_SIZE = 22;

/**
 * Narrow strip on the left of the notes pane: one circular icon button per
 * canvas (the active one filled with the accent color, per the reference
 * design), plus + at the end to create a new canvas via the icon picker.
 */
export function CanvasBar({
  canvases,
  activeId,
  onSelect,
  onAdd,
}: {
  canvases: CanvasMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.bar}>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {canvases.map((canvas) => {
          const active = canvas.id === activeId;
          return (
            <Pressable
              key={canvas.id}
              onPress={() => onSelect(canvas.id)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View
                style={[
                  styles.button,
                  {
                    backgroundColor: active ? AccentColor : 'transparent',
                    borderColor: active ? AccentColor : theme.textSecondary,
                  },
                ]}
              >
                <CanvasIcon
                  name={canvas.icon}
                  size={ICON_SIZE}
                  color={active ? OnAccentColor : theme.textSecondary}
                />
              </View>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View
            style={[styles.button, { borderColor: theme.backgroundSelected }]}
          >
            <AddIcon size={ICON_SIZE} color={theme.textSecondary} />
          </View>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 56,
  },
  list: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    // Circular per the CanvasBar reference design (an intentional exception
    // to the app's 4px radius convention).
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
