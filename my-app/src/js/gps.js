// gps.js — resolves to a human-readable address via Nominatim reverse geocoding,
// falling back to coordinates if the network call fails.

export function getLocation(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve('Unknown');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'User-Agent': 'TagParts/1.0' } }
          );
          const data = await res.json();
          const a = data.address || {};
          const road = a.road || a.pedestrian || a.footway || a.path || '';
          const city = a.city || a.town || a.village || a.county || '';
          if (road && city) {
            resolve(`${road}, ${city}`);
          } else if (data.display_name) {
            // Trim to first two comma-segments for brevity
            resolve(data.display_name.split(',').slice(0, 2).join(',').trim());
          } else {
            resolve(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch {
          resolve(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      },
      () => resolve('Unknown'),
      { timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}
