/**
 * Centralized SNSIHub Webhook Service Layer
 *
 * Communicates with the SNSIHub AgentBuilder Webhook via natural-language commands
 * and normalizes responses for the Intelligent Fleet frontend.
 */

// ============================================================
// WEBHOOK CONFIG
// ============================================================

const getWebhookUrl = () => {
  return import.meta.env.VITE_SNS_WEBHOOK_URL || '';
};

// ============================================================
// CORE SNS WEBHOOK REQUEST
// ============================================================

export const callSNSWebhook = async (payload, options = {}) => {
  const webhookUrl = getWebhookUrl();

  if (
    !webhookUrl ||
    typeof webhookUrl !== 'string' ||
    !webhookUrl.startsWith('http')
  ) {
    throw new Error(
      'SNSIHub Webhook URL is not configured. Please set VITE_SNS_WEBHOOK_URL in your environment.'
    );
  }

  const timeoutMs = options.timeout || 60000;
  const controller = new AbortController();

  let isTimeoutAborted = false;

  const timeoutId = setTimeout(() => {
    isTimeoutAborted = true;
    controller.abort();
  }, timeoutMs);

  const startTime = Date.now();
  const isDev = Boolean(import.meta.env?.DEV);

  if (isDev) {
    const summaryMsg =
      typeof payload === 'string'
        ? payload
        : payload?.message || payload?.action || 'POST request';

    console.log(
      `[SNSIHub Request] Started at ${new Date().toLocaleTimeString()} - "${summaryMsg}"`
    );
  }

  try {
    const body =
      typeof payload === 'string'
        ? { message: payload }
        : payload;

    let response;

    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      if (isTimeoutAborted) {
        const timeoutMsg =
          `SNSIHub Webhook request timed out after ${Math.round(
            timeoutMs / 1000
          )}s. The AI workflow is taking longer to respond.`;

        if (isDev) {
          console.warn(
            `[SNSIHub Timeout] ${timeoutMsg} (${duration}ms)`
          );
        }

        throw new Error(timeoutMsg);
      }

      if (fetchErr?.name === 'AbortError') {
        const abortMsg =
          'SNSIHub Webhook request was cancelled by client.';

        if (isDev) {
          console.log(
            `[SNSIHub Aborted] ${abortMsg} (${duration}ms)`
          );
        }

        throw new Error(abortMsg);
      }

      if (fetchErr instanceof TypeError) {
        const networkMsg =
          'Network Error: Unable to reach external service. Please check network connectivity.';

        if (isDev) {
          console.error(
            `[SNSIHub Network Error] ${networkMsg} (${duration}ms)`
          );
        }

        throw new Error(networkMsg);
      }

      if (isDev) {
        console.error(
          `[SNSIHub Fetch Failure] (${duration}ms):`,
          fetchErr
        );
      }

      throw fetchErr;
    }

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    if (isDev) {
      console.log(
        `[SNSIHub Response] HTTP ${response.status} ${response.statusText} in ${duration}ms`
      );
    }

    // ========================================================
    // HTTP ERROR HANDLING
    // ========================================================

    if (!response.ok) {
      // Retry test endpoint only when primary webhook returns 404.
      if (
        response.status === 404 &&
        webhookUrl.includes('/webhook/')
      ) {
        const testUrl = webhookUrl.replace(
          '/webhook/',
          '/webhook-test/'
        );

        if (isDev) {
          console.warn(
            `[SNSIHub 404] Primary webhook inactive, retrying against test endpoint.`
          );
        }

        try {
          const testRes = await fetch(testUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(options.headers || {})
            },
            body: JSON.stringify(body),
            signal: controller.signal
          });

          if (testRes.ok) {
            response = testRes;
          }
        } catch (testErr) {
          if (isDev) {
            console.warn(
              '[SNSIHub Test Endpoint Retry Error]:',
              testErr?.message
            );
          }
        }
      }
    }

    if (!response.ok) {
      let errorDetails =
        `HTTP ${response.status} ${response.statusText}`;

      try {
        const errorJson = await response.json();

        if (errorJson?.message || errorJson?.error) {
          errorDetails =
            errorJson.message ||
            errorJson.error;
        }
      } catch {
        // Non-JSON response.
      }

      throw new Error(
        `External service returned error HTTP ${response.status}: ${errorDetails}`
      );
    }

    // ========================================================
    // JSON RESPONSE
    // ========================================================

    let data;

    try {
      data = await response.json();
    } catch (jsonErr) {
      throw new Error(
        `SNSIHub returned invalid JSON response: ${jsonErr.message}`
      );
    }

    return {
      success: true,
      data,
      raw: data,

      // Important:
      // Production webhook may return:
      // {
      //   result: {
      //     output: "..."
      //   }
      // }
      message:
        data?.result?.output ??
        data?.output ??
        data?.message ??
        'Operation processed successfully.'
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

// ============================================================
// STRICT FLEET SAFETY & SCHEMA VALIDATION
// ============================================================

export const FLEET_AI_UNAVAILABLE_MESSAGE =
  'Fleet Assistant is temporarily unavailable. Please try again shortly.';

// Disallowed industrial, factory-floor, and non-fleet domain terms
const DISALLOWED_INDUSTRIAL_TERMS = [
  'factory',
  'assembly line',
  'shop floor',
  'manufacturing',
  'plc',
  'scada',
  'cnc',
  'production line',
  'bill of materials',
  'bom',
  'workstation',
  'injection molding',
  'extrusion',
  'die casting',
  'furnace',
  'oee',
  'takt time',
  'machining center',
  'smurf',
  'mrp'
];

// Disallowed internal infrastructure, endpoints, credentials, or leaked stack traces
const DISALLOWED_INTERNAL_LEAKS = [
  'api.fleetmanagement.internal',
  'api.fleet-operations.com',
  'api.example.com',
  'api.agents.snsihub.ai',
  'sns_webhook_url',
  'webhook-test',
  'mongodb+srv',
  'onrender.com',
  'localhost',
  '127.0.0.1',
  'typeerror',
  'econnrefused',
  'aggregateerror',
  'fetcherror'
];

/**
 * Validates text content against strict Fleet Management boundaries.
 * Rejects responses containing unrelated industrial concepts, factory terms, or internal leakage.
 */
export const isStrictFleetText = (text) => {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();

  // 1. Check for banned industrial / factory terms
  for (const term of DISALLOWED_INDUSTRIAL_TERMS) {
    if (lower.includes(term)) {
      return false;
    }
  }

  // 2. Check for banned internal infrastructure / leakage
  for (const leak of DISALLOWED_INTERNAL_LEAKS) {
    if (lower.includes(leak)) {
      return false;
    }
  }

  return true;
};

/**
 * Validates an entire response payload against strict Fleet AI schema rules.
 * Ensures the response is fleet-domain appropriate and has no industrial drift.
 */
export const isStrictFleetResponse = (payload, text) => {
  if (!payload || typeof payload !== 'object') return false;

  // Validate the textual representation
  if (text && !isStrictFleetText(text)) {
    return false;
  }

  // If message or error inside payload contains disallowed terms
  const payloadStr = JSON.stringify(payload).toLowerCase();
  for (const term of DISALLOWED_INDUSTRIAL_TERMS) {
    if (payloadStr.includes(term)) {
      return false;
    }
  }
  for (const leak of DISALLOWED_INTERNAL_LEAKS) {
    if (payloadStr.includes(leak)) {
      return false;
    }
  }

  return true;
};

// ============================================================
// UNIVERSAL NATURAL LANGUAGE QUERY
// ============================================================

export const askSNS = async (message) => {
  try {
    const res = await callSNSWebhook({ message });
    const output =
      res?.data?.result?.output ??
      res?.data?.output ??
      res?.result?.output ??
      res?.output ??
      res?.message ??
      '';

    if (!isStrictFleetResponse(res, output)) {
      return {
        success: false,
        isUnavailable: true,
        data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } },
        message: FLEET_AI_UNAVAILABLE_MESSAGE
      };
    }

    return res;
  } catch {
    return {
      success: false,
      isUnavailable: true,
      data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } },
      message: FLEET_AI_UNAVAILABLE_MESSAGE
    };
  }
};

