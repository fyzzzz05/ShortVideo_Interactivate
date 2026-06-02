/**
 * 剧集列表 — 本地数据源。
 * 视频文件位于 shortvedio/nvpin/ 目录下。
 * 将来切换为从后端 GET /api/v1/dramas 加载。
 */

import { Episode } from './types';

export const EPISODES: Episode[] = [
  { id: 5,  title: '第5集',  video: require('../../shortvedio/nvpin/第5集.mp4'),  duration: '2:31' },
  { id: 6,  title: '第6集',  video: require('../../shortvedio/nvpin/第6集.mp4'),  duration: '2:15' },
  { id: 7,  title: '第7集',  video: require('../../shortvedio/nvpin/第7集.mp4'),  duration: '2:20' },
  { id: 8,  title: '第8集',  video: require('../../shortvedio/nvpin/第8集.mp4'),  duration: '2:10' },
  { id: 9,  title: '第9集',  video: require('../../shortvedio/nvpin/第9集.mp4'),  duration: '2:25' },
  { id: 10, title: '第10集', video: require('../../shortvedio/nvpin/第10集.mp4'), duration: '2:18' },
  { id: 11, title: '第11集', video: require('../../shortvedio/nvpin/第11集.mp4'), duration: '2:22' },
  { id: 12, title: '第12集', video: require('../../shortvedio/nvpin/第12集.mp4'), duration: '2:30' },
  { id: 13, title: '第13集', video: require('../../shortvedio/nvpin/第13集.mp4'), duration: '2:28' },
  { id: 14, title: '第14集', video: require('../../shortvedio/nvpin/第14集.mp4'), duration: '2:35' },
  { id: 15, title: '第15集', video: require('../../shortvedio/nvpin/第15集.mp4'), duration: '2:20' },
];
