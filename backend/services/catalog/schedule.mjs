// Linear schedule resolution.
//
// Pure date math, so it lives in deterministic space: a function of
// (items, nowMs, tzOffsetMinutes) and nothing else. The seed's static
// "isCurrent" flag is ignored - a 24/7 channel cannot have a block that is
// permanently on air.

const parseWindow = (time) => {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(String(time).trim());
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  let end = Number(m[3]) * 60 + Number(m[4]);
  if (end <= start) end += 1440; // block crosses midnight
  return { start, end, minutes: end - start };
};

export function resolveSchedule(items, nowMs, tzOffsetMinutes = 0) {
  const parsed = items.map((item) => ({ item, win: parseWindow(item.time) })).filter((p) => p.win);
  if (!parsed.length) return items.map((item) => ({ ...item, isCurrent: false }));

  const minutesOfDay = (((Math.floor(nowMs / 60000) + tzOffsetMinutes) % 1440) + 1440) % 1440;

  // 1. Inside a published window: that block is on air.
  let currentId = null;
  for (const { item, win } of parsed) {
    const inToday = minutesOfDay >= win.start && minutesOfDay < win.end;
    const inWrap = win.end > 1440 && minutesOfDay + 1440 >= win.start && minutesOfDay + 1440 < win.end;
    if (inToday || inWrap) { currentId = item.id; break; }
  }

  // 2. Outside the published grid the channel loops the block list, so there is
  //    always exactly one block on air. That is what "24/7 linear" means.
  let looped = false;
  if (currentId === null) {
    const gridStart = parsed[0].win.start;
    const span = parsed.reduce((sum, p) => sum + p.win.minutes, 0);
    let elapsed = (((minutesOfDay - gridStart) % 1440) + 1440) % 1440 % span;
    for (const { item, win } of parsed) {
      if (elapsed < win.minutes) { currentId = item.id; break; }
      elapsed -= win.minutes;
    }
    looped = true;
  }

  const currentIndex = parsed.findIndex((p) => p.item.id === currentId);
  return parsed.map(({ item, win }, i) => ({
    ...item,
    isCurrent: item.id === currentId,
    isNext: i === (currentIndex + 1) % parsed.length && item.id !== currentId,
    startsAtMinute: win.start,
    durationMinutes: win.minutes,
    looped: item.id === currentId ? looped : false,
  }));
}
