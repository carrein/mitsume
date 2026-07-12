// react-native-android-widget calls these components as raw functions (no React
// renderer), so the React Compiler's memo-cache hooks crash them at runtime.
'use no memo';

// JSX tree for the Android home-screen agenda — react-native-android-widget
// primitives (not RN views), rendered headlessly by the task handler. The
// light/dark pair lets the launcher pick the palette that matches the system.
import type { ReactNode } from 'react';
import type { WidgetRepresentation } from 'react-native-android-widget';
import {
  FlexWidget,
  ListWidget,
  SvgWidget,
  TextWidget,
} from 'react-native-android-widget';

import { davConfigured } from '@/config';
import {
  AddOutlineBody,
  RefreshOutlineBody,
  SunOutlineBody,
} from '@/constants/icon-paths';
import {
  AccentColor,
  Colors,
  FontFamily,
  FontFamilyBold,
  OnAccentColor,
  type ThemeColor,
} from '@/constants/theme';
import { toTimeString } from '@/utils/date';

import { groupByDay, headerDate, type WidgetDayItem } from './format';
import type { WidgetCache } from './types';

type Palette = Record<ThemeColor, string>;

/** Theme colors are plain strings; widget ColorProp wants a hex template type. */
const hex = (c: string) => c as `#${string}`;

// Basil icons (https://icon-sets.iconify.design/basil/) — the app's icon set,
// rendered via SvgWidget. The in-app screens render the same add / refresh glyphs
// via components/icons.tsx; shared 24x24 path data lives in constants/icon-paths.
// Basil bodies are fill-based, so we swap `currentColor` for the actual color.
const basilSvg = (fill: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body.replace(/currentColor/g, fill)}</svg>`;
const ADD_ICON = basilSvg(OnAccentColor, AddOutlineBody);
const REFRESH_ICON = basilSvg(OnAccentColor, RefreshOutlineBody);
const SUN_ICON = basilSvg(AccentColor, SunOutlineBody);

/** Heading that opens a day group, e.g. 'Mon 13 July'. */
function DayHeader({ label, palette }: { label: string; palette: Palette }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: hex(palette.backgroundSelected),
      }}
    >
      <TextWidget
        text={label}
        style={{
          fontSize: 12,
          fontFamily: FontFamilyBold,
          color: hex(AccentColor),
        }}
      />
    </FlexWidget>
  );
}

/**
 * One event's row for a given day; tapping deep-links the app to that day. A
 * multi-day event shows a dim `(n/N)` marker and, on continuation days, renders
 * like an all-day row (sun glyph, no time — it owns the whole day).
 */
function EventRow({
  item,
  day,
  palette,
}: {
  item: WidgetDayItem;
  day: string;
  palette: Palette;
}) {
  const { event, dayIndex, spanDays } = item;
  const multiDay = spanDays > 1;
  const asAllDay = event.allDay || dayIndex > 1;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `app:///?day=${day}` }}
      style={{
        width: 'match_parent',
        flexDirection: 'column',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        {asAllDay ? (
          <SvgWidget
            svg={SUN_ICON}
            style={{ width: 14, height: 14, marginRight: 8 }}
          />
        ) : (
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextWidget
              text={toTimeString(new Date(event.start))}
              style={{
                fontSize: 13,
                fontFamily: FontFamily,
                color: hex(palette.text),
              }}
            />
            <TextWidget
              text="•"
              style={{
                fontSize: 13,
                fontFamily: FontFamily,
                color: hex(palette.text),
                marginHorizontal: 6,
              }}
            />
          </FlexWidget>
        )}
        <FlexWidget style={{ flex: 1 }}>
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
        </FlexWidget>
        {multiDay ? (
          <TextWidget
            text={`(${dayIndex}/${spanDays})`}
            style={{
              fontSize: 12,
              fontFamily: FontFamily,
              color: hex(palette.textSecondary),
              marginLeft: 6,
            }}
          />
        ) : null}
      </FlexWidget>
      {event.location && dayIndex === 1 ? (
        <TextWidget
          text={event.location}
          maxLines={1}
          truncate="END"
          style={{
            fontSize: 11,
            fontFamily: FontFamily,
            color: hex(palette.text),
          }}
        />
      ) : null}
    </FlexWidget>
  );
}

/**
 * Wraps a single day's events (one list item, so they scroll together). Style
 * this to control spacing around / between a day's events — add `flexGap` for
 * the gap between events, or `padding*` for room around the group.
 */
function EventsWrapper({ children }: { children: ReactNode }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'column',
        paddingTop: 4,
        paddingBottom: 8,
        flexGap: 4,
      }}
    >
      {children}
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
        <EventsWrapper key={`e:${group.day}`}>
          {group.items.map((item) => (
            <EventRow
              key={`${item.event.start}:${item.event.summary}:${group.day}`}
              item={item}
              day={group.day}
              palette={palette}
            />
          ))}
        </EventsWrapper>,
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
  const onAccent = hex(OnAccentColor);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        borderRadius: 4,
        backgroundColor: hex(palette.background),
      }}
    >
      {/* Orange header bar: date + freshness stacked left, add/refresh vertically centered right */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: hex(AccentColor),
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget
            text={headerDate(now)}
            style={{
              fontSize: 20,
              fontFamily: FontFamilyBold,
              color: onAccent,
            }}
          />
          {cache ? (
            <TextWidget
              text={`Last Updated: ${toTimeString(new Date(cache.fetchedAt))}`}
              style={{
                fontSize: 12,
                fontFamily: FontFamily,
                color: onAccent,
                marginTop: 0,
              }}
            />
          ) : null}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: `app:///?new=${now.getTime()}` }}
            style={{ padding: 6 }}
            accessibilityLabel="Add event"
          >
            <SvgWidget svg={ADD_ICON} style={{ width: 28, height: 28 }} />
          </FlexWidget>
          <FlexWidget
            clickAction="REFRESH"
            style={{ padding: 6, marginLeft: 6 }}
            accessibilityLabel="Refresh events"
          >
            <SvgWidget svg={REFRESH_ICON} style={{ width: 28, height: 28 }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
      <FlexWidget
        style={{
          width: 'match_parent',
          flex: 1,
          paddingHorizontal: 16,
          paddingVertical: 10,
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
