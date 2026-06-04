/**
 * safeHaptic — 安全触觉反馈包装器。
 * expo-haptics 在 web 端不可用，此工具在所有平台安全调用。
 * web 端静默降级（无效果），不抛异常。
 */

import { Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _Haptics: any = null;
try {
  _Haptics = require('expo-haptics');
} catch {
  // web fallback
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'error';

/** 安全调用触觉反馈；web 端无效果 */
export function safeHaptic(style: HapticStyle): void {
  if (!_Haptics || Platform.OS === 'web') return;
  try {
    if (style === 'error') {
      _Haptics.notificationAsync(_Haptics.NotificationFeedbackType.Error);
      return;
    }
    const map = {
      light: _Haptics.ImpactFeedbackStyle.Light,
      medium: _Haptics.ImpactFeedbackStyle.Medium,
      heavy: _Haptics.ImpactFeedbackStyle.Heavy,
    };
    _Haptics.impactAsync(map[style]);
  } catch {
    // 静默降级
  }
}
