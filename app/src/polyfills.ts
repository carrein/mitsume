// Import FIRST, before any tsdav import (see src/app/_layout.tsx). Hermes (React
// Native) lacks btoa/atob and a reliable TextEncoder/TextDecoder, which tsdav needs
// (Basic-auth base64 + XML handling). On web these globals already exist, so the
// assignments below are guarded no-ops.
import { decode as atobPolyfill, encode as btoaPolyfill } from 'base-64';
import { getRandomValues } from 'expo-crypto';
import {
  TextDecoder as TextDecoderPolyfill,
  TextEncoder as TextEncoderPolyfill,
} from 'text-encoding';

const g = globalThis as Record<string, unknown>;

if (typeof g.btoa === 'undefined') g.btoa = btoaPolyfill;
if (typeof g.atob === 'undefined') g.atob = atobPolyfill;
if (typeof g.TextEncoder === 'undefined') g.TextEncoder = TextEncoderPolyfill;
if (typeof g.TextDecoder === 'undefined') g.TextDecoder = TextDecoderPolyfill;

// yjs (via lib0) wants crypto.getRandomValues for collision-resistant client
// ids and falls back to Math.random without it; Hermes has no global crypto.
// expo-crypto's implementation is synchronous, so it slots straight in.
const cryptoLike = (g.crypto ?? (g.crypto = {})) as Record<string, unknown>;
if (typeof cryptoLike.getRandomValues === 'undefined')
  cryptoLike.getRandomValues = getRandomValues;
