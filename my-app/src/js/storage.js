// scripts/modules/storage.js

export function saveToStorage(key, data) {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  } catch (e) {
    console.error("Save failed:", e);
  }
}

export function loadFromStorage(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Load failed:", e);
    return fallback;
  }
}

export function deleteFromStorage(key) {
  localStorage.removeItem(key);
}

