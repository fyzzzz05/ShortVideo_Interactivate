/**
 * 短剧互动播放器 — App 入口。
 *
 * 竖屏锁定、全屏沉浸、SafeArea 适配。
 */

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PlayerScreen from './src/components/PlayerScreen';

export default function App() {
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = globalThis.document;
    if (!doc) return;
    const styleId = 'shortvideo-web-fullscreen';
    if (doc.getElementById(styleId)) return;
    const style = doc.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body, #root {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #000;
      }
      #root > div {
        min-height: 100%;
      }
    `;
    doc.head.appendChild(style);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar hidden />
        <PlayerScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});
