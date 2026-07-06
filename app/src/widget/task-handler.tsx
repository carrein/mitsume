// Headless entry for widget lifecycle events. Polyfills are guaranteed by
// app/index.ts (imported before the register module that pulls this in).
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { renderAgenda } from './agenda';
import { readWidgetCache } from './cache';
import { loadAgendaCache } from './load';

export async function widgetTaskHandler(
  props: WidgetTaskHandlerProps
): Promise<void> {
  switch (props.widgetAction) {
    case 'WIDGET_DELETED':
      return;
    case 'WIDGET_RESIZED':
      // Re-render only — no network on a resize.
      props.renderWidget(renderAgenda(await readWidgetCache()));
      return;
    default:
      // WIDGET_ADDED, WIDGET_UPDATE (30-min cycle), and WIDGET_CLICK — the
      // only custom clickAction is the refresh tap, so every click refetches.
      props.renderWidget(renderAgenda(await loadAgendaCache()));
      return;
  }
}
