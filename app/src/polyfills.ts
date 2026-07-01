// Import FIRST, before any tsdav import (see src/app/_layout.tsx). Hermes (React
// Native) lacks btoa/atob and a reliable TextEncoder/TextDecoder, which tsdav needs
// (Basic-auth base64 + XML handling). On web these globals already exist, so the
// assignments below are guarded no-ops.
import { decode as atobPolyfill, encode as btoaPolyfill } from 'base-64';
import {
  TextDecoder as TextDecoderPolyfill,
  TextEncoder as TextEncoderPolyfill,
} from 'text-encoding';

const g = globalThis as Record<string, unknown>;

if (typeof g.btoa === 'undefined') g.btoa = btoaPolyfill;
if (typeof g.atob === 'undefined') g.atob = atobPolyfill;
if (typeof g.TextEncoder === 'undefined') g.TextEncoder = TextEncoderPolyfill;
if (typeof g.TextDecoder === 'undefined') g.TextDecoder = TextDecoderPolyfill;
