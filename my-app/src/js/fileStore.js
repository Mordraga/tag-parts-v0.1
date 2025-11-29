// fileStore.js
const DIRECTORY = 'DATA';
const FILE_MAP = {
  front_logs: 'front_logs.json',
  recent_logs: 'recent_logs.json',
  front_logs_archive: 'front_logs_archive.json',
  parts_data: 'parts.json'
};

function getFilesystem() {
  if (typeof window === 'undefined') return null;
  return window.Capacitor?.Plugins?.Filesystem || null;
}

export function initializeFileMirrors() {
  const fs = getFilesystem();
  if (!fs) return;
  Object.entries(FILE_MAP).forEach(([key, filename]) => {
    fs.readFile({
      path: filename,
      directory: DIRECTORY,
      encoding: 'utf8'
    })
      .then((result) => {
        if (result?.data && !localStorage.getItem(key)) {
          localStorage.setItem(key, result.data);
        }
      })
      .catch(() => {
        const existing = localStorage.getItem(key);
        if (existing) {
          mirrorKeyToFile(key, existing);
        }
      })
      .finally(() => {
        const data = localStorage.getItem(key);
        if (data) {
          mirrorKeyToFile(key, data);
        }
      });
  });
}

export function mirrorKeyToFile(key, rawJson) {
  const fs = getFilesystem();
  const filename = FILE_MAP[key];
  if (!fs || !filename) return;

  if (rawJson === null) {
    fs.deleteFile({ path: filename, directory: DIRECTORY }).catch(() => {});
    return;
  }

  const data =
    typeof rawJson === 'string' ? rawJson : JSON.stringify(rawJson ?? null);

  fs.writeFile({
    path: filename,
    directory: DIRECTORY,
    encoding: 'utf8',
    data
  }).catch((err) => {
    console.warn('Failed to mirror data to file', key, err);
  });
}
