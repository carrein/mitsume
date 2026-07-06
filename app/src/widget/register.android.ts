// Android side of the platform split: hook the agenda task handler into the
// widget lifecycle at bundle load (imported from app/index.ts).
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