// ============================================================
// FLEET AI COPILOT
// ============================================================

export const askFleetAI = async (
  message,
  sessionId = 'fleet-admin-session-1'
) => {
  // Primary & Only Auto Path: Dedicated Backend Gateway AI Chat Endpoint
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
      signal: AbortSignal.timeout(15000)
    });

    if (res.ok) {
      const data = await res.json();
      const output =
        data.message ||
        (typeof data.data === 'string' ? data.data : 'Processed successfully.');

      if (isStrictFleetResponse(data, output)) {
        return {
          success: true,
          data: {
            result: { output },
            ...data
          },
          message: output
        };
      }
    }
  } catch (chatErr) {
    if (import.meta.env?.DEV) {
      console.log('[askFleetAI local gateway attempt]:', chatErr?.message);
    }
  }

  // When local Fleet Gateway is unavailable or times out:
  // DO NOT call the generic external SNS webhook automatically.
  // Return safe, user-friendly service-unavailable response without technical leaks.
  return {
    success: false,
    isUnavailable: true,
    data: {
      result: { output: FLEET_AI_UNAVAILABLE_MESSAGE }
    },
    message: FLEET_AI_UNAVAILABLE_MESSAGE
  };
};

// ============================================================
// SINGLE-ENTITY QUERY HELPERS
// ============================================================

export const getVehicleStatus = async (vehicleId) => {
  try {
    const res = await fetch(`/api/vehicles/${vehicleId}`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: { result: json.data || json } };
    }
  } catch {}
  return {
    success: false,
    message: FLEET_AI_UNAVAILABLE_MESSAGE,
    data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } }
  };
};

export const getDriverStatus = async (driverId) => {
  try {
    const res = await fetch(`/api/drivers/${driverId}`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: { result: json.data || json } };
    }
  } catch {}
  return {
    success: false,
    message: FLEET_AI_UNAVAILABLE_MESSAGE,
    data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } }
  };
};

export const getTripStatus = async (tripId) => {
  try {
    const res = await fetch(`/api/trips/${tripId}`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: { result: json.data || json } };
    }
  } catch {}
  return {
    success: false,
    message: FLEET_AI_UNAVAILABLE_MESSAGE,
    data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } }
  };
};

export const getMaintenanceStatus = async (vehicleId) => {
  try {
    const res = await fetch(`/api/maintenance?vehicleId=${vehicleId}`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: { result: json.data || json } };
    }
  } catch {}
  return {
    success: false,
    message: FLEET_AI_UNAVAILABLE_MESSAGE,
    data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } }
  };
};

export const getFuelAnalysis = async (vehicleId) => {
  try {
    const res = await fetch(`/api/fuel?vehicleId=${vehicleId}`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: { result: json.data || json } };
    }
  } catch {}
  return {
    success: false,
    message: FLEET_AI_UNAVAILABLE_MESSAGE,
    data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } }
  };
};

export const getSafetyAlerts = async (vehicleId) => {
  try {
    const res = await fetch(`/api/safety-alerts?vehicleId=${vehicleId}`);
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: { result: json.data || json } };
    }
  } catch {}
  return {
    success: false,
    message: FLEET_AI_UNAVAILABLE_MESSAGE,
    data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } }
  };
};

export const getFleetSummary = async () => {
  try {
    const res = await fetch('/api/analytics');
    if (res.ok) {
      const json = await res.json();
      return {
        success: true,
        data: {
          result: json.data
        }
      };
    }
  } catch {}
  return {
    success: false,
    message: FLEET_AI_UNAVAILABLE_MESSAGE,
    data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } }
  };
};

export const getFleetAnalysis = async () => {
  try {
    const res = await fetch('/api/analytics');
    if (res.ok) {
      const json = await res.json();
      return {
        success: true,
        data: {
          result: json.data
        }
      };
    }
  } catch {}
  return {
    success: false,
    message: FLEET_AI_UNAVAILABLE_MESSAGE,
    data: { result: { output: FLEET_AI_UNAVAILABLE_MESSAGE } }
  };
};

// ============================================================
// FLEET IDS
// ============================================================

export const FLEET_VEHICLE_IDS = [
  'VH101', 'VH102', 'VH103', 'VH104', 'VH105',
  'VH106', 'VH107', 'VH108', 'VH109', 'VH110'
];

export const FLEET_DRIVER_IDS = [
  'DR101', 'DR102', 'DR103', 'DR104', 'DR105',
  'DR106', 'DR107', 'DR108', 'DR109', 'DR110'
];

