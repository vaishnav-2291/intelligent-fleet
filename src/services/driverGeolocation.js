/**
 * Driver Device Geolocation Service
 * Integrates with native browser navigator.geolocation.watchPosition()
 * to continuously stream genuine device GPS coordinates.
 *
 * Enforces:
 * - enableHighAccuracy: true
 * - Throttling between 5-15 seconds to prevent network saturation
 * - Clear error mapping for PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT
 * - Resource cleanup via clearWatch()
 */

export const GEOLOCATION_ERRORS = {
  UNSUPPORTED: 'UNSUPPORTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN'
};

export function getGeolocationErrorMessage(error) {
  if (!error) return 'Unknown location error.';
  if (typeof error === 'string') return error;

  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return 'Location access was denied. Please allow location permissions in your browser settings to share live GPS.';
    case 2: // POSITION_UNAVAILABLE
      return 'GPS position unavailable. Please ensure device location services / GPS are enabled.';
    case 3: // TIMEOUT
      return 'GPS signal acquisition timed out. Retrying in high accuracy mode...';
    default:
      return error.message || 'An unexpected error occurred while acquiring GPS telemetry.';
  }
}

/**
 * Start watching continuous device position.
 * @param {Object} options
 * @param {Function} options.onLocation - Callback with telemetry data frame
 * @param {Function} options.onError - Callback with structured error
 * @param {number} [options.minIntervalMs=8000] - Minimum milliseconds between transmitted updates (5-15s recommended)
 * @returns {number|null} watchId
 */
export function startDriverLocationWatch({ onLocation, onError, minIntervalMs = 8000 }) {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    if (onError) {
      onError({
        code: GEOLOCATION_ERRORS.UNSUPPORTED,
        message: 'Browser geolocation is not supported on this device or environment.'
      });
    }
    return null;
  }

  let lastTransmittedTime = 0;
  let lastLat = null;
  let lastLng = null;

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000
  };

  const successHandler = (position) => {
    if (!position || !position.coords) return;

    const { latitude, longitude, accuracy } = position.coords;
    const now = Date.now();
    const timeSinceLast = now - lastTransmittedTime;

    // Significant movement check (approx > 5 meters)
    const hasMovedSignificantly = lastLat !== null && lastLng !== null &&
      (Math.abs(latitude - lastLat) > 0.00005 || Math.abs(longitude - lastLng) > 0.00005);

    // Throttle: transmit if first fix, or elapsed minIntervalMs, or significant movement
    if (lastTransmittedTime === 0 || timeSinceLast >= minIntervalMs || hasMovedSignificantly) {
      lastTransmittedTime = now;
      lastLat = latitude;
      lastLng = longitude;

      const frame = {
        latitude,
        longitude,
        accuracy: typeof accuracy === 'number' && !isNaN(accuracy) ? Math.round(accuracy * 10) / 10 : null,
        timestamp: position.timestamp ? new Date(position.timestamp).toISOString() : new Date().toISOString(),
        source: 'MOBILE_GPS'
      };

      if (onLocation) {
        onLocation(frame);
      }
    }
  };

  const errorHandler = (geoError) => {
    let errorCode = GEOLOCATION_ERRORS.UNKNOWN;
    if (geoError.code === 1) errorCode = GEOLOCATION_ERRORS.PERMISSION_DENIED;
    else if (geoError.code === 2) errorCode = GEOLOCATION_ERRORS.POSITION_UNAVAILABLE;
    else if (geoError.code === 3) errorCode = GEOLOCATION_ERRORS.TIMEOUT;

    if (onError) {
      onError({
        code: errorCode,
        nativeCode: geoError.code,
        message: getGeolocationErrorMessage(geoError)
      });
    }
  };

  try {
    const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, geoOptions);
    return watchId;
  } catch (err) {
    if (onError) {
      onError({
        code: GEOLOCATION_ERRORS.UNKNOWN,
        message: err.message || 'Failed to initialize geolocation watch.'
      });
    }
    return null;
  }
}

/**
 * Stop watching device position and release GPS resources.
 * @param {number} watchId
 */
export function stopDriverLocationWatch(watchId) {
  if (typeof window !== 'undefined' && navigator.geolocation && watchId !== null && watchId !== undefined) {
    try {
      navigator.geolocation.clearWatch(watchId);
    } catch (e) {
      console.warn('Error clearing geolocation watch:', e);
    }
  }
}
