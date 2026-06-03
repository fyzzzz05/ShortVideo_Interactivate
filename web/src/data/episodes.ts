import type { Episode, HighlightEvent, DanmakuItem } from '../types';

export const EPISODES: Episode[] = [
  {
    id: 5, title: '惩治假千金',
    author: '逆袭女王',
    description: '假千金冒充真千金多年，今天终于现出原形！女主霸气反击，全场震惊。',
    tags: ['复仇', '女强', '打脸', '逆袭'],
    src: '/nvpin/第5集.mp4',
    stats: { likes: 28430, comments: 6120, saves: 15300 },
  },
  {
    id: 6, title: '正面硬刚',
    author: '逆袭女王',
    description: '女主当着董事会所有人的面揭露阴谋，霸气外露，谁也挡不住！',
    tags: ['商战', '复仇', '爽文'],
    src: '/nvpin/第6集.mp4',
    stats: { likes: 32100, comments: 7890, saves: 19200 },
  },
  {
    id: 7, title: '甜蜜对视',
    author: '逆袭女王',
    description: '男主从天而降，英雄救美的经典场景，两人对视的瞬间全场撒糖！',
    tags: ['甜宠', 'CP', '高糖'],
    src: '/nvpin/第7集.mp4',
    stats: { likes: 45600, comments: 9800, saves: 22100 },
  },
];

export const HIGHLIGHTS: HighlightEvent[] = [
  // 第5集 — 复仇打脸
  { id: 'hl_5_1', time: 5,  type: 'slap_effect', emoji: '👋', label: '扇他！',  leftBtn: '👋 耳光',  rightBtn: '💥 暴击',
    facePosition: { x: 0.5, y: 0.38, width: 0.28, height: 0.34 }, faceIndex: 0 },
  { id: 'hl_5_2', time: 18, type: 'reverse',  emoji: '⚡', label: '反转来了！', leftBtn: '😱 震惊',  rightBtn: '👏 解气' },
  // 第6集 — 正面硬刚
  { id: 'hl_6_1', time: 6,  type: 'slap_effect', emoji: '👋', label: '打脸！',  leftBtn: '👋 扇',    rightBtn: '🔥 暴击',
    facePosition: { x: 0.48, y: 0.40, width: 0.30, height: 0.35 }, faceIndex: 0 },
  // 第7集 — 甜宠
  { id: 'hl_7_1', time: 8,  type: 'sweet',    emoji: '💕', label: '嗑到了！',  leftBtn: '❤️ 打call', rightBtn: '🎉 祝福' },
  { id: 'hl_7_2', time: 25, type: 'funny',    emoji: '😂', label: '笑死了！',  leftBtn: '🤣 哈哈哈', rightBtn: '💀 笑不活了' },
];

export const DANMAKU: DanmakuItem[] = [
  { id: 'd1', text: '爽文照进现实！！！', track: 0, speed: 80, startTime: 2 },
  { id: 'd2', text: '啊啊啊啊啊上头', track: 1, speed: 85, startTime: 3 },
  { id: 'd3', text: '这演技绝了', track: 2, speed: 75, startTime: 4 },
  { id: 'd4', text: '建议反复观看', track: 3, speed: 80, startTime: 5 },
  { id: 'd5', text: '女主yyds', track: 0, speed: 90, startTime: 6 },
  { id: 'd6', text: '哈哈哈笑死我了', track: 1, speed: 70, startTime: 7 },
  { id: 'd7', text: '太甜了救命', track: 2, speed: 85, startTime: 8 },
  { id: 'd8', text: '前方高能预警', track: 3, speed: 80, startTime: 9 },
  { id: 'd9', text: '拳头硬了', track: 0, speed: 78, startTime: 10 },
  { id: 'd10', text: '哭死我了呜呜呜', track: 1, speed: 82, startTime: 12 },
  { id: 'd11', text: '原来是这样！', track: 2, speed: 76, startTime: 14 },
  { id: 'd12', text: '霸气侧漏', track: 3, speed: 80, startTime: 16 },
  { id: 'd13', text: 'kswl kswl', track: 0, speed: 88, startTime: 18 },
  { id: 'd14', text: '看得我热血沸腾', track: 1, speed: 80, startTime: 20 },
  { id: 'd15', text: '再来亿遍', track: 2, speed: 75, startTime: 22 },
];
