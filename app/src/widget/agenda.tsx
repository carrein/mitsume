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
import { toDateString, toTimeString } from '@/utils/date';

import { groupByDay } from './format';
import type { WidgetCache, WidgetEvent } from './types';

type Palette = Record<ThemeColor, string>;

/** Theme colors are plain strings; widget ColorProp wants a hex template type. */
const hex = (c: string) => c as `#${string}`;

/** Heading that opens a day group, e.g. 'Mon 13 July'. */
function DayHeader({ label, palette }: { label: string; palette: Palette }) {
  return (
    <FlexWidget
      style={{ width: 'match_parent', paddingTop: 8, paddingBottom: 2 }}
    >
      <TextWidget
        text={label}
        style={{
          fontSize: 12,
          fontWeight: 'bold',
          color: hex(palette.textSecondary),
        }}
      />
    </FlexWidget>
  );
}

/** One event; tapping deep-links the app to this event's day. */
function EventRow({
  event,
  palette,
}: {
  event: WidgetEvent;
  palette: Palette;
}) {
  const day = toDateString(new Date(event.start));
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `app:///?day=${day}` }}
      style={{
        width: 'match_parent',
        flexDirection: 'column',
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
      {event.allDay ? (
        <TextWidget
          text="All day"
          style={{ fontSize: 11, color: hex(AccentColor) }}
        />
      ) : (
        <TextWidget
          text={toTimeString(new Date(event.start))}
          style={{ fontSize: 11, color: hex(palette.textSecondary) }}
        />
      )}
      {event.location ? (
        <TextWidget
          text={event.location}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 11, color: hex(palette.textSecondary) }}
        />
      ) : null}
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
      {groupByDay(cache!.events, now).flatMap((group) => [
        <DayHeader
          key={`h:${group.day}`}
          label={group.header}
          palette={palette}
        />,
        ...group.events.map((event) => (
          <EventRow
            key={`${event.start}:${event.summary}`}
            event={event}
            palette={palette}
          />
        )),
      ])}
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
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <FlexWidget
          clickAction="REFRESH"
          style={{ paddingHorizontal: 6, paddingVertical: 2 }}
          accessibilityLabel="Refresh events"
        >
          <TextWidget
            text="↻"
            style={{ fontSize: 20, color: hex(AccentColor) }}
          />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flex: 1 }}>
        <Body cache={cache} now={now} palette={palette} />
      </FlexWidget>
      {cache ? (
        <TextWidget
          text={`Last Updated: ${toTimeString(new Date(cache.fetchedAt))}`}
          style={{
            fontSize: 10,
            color: hex(palette.textSecondary),
            marginTop: 4,
          }}
        />
      ) : null}
    </FlexWidget>
  );
}

/** Light/dark pair so the launcher can match the system theme; `now` fixed once
 * so both halves and every day header agree. */
export function renderAgenda(cache: WidgetCache | null): WidgetRepresentation {
  const now = new Date();
  return {
    light: <Agenda cache={cache} now={now} palette={Colors.light} />,
    dark: <Agenda cache={cache} now={now} palette={Colors.dark} />,
  };
}