export const FLEET_TRIP_IDS = [
  'TR101', 'TR102', 'TR103', 'TR104', 'TR105',
  'TR106', 'TR107', 'TR108', 'TR109', 'TR110'
];

// ============================================================
// ALL VEHICLES
// ============================================================

export const getAllVehicles = async () => {
  try {
    const res = await fetch('/api/vehicles', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
      if (list.length > 0) {
        return {
          success: true,
          data: {
            result: list
          },
          raw: list
        };
      }
    }
  } catch (apiErr) {
    if (import.meta.env?.DEV) {
      console.log('[getAllVehicles API fetch, trying SNS]:', apiErr?.message);
    }
  }

  try {
    const response = await askSNS('Show me all vehicles in the fleet');
    return response;
  } catch (err) {
    console.warn('[getAllVehicles error]:', err?.message);
    return {
      success: false,
      data: { result: [] },
      raw: [],
      message: err?.message || 'Unable to retrieve vehicles.'
    };
  }
};

// ============================================================
// ALL DRIVERS
// ============================================================

export const getAllDrivers = async () => {
  try {
    const res = await fetch('/api/drivers', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
      if (list.length > 0) {
        return {
          success: true,
          data: {
            result: list
          },
          raw: list
        };
      }
    }
  } catch (apiErr) {
    if (import.meta.env?.DEV) {
      console.log('[getAllDrivers API fetch, trying SNS]:', apiErr?.message);
    }
  }

  try {
    const response = await askSNS('Show me all drivers in the fleet');
    return response;
  } catch (err) {
    console.warn('[getAllDrivers error]:', err?.message);
    return {
      success: false,
      data: { result: [] },
      raw: [],
      message: err?.message || 'Unable to retrieve drivers.'
    };
  }
};

// ============================================================
// ALL TRIPS
// ============================================================

export const getAllTrips = async () => {
  try {
    const res = await fetch('/api/trips', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
      if (list.length > 0) {
        return {
          success: true,
          data: {
            result: list
          },
          raw: list
        };
      }
    }
  } catch (apiErr) {
    if (import.meta.env?.DEV) {
      console.log('[getAllTrips API fetch, trying SNS]:', apiErr?.message);
    }
  }

  try {
    const response = await askSNS('Show me all trips in the fleet');
    return response;
  } catch (err) {
    console.warn('[getAllTrips error]:', err?.message);
    return {
      success: false,
      data: { result: [] },
      raw: [],
      message: err?.message || 'Unable to retrieve trips.'
    };
  }
};

// ============================================================
// LIVE LOCATIONS TELEMETRY
// ============================================================

export const getLiveLocations = async () => {
  try {
    const res = await fetch('/api/locations/live', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('[getLiveLocations error]:', err?.message);
    }
  }
  return { success: false, vehicles: [], drivers: [] };
};

export const updateVehicleLocation = async (vehicleId, payload, token = null) => {
  try {
    const res = await fetch(`/api/vehicles/${vehicleId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || data.message || `Vehicle location update failed with HTTP ${res.status}`
      };
    }
    return { success: true, status: res.status, data: data.data || data };
  } catch (err) {
    return { success: false, status: 500, error: err.message || 'Network error updating vehicle location.' };
  }
};

export const updateDriverLocation = async (driverId, payload, token = null) => {
  try {
    const res = await fetch(`/api/drivers/${driverId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || data.message || `Driver location update failed with HTTP ${res.status}`
      };
    }
    return { success: true, status: res.status, data: data.data || data };
  } catch (err) {
    return { success: false, status: 500, error: err.message || 'Network error updating driver location.' };
  }
};

export const sendDriverLocationTelemetry = async (payload, token = null) => {
  try {
    const res = await fetch('/api/locations/driver', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: data.error || data.message || `Driver location telemetry failed with HTTP ${res.status}`
      };
    }
    return { success: true, status: res.status, data: data.data || data };
  } catch (err) {
    return { success: false, status: 500, error: err.message || 'Network error sending driver location telemetry.' };
  }
};



// ============================================================
// MAINTENANCE
// ============================================================

export const getAllMaintenance = async () => {
  try {
    const res = await fetch('/api/maintenance', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
      if (list.length > 0) {
        return {
          success: true,
          data: {
            result: list
          },
          raw: list
        };
      }
    }
  } catch (apiErr) {
    if (import.meta.env?.DEV) {
      console.log('[getAllMaintenance API fetch, trying SNS]:', apiErr?.message);
    }
  }

  try {
    const response = await askSNS('Show due maintenance');
    return response;
  } catch (err) {
    console.warn('[getAllMaintenance error]:', err?.message);
    return {
      success: false,
      data: { result: [] },
      raw: [],
      message: err?.message || 'Unable to retrieve maintenance records.'
    };
  }
};

// ============================================================
// FUEL
// ============================================================

export const getAllFuelRecords = async () => {
  try {
    const res = await fetch('/api/fuel', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
      if (list.length > 0) {
        return {
          success: true,
          data: {
            result: list
          },
          raw: list
        };
      }
    }
  } catch (apiErr) {
    if (import.meta.env?.DEV) {
      console.log('[getAllFuelRecords API fetch, trying SNS]:', apiErr?.message);
    }
  }

  try {
    const response = await askSNS('Show fuel analysis');
    return response;
  } catch (err) {
    console.warn('[getAllFuelRecords error]:', err?.message);
    return {
      success: false,
      data: { result: [] },
      raw: [],
      message: err?.message || 'Unable to retrieve fuel records.'
    };
  }
};

// ============================================================
// SAFETY ALERTS
// ============================================================

export const getAllSafetyAlerts = async () => {
  try {
    const res = await fetch('/api/safety-alerts', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
      if (list.length > 0) {
        return {
          success: true,
          data: {
            result: list
          },
          raw: list
        };
      }
    }
  } catch (apiErr) {
    if (import.meta.env?.DEV) {
      console.log('[getAllSafetyAlerts API fetch, trying SNS]:', apiErr?.message);
    }
  }

  try {
    const response = await askSNS('Show safety alerts');
    return response;
  } catch (err) {
    console.warn('[getAllSafetyAlerts error]:', err?.message);
    return {
      success: false,
      data: { result: [] },
      raw: [],
      message: err?.message || 'Unable to retrieve safety alerts.'
    };
  }
};

