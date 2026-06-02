/**
 * 短剧互动播放器 — App 入口。
 *
 * 竖屏锁定、全屏沉浸、SafeArea 适配。
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PlayerScreen from './src/components/PlayerScreen';

export default function App() {
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
    backgroundColor: '#000',
  },
});
