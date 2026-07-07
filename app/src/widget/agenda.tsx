// react-native-android-widget calls these components as raw functions (no React
// renderer), so the React Compiler's memo-cache hooks crash them at runtime.
'use no memo';

// JSX tree for the Android home-screen agenda — react-native-android-widget
// primitives (not RN views), rendered headlessly by the task handler. The
// light/dark pair lets the launcher pick the palette that matches the system.
import {
  FlexWidget,
  ListWidget,
  TextWidget,
} from 'react-native-android-widget';
import type { WidgetRepresentation } from 'react-native-android-widget';

import { davConfigured } from '@/config';
import { AccentColor, Colors, type ThemeColor } from '@/constants/theme';
import { toTimeString } from '@/utils/date';

import { formatWhen } from './format';
import type { WidgetCache, WidgetEvent } from './types';

type Palette = Record<ThemeColor, string>;

/** Theme colors are plain strings; widget ColorProp wants a hex template type. */
const hex = (c: string) => c as `#${string}`;

function EventRow({
  event,
  now,
  palette,
}: {
  event: WidgetEvent;
  now: Date;
  palette: Palette;
}) {
  const detail = event.location
    ? `${formatWhen(event, now)} · ${event.location}`
    : formatWhen(event, now);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        flexDirection: 'column',
        borderLeftWidth: 2,
        borderLeftColor: hex(AccentColor),
        paddingLeft: 8,
        paddingVertical: 3,
        marginBottom: 6,
      }}
    >
      <TextWidget
        text={event.summary || '(untitled)'}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 13, color: hex(palette.text) }}
      />
      <TextWidget
        text={detail}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 11, color: hex(palette.textSecondary) }}
      />
    </FlexWidget>
  );
}

function Body({
  cache,
  now,
  palette,
}: {
  cache: WidgetCache | null;
  now: Date;
  palette: Palette;
}) {
  const message = !davConfigured
    ? 'No server URL in this build'
    : !cache
      ? 'Calendar unreachable — tap ↻ on the tailnet'
      : cache.events.length === 0
        ? 'No events in the next 60 days'
        : null;
  if (message) {
    return (
      <TextWidget
        text={message}
        style={{ fontSize: 12, color: hex(palette.textSecondary) }}
      />
    );
  }
  return (
    <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
      {cache!.events.map((event) => (
        <EventRow
          key={`${event.start}:${event.summary}`}
          event={event}
          now={now}
          palette={palette}
        />
      ))}
    </ListWidget>
  );
}

function Agenda({
  cache,
  now,
  palette,
}: {
  cache: WidgetCache | null;
  now: Date;
  palette: Palette;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: hex(palette.background),
        borderRadius: 16,
        padding: 12,
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <TextWidget
          text="Agenda"
          style={{
            fontSize: 14,
            fontWeight: 'bold',
            color: hex(AccentColor),
          }}
        />
        <FlexWidget
          clickAction="REFRESH"
          style={{ padding: 4 }}
          accessibilityLabel="Refresh events"
        >
          <TextWidget
            text={cache ? `↻ ${toTimeString(new Date(cache.fetchedAt))}` : '↻'}
            style={{ fontSize: 12, color: hex(palette.textSecondary) }}
          />
        </FlexWidget>
      </FlexWidget>
      <Body cache={cache} now={now} palette={palette} />
    </FlexWidget>
  );
}

/** Light/dark pair for the launcher; `now` fixed once so both halves agree. */
export function renderAgenda(cache: WidgetCache | null): WidgetRepresentation {
  const now = new Date();
  return {
    light: <Agenda cache={cache} now={now} palette={Colors.light} />,
    dark: <Agenda cache={cache} now={now} palette={Colors.dark} />,
  };
}