// ============================================================
// ROUTE OPTIMIZATION
// ============================================================

export const optimizeRoute = async (
  origin,
  destination,
  waypoints = [],
  coords = {}
) => {
  const message =
    waypoints && waypoints.length > 0
      ? `Optimize the route from ${origin} to ${destination} via ${waypoints.join(', ')}`
      : `Optimize the route from ${origin} to ${destination}`;

  const payload = {
    message,

    source: String(origin).toLowerCase(),

    destination:
      String(destination).toLowerCase(),

    source_coords:
      coords.sourceCoords ||
      coords.source_coords,

    dest_coords:
      coords.destCoords ||
      coords.dest_coords,

    waypoints
  };

  return await callSNSWebhook(payload);
};

// ============================================================
// DRIVER ACTIONS (START DUTY / GO OFFLINE)
// ============================================================

export const startDriverDuty = async (
  driverId,
  location
) => {
  let token = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      token = window.sessionStorage.getItem('fleet_token');
    }
  } catch (_) {}

  // 1. Authenticated API mutation to fleet server
  try {
    const res = await fetch('/api/drivers/duty', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        driverId,
        status: 'active',
        location
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Duty start failed with HTTP ${res.status}`);
    }

    // Optional secondary SNSIHub workflow sync
    try {
      const msg = location
        ? `Start duty for driver ${driverId} at location ${location}`
        : `Start duty for driver ${driverId}`;
      callSNSWebhook({
        message: msg,
        action: 'START_DUTY',
        driverId,
        location
      }).catch(() => {});
    } catch (_) {}

    return {
      success: true,
      status: 'Active',
      data: data.driver || data
    };
  } catch (err) {
    // If direct API failed, attempt webhook fallback
    try {
      const msg = location
        ? `Start duty for driver ${driverId} at location ${location}`
        : `Start duty for driver ${driverId}`;
      const webhookRes = await callSNSWebhook({
        message: msg,
        action: 'START_DUTY',
        driverId,
        location
      });
      return {
        success: true,
        status: 'Active',
        data: webhookRes
      };
    } catch (fallbackErr) {
      throw new Error(err.message || fallbackErr.message || 'Failed to start driver duty shift.');
    }
  }
};

export const setDriverOffline = async (
  driverId
) => {
  let token = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      token = window.sessionStorage.getItem('fleet_token');
    }
  } catch (_) {}

  // 1. Authenticated API mutation to fleet server
  try {
    const res = await fetch('/api/drivers/duty', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        driverId,
        status: 'ready'
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Go offline failed with HTTP ${res.status}`);
    }

    // Optional secondary SNSIHub workflow sync
    try {
      callSNSWebhook({
        message: `Set driver ${driverId} offline`,
        action: 'GO_OFFLINE',
        driverId
      }).catch(() => {});
    } catch (_) {}

    return {
      success: true,
      status: 'Ready',
      data: data.driver || data
    };
  } catch (err) {
    // Fallback to webhook
    try {
      const webhookRes = await callSNSWebhook({
        message: `Set driver ${driverId} offline`,
        action: 'GO_OFFLINE',
        driverId
      });
      return {
        success: true,
        status: 'Ready',
        data: webhookRes
      };
    } catch (fallbackErr) {
      throw new Error(err.message || fallbackErr.message || 'Failed to set driver offline.');
    }
  }
};

// ============================================================
// ASSIGN TRIP ROUTE
// ============================================================

export const assignTripRoute = async (
  driverId,
  vehicleId,
  source,
  destination,
  routeInfo = {}
) => {
  const waypoints =
    routeInfo?.waypoints ||
    routeInfo?.stops ||
    [];

  const stopsText =
    waypoints.length > 0
      ? ` via ${waypoints.join(', ')}`
      : '';

  const payload = {
    message:
      `Assign route from ${source} to ${destination}${stopsText} ` +
      `for driver ${driverId} with vehicle ${vehicleId}`,

    action: 'ASSIGN_ROUTE',

    driverId: String(driverId),
    driver_id: String(driverId),

    vehicleId: String(vehicleId),
    vehicle_id: String(vehicleId),

    source,
    origin: source,
    destination,

    stops: waypoints,
    waypoints,

    distance_km:
      routeInfo?.distanceKm ||
      routeInfo?.distance_km ||
      null,

    distanceKm:
      routeInfo?.distanceKm ||
      routeInfo?.distance_km ||
      null,

    estimated_duration:
      routeInfo?.duration ||
      routeInfo?.estimated_duration ||
      null,

    estimatedDuration:
      routeInfo?.duration ||
      routeInfo?.estimated_duration ||
      null,

    route_geometry:
      routeInfo?.routeGeometry ||
      null
  };

  return await callSNSWebhook(payload);
};

// ============================================================
// START DRIVER TRIP
// ============================================================

export const startDriverTrip = async (
  driverId,
  tripId = null
) => {
  const msg = tripId
    ? `Start trip ${tripId} for driver ${driverId}`
    : `Start trip for driver ${driverId}`;

  return await callSNSWebhook({
    message: msg,
    action: 'START_TRIP',
    driverId,
    tripId
  });
};

// ============================================================
// COMPLETE DRIVER TRIP
// ============================================================

export const completeDriverTrip = async (
  tripIdOrDriverId,
  optionalDriverOrTripId = null,
  vehicleId = null
) => {
  let tId = null;
  let dId = null;

  const vId = vehicleId
    ? String(vehicleId)
    : null;

  const s1 = tripIdOrDriverId
    ? String(tripIdOrDriverId)
    : null;

  const s2 = optionalDriverOrTripId
    ? String(optionalDriverOrTripId)
    : null;

  if (
    s1 &&
    s1.toUpperCase().startsWith('TR')
  ) {
    tId = s1;
    dId = s2;
  } else if (
    s2 &&
    s2.toUpperCase().startsWith('TR')
  ) {
    tId = s2;
    dId = s1;
  } else if (
    s1 &&
    s1.toUpperCase().startsWith('DR')
  ) {
    dId = s1;
    tId = s2;
  } else {
    tId = s1;
    dId = s2;
  }

  const msg =
    tId && dId
      ? `Complete trip ${tId} for driver ${dId}`
      : tId
        ? `Complete trip ${tId}`
        : `Complete trip for driver ${dId}`;

  return await callSNSWebhook({
    message: msg,
    action: 'COMPLETE_TRIP',

    driverId: dId,
    driver_id: dId,

    tripId: tId,
    trip_id: tId,

    vehicleId: vId,
    vehicle_id: vId,

    status: 'completed'
  });
};

