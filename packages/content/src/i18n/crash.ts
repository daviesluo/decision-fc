/**
 * The crash screen, in both languages, in its own module.
 *
 * Every other string lives in a dictionary that is fetched on demand — one
 * locale per player, which is most of what keeps the download small. These four
 * cannot be: they are read by the React error boundary, which renders when
 * something has already gone wrong, outside every provider, with no chance to
 * await anything. Six hundred bytes shipped to everyone is the right price for a
 * crash screen that is never in the wrong language.
 */
export const CRASH = {
  en: {
    title: 'Something broke',
    body: 'The game hit a problem it could not recover from. Reloading usually fixes it. If it happens again straight away, the saved career itself is the problem and discarding it will clear it.',
    reload: 'Reload',
    discard: 'Discard this career',
  },
  zh: {
    title: '出问题了',
    body: '游戏遇到了无法恢复的问题。刷新一般就能解决；如果刷新后马上又出现，说明问题出在存档本身，放弃这段生涯即可清除。',
    reload: '刷新',
    discard: '放弃这段生涯',
  },
} as const;
