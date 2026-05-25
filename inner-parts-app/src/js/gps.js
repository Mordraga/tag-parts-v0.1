import { nearestCity } from './localGeocode.js';

export function getLocation(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve('Unknown');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        try {
          const city = nearestCity(lat, lng);
          resolve(city ?? `${lat.toFixed(2)}, ${lng.toFixed(2)}`);
        } catch {
          resolve(`${lat.toFixed(2)}, ${lng.toFixed(2)}`);
        }
      },
      () => resolve('Unknown'),
      { timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}