// ============================================================
// CANCEL DRIVER TRIP
// ============================================================

export const cancelDriverTrip = async (
  tripIdOrDriverId,
  optionalDriverOrTripId = null,
  vehicleId = null
) => {
  let tId = null;
  let dId = null;

  const vId = vehicleId
    ? String(vehicleId)
    : null;

  const s1 = tripIdOrDriverId
    ? String(tripIdOrDriverId)
    : null;

  const s2 = optionalDriverOrTripId
    ? String(optionalDriverOrTripId)
    : null;

  if (
    s1 &&
    s1.toUpperCase().startsWith('TR')
  ) {
    tId = s1;
    dId = s2;
  } else if (
    s2 &&
    s2.toUpperCase().startsWith('TR')
  ) {
    tId = s2;
    dId = s1;
  } else if (
    s1 &&
    s1.toUpperCase().startsWith('DR')
  ) {
    dId = s1;
    tId = s2;
  } else {
    tId = s1;
    dId = s2;
  }

  const msg =
    tId && dId
      ? `Cancel trip ${tId} for driver ${dId}`
      : tId
        ? `Cancel trip ${tId}`
        : `Cancel trip for driver ${dId}`;

  return await callSNSWebhook({
    message: msg,
    action: 'CANCEL_TRIP',

    tripId: tId,
    trip_id: tId,

    driverId: dId,
    driver_id: dId,

    vehicleId: vId,
    vehicle_id: vId,

    status: 'cancelled'
  });
};

// ============================================================
// RESET DRIVER DUTY
// ============================================================

export const resetDriverDuty = async (
  driverId
) => {
  return await callSNSWebhook({
    message: `Reset duty for driver ${driverId}`,
    action: 'RESET_DUTY',
    driverId
  });
};

// ============================================================
// RESPONSE FORMAT NORMALIZERS
// ============================================================

export const extractPayloadResult = (
  response
) => {
  if (!response) return null;

  if (
    response?.data?.data?.result !== undefined &&
    response.data.data.result !== null
  ) {
    return response.data.data.result;
  }

  if (
    response?.data?.data?.document !== undefined &&
    response.data.data.document !== null
  ) {
    return response.data.data.document;
  }

  if (
    response?.data?.result !== undefined &&
    response.data.result !== null
  ) {
    return response.data.result;
  }

  if (
    response?.data?.document !== undefined &&
    response.data.document !== null
  ) {
    return response.data.document;
  }

  if (
    response?.result !== undefined &&
    response.result !== null
  ) {
    return response.result;
  }

  if (
    response?.data?.data !== undefined &&
    response.data.data !== null
  ) {
    if (
      response.data.data.result !== undefined &&
      response.data.data.result !== null
    ) {
      return response.data.data.result;
    }

    return response.data.data;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (
    response?.data?.module &&
    response?.data?.data
  ) {
    return (
      response.data.data.result ||
      response.data.data
    );
  }

  if (
    response?.module &&
    response?.data
  ) {
    return (
      response.data.result ||
      response.data
    );
  }

  if (response?.data?.fleetHealth) {
    return response.data;
  }

  return response?.data !== undefined &&
    response?.data !== null
    ? response.data
    : response;
};

// ============================================================
// RESULT LIST EXTRACTION
// ============================================================

export const extractResultList = (
  response
) => {
  if (!response) return [];

  const unwrapped =
    extractPayloadResult(response);

  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }

  if (
    unwrapped &&
    typeof unwrapped === 'object'
  ) {
    if (Array.isArray(unwrapped.result)) {
      return unwrapped.result;
    }

    if (Array.isArray(unwrapped.items)) {
      return unwrapped.items;
    }

    if (
      Array.isArray(unwrapped.documents)
    ) {
      return unwrapped.documents;
    }

    if (unwrapped.document) {
      return [unwrapped.document];
    }

    if (
      unwrapped.vehicleId ||
      unwrapped.driverId ||
      unwrapped.tripId ||
      unwrapped.registrationNumber ||
      unwrapped._id
    ) {
      return [unwrapped];
    }
  }

  return [];
};

// ============================================================
// VEHICLE NORMALIZER
// ============================================================

export const normalizeVehicle = (
  raw
) => {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return null;
  }

  const id = String(
    raw.vehicleId ||
    raw.id ||
    raw._id ||
    ''
  );

  const regNo =
    raw.registrationNumber ||
    raw.reg_no ||
    raw.reg_number ||
    raw.vehicle_reg ||
    id;

  const model =
    raw.type ||
    raw.model ||
    raw.model_name ||
    'Commercial Logistics Unit';

  const rawStatus =
    (raw.status || 'idle')
      .toLowerCase()
      .trim();

  let status = 'idle';

  if (
    rawStatus === 'active' ||
    rawStatus.includes('travel') ||
    rawStatus.includes('on_trip') ||
    rawStatus === 'on trip'
  ) {
    status = 'travelling';
  } else if (
    rawStatus === 'inactive' ||
    rawStatus === 'idle' ||
    rawStatus === 'available' ||
    rawStatus === 'ready'
  ) {
    status = 'idle';
  } else if (
    rawStatus.includes('maint')
  ) {
    status = 'maintenance';
  } else {
    status = 'idle';
  }

  return {
    id,
    vehicleId: id,

    reg_no: regNo,
    reg_number: regNo,

    model,
    model_name: model,

    capacity:
      raw.capacity ||
      (
        raw.type === 'Van'
          ? '1.0 Ton'
          : raw.type === 'Mini Truck'
            ? '0.8 Ton'
            : '1.5 Tons'
      ),

    fuel_level:
      typeof raw.fuelLevel === 'number'
        ? raw.fuelLevel
        : typeof raw.fuel_level === 'number'
          ? raw.fuel_level
          : 80,

    status,

    assigned_driver_id:
      raw.driverId ||
      raw.assigned_driver_id ||
      raw.assigned_driver ||
      null,

    location:
      raw.location ||
      raw.currentLocation ||
      'Erode Hub',

    mileage:
      raw.mileage || 0,

    latitude:
      typeof raw.latitude === 'number'
        ? raw.latitude
        : (typeof raw.lat === 'number' ? raw.lat : null),

    longitude:
      typeof raw.longitude === 'number'
        ? raw.longitude
        : (typeof raw.lng === 'number' ? raw.lng : null),

    coordinatesSource:
      raw.coordinatesSource ||
      (typeof raw.latitude === 'number' ? 'LIVE_GPS' : 'UNRESOLVED'),

    isLiveGPS:
      Boolean(raw.isLiveGPS),

    hubLabel:
      raw.hubLabel || null,

    locationTimestamp:
      raw.locationTimestamp ||
      raw.updatedAt ||
      null,

    raw
  };
};

