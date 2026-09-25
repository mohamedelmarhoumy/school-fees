'use client';

/**
 * طابور بسيط لأي عملية كتابة (زي تسجيل حضور) بيتخزن في localStorage.
 * الفكرة: العملية بتتنفذ في الواجهة فوراً (Optimistic UI)، وبعدين بتتحاول
 * ترفع لـ Supabase في الخلفية. لو النت بطيء أو مقطوع، العملية بتفضل في
 * الطابور وتتحاول تاني تلقائياً أول ما النت يرجع أو كل كام ثانية.
 */

const PREFIX = 'hissati-queue:';

function readQueue(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(name, items) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(items));
  } catch {
    // تجاهل — لو الكتابة فشلت، العملية الأصلية اتنفذت أوبتيمستك على أي حال
  }
}

export function enqueue(name, payload) {
  const items = readQueue(name);
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, payload, createdAt: Date.now(), attempts: 0 };
  items.push(item);
  writeQueue(name, items);
  notify(name);
  return item.id;
}

export function removeFromQueue(name, id) {
  const items = readQueue(name).filter((it) => it.id !== id);
  writeQueue(name, items);
  notify(name);
}

export function getQueueItems(name) {
  return readQueue(name);
}

export function getQueueCount(name) {
  return readQueue(name).length;
}

/** بيحاول ينفّذ كل العناصر المعلّقة عن طريق handler(payload) => Promise. العناصر اللي تنجح بتتشال، والباقي بيفضل للمحاولة الجاية. */
export async function flushQueue(name, handler) {
  const items = readQueue(name);
  if (items.length === 0) return { succeeded: 0, failed: 0 };
  let succeeded = 0;
  const remaining = [];
  for (const item of items) {
    try {
      await handler(item.payload);
      succeeded += 1;
    } catch {
      remaining.push({ ...item, attempts: (item.attempts || 0) + 1 });
    }
  }
  writeQueue(name, remaining);
  notify(name);
  return { succeeded, failed: remaining.length };
}

// نظام إشعار بسيط عشان أي مكون معروض على الشاشة يعرف يحدّث عدّاد "قيد المزامنة" فوراً
const listeners = new Set();
function notify(name) {
  listeners.forEach((fn) => fn(name));
}
export function subscribeQueueChanges(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
