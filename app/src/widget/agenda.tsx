// react-native-android-widget calls these components as raw functions (no React
// renderer), so the React Compiler's memo-cache hooks crash them at runtime.
'use no memo';

// JSX tree for the Android home-screen agenda — react-native-android-widget
// primitives (not RN views), rendered headlessly by the task handler. The
// light/dark pair lets the launcher pick the palette that matches the system.
import {
  FlexWidget,
  ListWidget,
  SvgWidget,
  TextWidget,
} from 'react-native-android-widget';
import type { WidgetRepresentation } from 'react-native-android-widget';

import { davConfigured } from '@/config';
import {
  AccentColor,
  Colors,
  FontFamily,
  FontFamilyBold,
  type ThemeColor,
} from '@/constants/theme';
import { toDateString, toTimeString } from '@/utils/date';

import { groupByDay, headerDate } from './format';
import type { WidgetCache, WidgetEvent } from './types';

type Palette = Record<ThemeColor, string>;

/** Theme colors are plain strings; widget ColorProp wants a hex template type. */
const hex = (c: string) => c as `#${string}`;

// Lucide icons (https://lucide.dev) — the app's icon set. White stroke, one
// identical size via SvgWidget so the two widget icons always match. The app
// renders the same `plus` / `rotate-cw` via lucide-react-native.
const LUCIDE_ATTRS =
  'fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ADD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${LUCIDE_ATTRS}><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
const REFRESH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${LUCIDE_ATTRS}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;

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
          fontFamily: FontFamilyBold,
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
        style={{
          fontSize: 13,
          fontFamily: FontFamily,
          color: hex(palette.text),
        }}
      />
      {event.allDay ? (
        <TextWidget
          text="All day"
          style={{
            fontSize: 11,
            fontFamily: FontFamily,
            color: hex(AccentColor),
          }}
        />
      ) : (
        <TextWidget
          text={toTimeString(new Date(event.start))}
          style={{
            fontSize: 11,
            fontFamily: FontFamily,
            color: hex(palette.textSecondary),
          }}
        />
      )}
      {event.location ? (
        <TextWidget
          text={event.location}
          maxLines={1}
          truncate="END"
          style={{
            fontSize: 11,
            fontFamily: FontFamily,
            color: hex(palette.textSecondary),
          }}
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
        style={{
          fontSize: 12,
          fontFamily: FontFamily,
          color: hex(palette.textSecondary),
        }}
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
  const white = hex('#ffffff');
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        backgroundColor: hex(palette.background),
        borderRadius: 16,
      }}
    >
      {/* Orange header bar: today's date + freshness on the left, add/refresh right */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'column',
          backgroundColor: hex(AccentColor),
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={headerDate(now)}
            style={{ fontSize: 20, fontFamily: FontFamilyBold, color: white }}
          />
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FlexWidget
              clickAction="OPEN_URI"
              clickActionData={{ uri: `app:///?new=${now.getTime()}` }}
              style={{ padding: 4 }}
              accessibilityLabel="Add event"
            >
              <SvgWidget svg={ADD_ICON} style={{ width: 20, height: 20 }} />
            </FlexWidget>
            <FlexWidget
              clickAction="REFRESH"
              style={{ padding: 4 }}
              accessibilityLabel="Refresh events"
            >
              <SvgWidget svg={REFRESH_ICON} style={{ width: 20, height: 20 }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
        {cache ? (
          <TextWidget
            text={`Last Updated: ${toTimeString(new Date(cache.fetchedAt))}`}
            style={{
              fontSize: 10,
              fontFamily: FontFamily,
              color: white,
              marginTop: 2,
            }}
          />
        ) : null}
      </FlexWidget>
      <FlexWidget
        style={{
          width: 'match_parent',
          flex: 1,
          paddingHorizontal: 12,
          paddingTop: 8,
        }}
      >
        <Body cache={cache} now={now} palette={palette} />
      </FlexWidget>
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