export const normalizeVehicleResponse = (
  response
) => {
  const items =
    extractResultList(
      response?.data || response
    );

  return items
    .map(normalizeVehicle)
    .filter(Boolean);
};

// ============================================================
// DRIVER NORMALIZER
// ============================================================

export const normalizeDriver = (
  raw
) => {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return null;
  }

  const id = String(
    raw.driverId ||
    raw.driver_id ||
    raw.id ||
    raw._id ||
    ''
  );

  const name =
    raw.name ||
    raw.driverName ||
    raw.driver_name ||
    `Driver ${id}`;

  const rawStatus =
    (raw.status || 'Ready')
      .toLowerCase();

  let status = 'Ready';

  if (rawStatus === 'active' || rawStatus === 'on_duty' || rawStatus === 'on duty') {
    status = 'Active';
  } else if (rawStatus === 'ready' || rawStatus === 'inactive' || rawStatus === 'available') {
    status = 'Ready';
  } else if (rawStatus === 'offline') {
    status = 'Offline';
  } else if (rawStatus === 'assigned' || rawStatus === 'assigned_route') {
    status = 'Assigned';
  } else if (
    rawStatus === 'on_trip' ||
    rawStatus === 'on trip'
  ) {
    status = 'On Trip';
  } else if (
    rawStatus === 'completed'
  ) {
    status = 'Completed';
  } else if (
    rawStatus === 'on_leave' ||
    rawStatus === 'on leave'
  ) {
    status = 'On Leave';
  } else {
    status = raw.status
      ? raw.status
        .charAt(0)
        .toUpperCase() +
      raw.status
        .slice(1)
        .toLowerCase()
      : 'Ready';
  }

  return {
    id,
    driverId: id,

    name,

    phone:
      raw.phone ||
      raw.phoneNumber ||
      raw.phone_number ||
      '+91 90000 00000',

    license_number:
      raw.licenseNumber ||
      raw.license_number ||
      '',

    status,

    assigned_vehicle_id:
      raw.assignedVehicleId ||
      raw.assigned_vehicle_id ||
      null,

    self_reported_location:
      raw.currentLocation ||
      raw.location ||
      raw.self_reported_location ||
      null,

    trips_completed:
      typeof raw.tripsCompleted === 'number'
        ? raw.tripsCompleted
        : raw.trips_completed || 0,

    duty_start_time_str:
      (status === 'Active' || status === 'On Trip' || status === 'Assigned')
        ? (raw.dutyStartTime || raw.duty_start_time_str || (raw.duty_start_time ? String(raw.duty_start_time) : null))
        : null,

    assigned_route:
      raw.assignedRoute ||
      raw.assigned_route ||
      null,

    latitude:
      typeof raw.latitude === 'number'
        ? raw.latitude
        : (typeof raw.lat === 'number' ? raw.lat : null),

    longitude:
      typeof raw.longitude === 'number'
        ? raw.longitude
        : (typeof raw.lng === 'number' ? raw.lng : null),

    coordinatesSource:
      raw.coordinatesSource ||
      (typeof raw.latitude === 'number' ? 'LIVE_GPS' : 'UNRESOLVED'),

    isLiveGPS:
      Boolean(raw.isLiveGPS || raw.coordinatesSource === 'MOBILE_GPS' || raw.coordinatesSource === 'LIVE_GPS'),

    accuracy:
      typeof raw.accuracy === 'number' ? raw.accuracy : null,

    hubLabel:
      raw.hubLabel || null,

    locationTimestamp:
      raw.locationTimestamp ||
      raw.updatedAt ||
      null,

    raw
  };
};

export const normalizeDriverResponse = (
  response
) => {
  const items =
    extractResultList(
      response?.data || response
    );

  return items
    .map(normalizeDriver)
    .filter(Boolean);
};

// ============================================================
// TRIP NORMALIZER
// ============================================================

export const normalizeTrip = (
  raw
) => {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return null;
  }

  const id = String(
    raw.tripId ||
    raw.id ||
    raw._id ||
    ''
  );

  const source =
    raw.origin ||
    raw.source ||
    raw.from ||
    'Erode';

  const destination =
    raw.destination ||
    raw.to ||
    'Coimbatore';

  const rawStatus =
    (raw.status || 'Assigned')
      .toLowerCase();

  let status = 'Assigned';

  if (
    rawStatus === 'ongoing' ||
    rawStatus === 'on_trip' ||
    rawStatus === 'active' ||
    rawStatus === 'in_progress' ||
    rawStatus === 'in progress'
  ) {
    status = 'Ongoing';
  } else if (
    rawStatus === 'completed'
  ) {
    status = 'Completed';
  } else if (
    rawStatus === 'cancelled'
  ) {
    status = 'Cancelled';
  }

  let estimatedDuration =
    raw.estimated_duration ||
    raw.duration;

  if (
    !estimatedDuration &&
    typeof raw.estimatedDurationMinutes ===
    'number'
  ) {
    const hrs =
      Math.floor(
        raw.estimatedDurationMinutes /
        60
      );

    const mins =
      raw.estimatedDurationMinutes % 60;

    estimatedDuration =
      hrs > 0
        ? `${hrs}h ${mins}m`
        : `${mins}m`;
  }

  if (!estimatedDuration) {
    estimatedDuration = '1h 30m';
  }

  const rawWaypoints =
    raw.waypoints ||
    raw.stops ||
    raw.routeInfo?.waypoints ||
    raw.routeInfo?.stops ||
    [];

  const waypoints =
    Array.isArray(rawWaypoints)
      ? rawWaypoints
      : [];

  return {
    id,
    tripId: id,

    vehicle_id:
      raw.vehicleId ||
      raw.vehicle_id ||
      null,

    vehicle_reg:
      raw.registrationNumber ||
      raw.vehicleReg ||
      raw.vehicle_reg ||
      raw.vehicle_no ||
      'TN 33 AA 4019',

    driver_id:
      raw.driverId ||
      raw.driver_id ||
      null,

    driver_name:
      raw.driverName ||
      raw.driver_name ||
      'Assigned Driver',

    source,
    origin: source,

    destination,

    status,

    distance_km:
      raw.distanceKm ||
      raw.distance_km ||
      0,

    estimated_duration:
      estimatedDuration,

    actual_duration:
      raw.actualDurationMinutes ||
      raw.actual_duration ||
      null,

    waypoints,
    stops: waypoints,

    originCoordinates:
      raw.originCoordinates || null,

    destinationCoordinates:
      raw.destinationCoordinates || null,

    originLabel:
      raw.originLabel || source,

    destinationLabel:
      raw.destinationLabel || destination,

    routeGeometry:
      raw.routeGeometry ||
      raw.route_geometry ||
      raw.routeInfo?.routeGeometry ||
      null,

    routeInfo:
      raw.routeInfo ||
      raw.route_info ||
      null,

    start_time:
      raw.startTime ||
      raw.start_time ||
      null,

    end_time:
      raw.endTime ||
      raw.end_time ||
      null,

    raw
  };
};

export const normalizeTripResponse = (
  response
) => {
  const items =
    extractResultList(
      response?.data || response
    );

  return items
    .map(normalizeTrip)
    .filter(Boolean);
};

// ============================================================
// MAINTENANCE NORMALIZER
// ============================================================

export const normalizeMaintenance = (
  raw
) => {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return null;
  }

  return {
    id: String(
      raw.maintenanceId ||
      raw.id ||
      raw._id ||
      ''
    ),

    vehicle_id:
      raw.vehicleId ||
      raw.vehicle_id,

    maintenance_type:
      raw.maintenanceType ||
      raw.maintenance_type ||
      'Scheduled Service',

    description:
      raw.description || '',

    status:
      raw.status || 'Pending',

    priority:
      raw.priority || 'Normal',

    due_date:
      raw.dueDate ||
      raw.due_date,

    completed_date:
      raw.completedDate ||
      raw.completed_date ||
      null,

    mileage_at_service:
      raw.mileageAtService ||
      raw.mileage_at_service ||
      null,

    service_center:
      raw.serviceCenter ||
      raw.service_center ||
      'Corridor Workshop',

    cost:
      raw.cost || 0,

    raw
  };
};

export const normalizeMaintenanceResponse = (
  response
) => {
  const items =
    extractResultList(
      response?.data || response
    );

  return items
    .map(normalizeMaintenance)
    .filter(Boolean);
};

// ============================================================
// FUEL NORMALIZER
// ============================================================

export const normalizeFuel = (
  raw
) => {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return null;
  }

  return {
    id: String(
      raw.fuelRecordId ||
      raw.id ||
      raw._id ||
      ''
    ),

    vehicle_id:
      raw.vehicleId ||
      raw.vehicle_id,

    fuel_type:
      raw.fuelType ||
      raw.fuel_type ||
      'Diesel',

    fuel_level:
      typeof raw.fuelLevel === 'number'
        ? raw.fuelLevel
        : raw.fuel_level || 0,

    fuel_added_liters:
      raw.fuelAddedLiters ||
      raw.fuel_added_liters ||
      0,

    fuel_consumed_liters:
      raw.fuelConsumedLiters ||
      raw.fuel_consumed_liters ||
      0,

    fuel_efficiency:
      raw.fuelEfficiencyKmPerLiter ||
      raw.fuel_efficiency ||
      0,

    distance_km:
      raw.distanceKm ||
      raw.distance_km ||
      0,

    fuel_cost:
      raw.fuelCost ||
      raw.fuel_cost ||
      0,

    status:
      raw.status || 'Normal',

    anomaly_type:
      raw.anomalyType ||
      raw.anomaly_type ||
      null,

    anomaly_severity:
      raw.anomalySeverity ||
      raw.anomaly_severity ||
      null,

    location:
      raw.location || '',

    recorded_at:
      raw.recordedAt ||
      raw.recorded_at ||
      null,

    raw
  };
};

export const normalizeFuelResponse = (
  response
) => {
  const items =
    extractResultList(
      response?.data || response
    );

  return items
    .map(normalizeFuel)
    .filter(Boolean);
};

// ============================================================
// SAFETY NORMALIZER
// ============================================================

export const normalizeSafety = (
  raw
) => {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return null;
  }

  return {
    id: String(
      raw.alertId ||
      raw.id ||
      raw._id ||
      ''
    ),

    vehicle_id:
      raw.vehicleId ||
      raw.vehicle_id,

    driver_id:
      raw.driverId ||
      raw.driver_id,

    alert_type:
      raw.alertType ||
      raw.alert_type ||
      'General Alert',

    severity:
      raw.severity || 'Medium',

    status:
      raw.status || 'Open',

    description:
      raw.description || '',

    location:
      raw.location || '',

    speed_kmph:
      raw.speedKmph ||
      raw.speed_kmph ||
      0,

    detected_at:
      raw.detectedAt ||
      raw.detected_at ||
      null,

    resolved_at:
      raw.resolvedAt ||
      raw.resolved_at ||
      null,

    resolution_notes:
      raw.resolutionNotes ||
      raw.resolution_notes ||
      '',

    raw
  };
};

export const normalizeSafetyResponse = (
  response
) => {
  const items =
    extractResultList(
      response?.data || response
    );

  return items
    .map(normalizeSafety)
    .filter(Boolean);
};

// ============================================================
// FLEET SUMMARY NORMALIZER
// ============================================================

export const normalizeFleetSummary = (
  response
) => {
  const unwrapped =
    extractPayloadResult(response);

  if (
    !unwrapped ||
    typeof unwrapped !== 'object'
  ) {
    return null;
  }

  const root =
    Array.isArray(unwrapped)
      ? unwrapped[0] || {}
      : unwrapped;

  const res =
    root.fleetHealth ||
    root.processing ||
    root;

  const risk =
    root.risk || root;

  const hasValidMetrics =
    res.totalVehicles !== undefined ||
    res.total_vehicles !== undefined ||
    res.activeVehicles !== undefined ||
    res.active_vehicles !== undefined ||
    res.travellingVehicles !== undefined ||
    res.totalDrivers !== undefined ||
    res.total_drivers !== undefined ||
    res.totalTrips !== undefined ||
    res.total_trips !== undefined ||
    res.totalMaintenance !== undefined ||
    res.total_maintenance !== undefined;

  if (!hasValidMetrics) {
    return null;
  }

  return {
    total_vehicles:
      res.totalVehicles ??
      res.total_vehicles ??
      0,

    travelling_count:
      res.activeVehicles ??
      res.active_vehicles ??
      res.travellingVehicles ??
      res.travelling_count ??
      res.travelling ??
      0,

    idle_count:
      res.idleVehicles ??
      res.idle_count ??
      res.idle ??
      0,

    maintenance_count:
      res.maintenanceVehicles ??
      res.maintenance_count ??
      res.maintenance ??
      0,

    total_drivers:
      res.totalDrivers ??
      res.total_drivers ??
      0,

    active_drivers_today:
      res.activeDrivers ??
      res.active_drivers_today ??
      res.active_drivers ??
      0,

    available_drivers:
      res.availableDrivers ??
      res.available_drivers ??
      0,

    total_trips:
      res.totalTrips ??
      res.total_trips ??
      0,

    active_trips:
      res.activeTrips ??
      res.active_trips ??
      (res.totalTrips !== undefined && res.completedTrips !== undefined ? Math.max(res.totalTrips - res.completedTrips, 0) : 0),

    completed_trips:
      res.completedTrips ??
      res.completed_trips ??
      0,

    total_maintenance:
      res.totalMaintenance ??
      res.total_maintenance ??
      0,

    due_maintenance:
      res.dueMaintenance ??
      res.due_maintenance ??
      0,

    high_priority_maintenance:
      res.highPriorityMaintenance ??
      res.high_priority_maintenance ??
      0,

    fuel_records:
      res.totalFuelRecords ??
      res.fuelRecords ??
      res.fuel_records ??
      0,

    fuel_anomalies:
      res.fuelAnomalies ??
      res.fuel_anomalies ??
      0,

    critical_fuel_anomalies:
      res.criticalFuelAnomalies ??
      res.critical_fuel_anomalies ??
      0,

    safety_alerts:
      res.totalSafetyAlerts ??
      res.safetyAlerts ??
      res.safety_alerts ??
      0,

    open_alerts:
      res.openSafetyAlerts ??
      res.openAlerts ??
      res.open_alerts ??
      0,

    high_alerts:
      res.highSafetyAlerts ??
      res.highAlerts ??
      res.high_alerts ??
      0,

    critical_alerts:
      res.criticalSafetyAlerts ??
      res.criticalAlerts ??
      res.critical_alerts ??
      0,

    risk_level:
      risk.level ||
      risk.overallFleetRisk ||
      res.riskLevel ||
      res.risk_level ||
      'Low',

    risk_indicators:
      Array.isArray(risk.indicators)
        ? risk.indicators
        : res.risk_indicators || [],

    raw: root
  };
};

// ============================================================
// FLEET ANALYSIS NORMALIZER
// ============================================================

export const normalizeFleetAnalysis = (
  response
) => {
  const unwrapped =
    extractPayloadResult(response) || {};

  const root =
    Array.isArray(unwrapped)
      ? unwrapped[0] || {}
      : unwrapped;

  const rates =
    root.rates || root;

  return {
    utilization_rate:
      rates.utilizationRate ??
      rates.utilization_rate ??
      '0%',

    trip_completion_rate:
      rates.tripCompletionRate ??
      rates.trip_completion_rate ??
      '0%',

    maintenance_due_rate:
      rates.maintenanceDueRate ??
      rates.maintenance_due_rate ??
      '0%',

    fuel_anomaly_rate:
      rates.fuelAnomalyRate ??
      rates.fuel_anomaly_rate ??
      '0%',

    safety_alert_rate:
      rates.safetyAlertRate ??
      rates.safety_alert_rate ??
      '0%',

    strengths:
      Array.isArray(root.strengths)
        ? root.strengths
        : [],

    concerns:
      Array.isArray(root.concerns)
        ? root.concerns
        : [],

    recommendations:
      Array.isArray(root.recommendations)
        ? root.recommendations
        : [],

    raw: root
  };
};

// ============================================================
// ROUTE RESPONSE NORMALIZER
// ============================================================

export const normalizeRouteResponse = (
  response
) => {
  const unwrapped =
    extractPayloadResult(response) || {};

  const result =
    Array.isArray(unwrapped)
      ? unwrapped[0] || {}
      : unwrapped;

  return {
    map_image:
      result.map_image ||
      result.mapImage ||
      result.image ||
      null,

    estimated_duration:
      result.estimated_duration ||
      result.estimatedDuration ||
      '1h 00m',

    distance_km:
      result.distance_km ||
      result.distanceKm ||
      0,

    route_geometry:
      result.route_geometry ||
      result.geometry ||
      null,

    message:
      response?.message ||
      'Route computed successfully'
  };
};

// ============================================================
// VEHICLE & DRIVER ONBOARDING MUTATIONS
// ============================================================

export const createVehicleApi = async (vehicleData) => {
  try {
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('fleet_token') || localStorage.getItem('fleet_token')) : null;
    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(vehicleData),
      signal: AbortSignal.timeout(15000)
    });

    const json = await res.json();
    if (!res.ok || json.success === false) {
      return {
        success: false,
        error: json.error || json.message || 'Failed to create vehicle record.'
      };
    }

    return {
      success: true,
      data: json.data || json,
      message: json.message || 'Vehicle created successfully.'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Network error while creating vehicle.'
    };
  }
};

export const createDriverApi = async (driverData) => {
  try {
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('fleet_token') || localStorage.getItem('fleet_token')) : null;
    const res = await fetch('/api/drivers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(driverData),
      signal: AbortSignal.timeout(15000)
    });

    const json = await res.json();
    if (!res.ok || json.success === false) {
      return {
        success: false,
        error: json.error || json.message || 'Failed to create driver record.'
      };
    }

    return {
      success: true,
      data: json.data || json,
      message: json.message || 'Driver created successfully.'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Network error while creating driver.'
    };
  }
};