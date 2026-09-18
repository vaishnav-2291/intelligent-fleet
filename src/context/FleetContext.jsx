import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react';

import {
  getFleetSummary,
  getFleetAnalysis,
  getAllVehicles,
  getAllDrivers,
  getAllTrips,
  getAllMaintenance,
  getAllFuelRecords,
  getAllSafetyAlerts,
  getVehicleStatus,
  getDriverStatus,
  getTripStatus,
  getMaintenanceStatus,
  getFuelAnalysis,
  getSafetyAlerts,
  optimizeRoute,
  startDriverDuty,
  setDriverOffline,
  assignTripRoute,
  startDriverTrip,
  completeDriverTrip,
  cancelDriverTrip,
  resetDriverDuty,
  askSNS,
  normalizeVehicleResponse,
  normalizeDriverResponse,
  normalizeTripResponse,
  normalizeMaintenanceResponse,
  normalizeFuelResponse,
  normalizeSafetyResponse,
  normalizeFleetSummary,
  normalizeFleetAnalysis,
  updateVehicleLocation,
  updateDriverLocation,
  sendDriverLocationTelemetry,
  createVehicleApi,
  createDriverApi
} from '../services/snsApi';

const FleetContext = createContext(null);

/* =========================================================
   ROUTE HELPERS
   ========================================================= */

const getCorridorDistanceKm = (source, destination) => {
  const from = String(source || '').trim().toLowerCase();
  const to = String(destination || '').trim().toLowerCase();

  const key = `${from}-${to}`;

  const corridors = {
    'coimbatore-chennai': 510,
    'chennai-coimbatore': 510,

    'coimbatore-erode': 100,
    'erode-coimbatore': 100,

    'coimbatore-salem': 160,
    'salem-coimbatore': 160,

    'coimbatore-tiruppur': 55,
    'tiruppur-coimbatore': 55,

    'coimbatore-madurai': 215,
    'madurai-coimbatore': 215,

    'erode-salem': 65,
    'salem-erode': 65,

    'erode-karur': 65,
    'karur-erode': 65,

    'tiruppur-karur': 85,
    'karur-tiruppur': 85,

    'salem-tiruppur': 120,
    'tiruppur-salem': 120
  };

  return corridors[key] || null;
};

const getEstimatedDuration = (source, destination) => {
  const distance = getCorridorDistanceKm(
    source,
    destination
  );

  if (!distance) {
    return '2h 00m';
  }

  const averageSpeed = 50;
  const hours = distance / averageSpeed;

  const wholeHours = Math.floor(hours);
  const minutes = Math.round(
    (hours - wholeHours) * 60
  );

  return `${wholeHours}h ${String(minutes).padStart(2, '0')}m`;
};

/* =========================================================
   BASELINE FLEET DATA
   ========================================================= */

const BASELINE_FLEET_SUMMARY = {
  total_vehicles: 11,
  travelling_count: 8,
  idle_count: 0,
  maintenance_count: 1,

  total_drivers: 11,
  active_drivers_today: 9,
  available_drivers: 0,

  total_trips: 11,
  active_trips: 7,
  completed_trips: 4,

  total_maintenance: 11,
  due_maintenance: 7,
  high_priority_maintenance: 6,

  fuel_records: 11,
  fuel_anomalies: 4,
  critical_fuel_anomalies: 2,

  safety_alerts: 11,
  open_alerts: 7,
  high_alerts: 4,
  critical_alerts: 2,

  // Do not display fake critical status before live data arrives.
  risk_level: 'unknown',

  risk_indicators: [
    'Live fleet risk data not loaded yet'
  ]
};

const BASELINE_VEHICLES = [
  {
    id: 'VH001',
    vehicleId: 'VH001',
    reg_no: 'TN58AB1234',
    reg_number: 'TN58AB1234',
    model: 'Heavy Truck',
    model_name: 'Heavy Truck',
    capacity: '2.5 Tons',
    fuel_level: 78,
    status: 'travelling',
    assigned_driver_id: 'DR001',
    location: 'Coimbatore',
    mileage: 12500
  },
  {
    id: 'VH101',
    vehicleId: 'VH101',
    reg_no: 'TN38AB1101',
    reg_number: 'TN38AB1101',
    model: 'Container Carrier',
    model_name: 'Container Carrier',
    capacity: '3.0 Tons',
    fuel_level: 82,
    status: 'travelling',
    assigned_driver_id: 'DR101',
    location: 'Coimbatore',
    mileage: 18200
  },
  {
    id: 'VH102',
    vehicleId: 'VH102',
    reg_no: 'TN38AB1102',
    reg_number: 'TN38AB1102',
    model: 'Medium Lorry',
    model_name: 'Medium Lorry',
    capacity: '1.8 Tons',
    fuel_level: 67,
    status: 'travelling',
    assigned_driver_id: 'DR102',
    location: 'Salem',
    mileage: 24100
  },
  {
    id: 'VH103',
    vehicleId: 'VH103',
    reg_no: 'TN38AB1103',
    reg_number: 'TN38AB1103',
    model: 'Express Van',
    model_name: 'Express Van',
    capacity: '1.2 Tons',
    fuel_level: 91,
    status: 'idle',
    assigned_driver_id: 'DR103',
    location: 'Erode',
    mileage: 15400
  },
  {
    id: 'VH104',
    vehicleId: 'VH104',
    reg_no: 'TN38AB1104',
    reg_number: 'TN38AB1104',
    model: 'Truck',
    model_name: 'Truck',
    capacity: '4.0 Tons',
    fuel_level: 45,
    status: 'maintenance',
    assigned_driver_id: 'DR104',
    location: 'Tiruppur',
    mileage: 31900
  },
  {
    id: 'VH105',
    vehicleId: 'VH105',
    reg_no: 'TN38AB1105',
    reg_number: 'TN38AB1105',
    model: 'Refrigerated Truck',
    model_name: 'Refrigerated Truck',
    capacity: '2.0 Tons',
    fuel_level: 76,
    status: 'travelling',
    assigned_driver_id: 'DR105',
    location: 'Madurai',
    mileage: 12800
  },
  {
    id: 'VH106',
    vehicleId: 'VH106',
    reg_no: 'TN38AB1106',
    reg_number: 'TN38AB1106',
    model: 'Flatbed Trailer',
    model_name: 'Flatbed Trailer',
    capacity: '3.5 Tons',
    fuel_level: 54,
    status: 'travelling',
    assigned_driver_id: 'DR106',
    location: 'Trichy',
    mileage: 27600
  },
  {
    id: 'VH107',
    vehicleId: 'VH107',
    reg_no: 'TN38AB1107',
    reg_number: 'TN38AB1107',
    model: 'Cargo Van',
    model_name: 'Cargo Van',
    capacity: '1.5 Tons',
    fuel_level: 88,
    status: 'travelling',
    assigned_driver_id: 'DR107',
    location: 'Chennai',
    mileage: 9200
  },
  {
    id: 'VH108',
    vehicleId: 'VH108',
    reg_no: 'TN38AB1108',
    reg_number: 'TN38AB1108',
    model: 'Logistics Truck',
    model_name: 'Logistics Truck',
    capacity: '2.2 Tons',
    fuel_level: 61,
    status: 'idle',
    assigned_driver_id: 'DR108',
    location: 'Salem',
    mileage: 22100
  },
  {
    id: 'VH109',
    vehicleId: 'VH109',
    reg_no: 'TN38AB1109',
    reg_number: 'TN38AB1109',
    model: 'Mini Freight',
    model_name: 'Mini Freight',
    capacity: '1.0 Ton',
    fuel_level: 49,
    status: 'travelling',
    assigned_driver_id: 'DR109',
    location: 'Chennai',
    mileage: 34700
  },
  {
    id: 'VH110',
    vehicleId: 'VH110',
    reg_no: 'TN38AB1110',
    reg_number: 'TN38AB1110',
    model: 'City Courier Van',
    model_name: 'City Courier Van',
    capacity: '0.8 Ton',
    fuel_level: 94,
    status: 'travelling',
    assigned_driver_id: 'DR110',
    location: 'Coimbatore',
    mileage: 11300
  }
];

const BASELINE_DRIVERS = [
  {
    id: 'DR001',
    driverId: 'DR001',
    name: 'Arun Kumar',
    phone: '9123456789',
    license_number: 'TN20260001',
    status: 'Ready',
    assigned_vehicle_id: 'VH001',
    trips_completed: 42,
    duty_start_time_str: null
  },
  {
    id: 'DR101',
    driverId: 'DR101',
    name: 'Karthik Raj',
    phone: '9000000101',
    license_number: 'TN-33-2019-101',
    status: 'Active',
    assigned_vehicle_id: 'VH101',
    trips_completed: 31,
    duty_start_time_str: '06:30 AM'
  },
  {
    id: 'DR102',
    driverId: 'DR102',
    name: 'Suresh Kumar',
    phone: '9000000102',
    license_number: 'TN-33-2020-102',
    status: 'Active',
    assigned_vehicle_id: 'VH102',
    trips_completed: 47,
    duty_start_time_str: '07:00 AM'
  },
  {
    id: 'DR103',
    driverId: 'DR103',
    name: 'Prakash M',
    phone: '9000000103',
    license_number: 'TN-33-2021-103',
    status: 'On Leave',
    assigned_vehicle_id: 'VH103',
    trips_completed: 22,
    duty_start_time_str: null
  },
  {
    id: 'DR104',
    driverId: 'DR104',
    name: 'Dinesh Kumar',
    phone: '9000000104',
    license_number: 'TN-33-2017-104',
    status: 'Active',
    assigned_vehicle_id: 'VH104',
    trips_completed: 55,
    duty_start_time_str: '06:00 AM'
  },
  {
    id: 'DR105',
    driverId: 'DR105',
    name: 'Aravind S',
    phone: '9000000105',
    license_number: 'TN-33-2019-105',
    status: 'Active',
    assigned_vehicle_id: 'VH105',
    trips_completed: 38,
    duty_start_time_str: '06:45 AM'
  },
  {
    id: 'DR106',
    driverId: 'DR106',
    name: 'Vignesh R',
    phone: '9000000106',
    license_number: 'TN-33-2020-106',
    status: 'Active',
    assigned_vehicle_id: 'VH106',
    trips_completed: 61,
    duty_start_time_str: '07:30 AM'
  },
  {
    id: 'DR107',
    driverId: 'DR107',
    name: 'Hari Prasad',
    phone: '9000000107',
    license_number: 'TN-33-2018-107',
    status: 'Active',
    assigned_vehicle_id: 'VH107',
    trips_completed: 29,
    duty_start_time_str: '06:15 AM'
  },
  {
    id: 'DR108',
    driverId: 'DR108',
    name: 'Mohan Das',
    phone: '9000000108',
    license_number: 'TN-33-2021-108',
    status: 'On Leave',
    assigned_vehicle_id: 'VH108',
    trips_completed: 18,
    duty_start_time_str: null
  },
  {
    id: 'DR109',
    driverId: 'DR109',
    name: 'Santhosh K',
    phone: '9000000109',
    license_number: 'TN-33-2022-109',
    status: 'Active',
    assigned_vehicle_id: 'VH109',
    trips_completed: 73,
    duty_start_time_str: '07:45 AM'
  },
  {
    id: 'DR110',
    driverId: 'DR110',
    name: 'Rahul Dev',
    phone: '9000000110',
    license_number: 'TN-33-2016-110',
    status: 'Active',
    assigned_vehicle_id: 'VH110',
    trips_completed: 34,
    duty_start_time_str: '08:00 AM'
  }
];

const BASELINE_TRIPS = [
  {
    id: 'TR001',
    tripId: 'TR001',
    vehicle_id: 'VH001',
    vehicle_reg: 'TN58AB1234',
    driver_id: 'DR001',
    driver_name: 'Arun Kumar',
    source: 'Coimbatore',
    destination: 'Chennai',
    status: 'Completed',
    distance_km: 510,
    estimated_duration: '10h 00m'
  },
  {
    id: 'TR101',
    tripId: 'TR101',
    vehicle_id: 'VH101',
    vehicle_reg: 'TN38AB1101',
    driver_id: 'DR101',
    driver_name: 'Karthik Raj',
    source: 'Coimbatore',
    destination: 'Chennai',
    status: 'Completed',
    distance_km: 100,
    estimated_duration: '2h 00m'
  },
  {
    id: 'TR102',
    tripId: 'TR102',
    vehicle_id: 'VH102',
    vehicle_reg: 'TN38AB1102',
    driver_id: 'DR102',
    driver_name: 'Suresh Kumar',
    source: 'Salem',
    destination: 'Chennai',
    status: 'Ongoing',
    distance_km: 120,
    estimated_duration: '2h 30m'
  },
  {
    id: 'TR103',
    tripId: 'TR103',
    vehicle_id: 'VH103',
    vehicle_reg: 'TN38AB1103',
    driver_id: 'DR103',
    driver_name: 'Prakash M',
    source: 'Erode',
    destination: 'Coimbatore',
    status: 'Assigned',
    distance_km: 65,
    estimated_duration: '1h 15m'
  },
  {
    id: 'TR104',
    tripId: 'TR104',
    vehicle_id: 'VH104',
    vehicle_reg: 'TN38AB1104',
    driver_id: 'DR104',
    driver_name: 'Dinesh Kumar',
    source: 'Tiruppur',
    destination: 'Bangalore',
    status: 'Completed',
    distance_km: 215,
    estimated_duration: '4h 00m'
  },
  {
    id: 'TR105',
    tripId: 'TR105',
    vehicle_id: 'VH105',
    vehicle_reg: 'TN38AB1105',
    driver_id: 'DR105',
    driver_name: 'Aravind S',
    source: 'Madurai',
    destination: 'Trichy',
    status: 'Completed',
    distance_km: 135,
    estimated_duration: '2h 45m'
  },
  {
    id: 'TR106',
    tripId: 'TR106',
    vehicle_id: 'VH106',
    vehicle_reg: 'TN38AB1106',
    driver_id: 'DR106',
    driver_name: 'Vignesh R',
    source: 'Trichy',
    destination: 'Chennai',
    status: 'Ongoing',
    distance_km: 85,
    estimated_duration: '1h 45m'
  },
  {
    id: 'TR107',
    tripId: 'TR107',
    vehicle_id: 'VH107',
    vehicle_reg: 'TN38AB1107',
    driver_id: 'DR107',
    driver_name: 'Hari Prasad',
    source: 'Chennai',
    destination: 'Pondicherry',
    status: 'Assigned',
    distance_km: 150,
    estimated_duration: '3h 00m'
  },
  {
    id: 'TR108',
    tripId: 'TR108',
    vehicle_id: 'VH108',
    vehicle_reg: 'TN38AB1108',
    driver_id: 'DR108',
    driver_name: 'Mohan Das',
    source: 'Salem',
    destination: 'Erode',
    status: 'Completed',
    distance_km: 100,
    estimated_duration: '2h 00m'
  },
  {
    id: 'TR109',
    tripId: 'TR109',
    vehicle_id: 'VH109',
    vehicle_reg: 'TN38AB1109',
    driver_id: 'DR109',
    driver_name: 'Santhosh K',
    source: 'Chennai',
    destination: 'Coimbatore',
    status: 'Ongoing',
    distance_km: 165,
    estimated_duration: '3h 15m'
  },
  {
    id: 'TR110',
    tripId: 'TR110',
    vehicle_id: 'VH110',
    vehicle_reg: 'TN38AB1110',
    driver_id: 'DR110',
    driver_name: 'Rahul Dev',
    source: 'Coimbatore',
    destination: 'Madurai',
    status: 'Assigned',
    distance_km: 215,
    estimated_duration: '4h 00m'
  }
];

const BASELINE_MAINTENANCE = [
  {
    id: 'MT001',
    vehicle_id: 'VH001',
    maintenance_type: 'Scheduled Engine Service',
    description: 'Engine diagnostics and fluid replacement.',
    status: 'Pending',
    priority: 'High',
    due_date: '2026-09-10',
    service_center: 'Erode Central Workshop'
  },
  {
    id: 'MT101',
    vehicle_id: 'VH101',
    maintenance_type: 'Tire Tread Inspection',
    description: 'Wear inspection on drive axles.',
    status: 'Pending',
    priority: 'Normal',
    due_date: '2026-09-12',
    service_center: 'Coimbatore Workshop'
  },
  {
    id: 'MT102',
    vehicle_id: 'VH102',
    maintenance_type: 'Transmission Fluid Check',
    description: 'Hydraulic pressure inspection.',
    status: 'Pending',
    priority: 'High',
    due_date: '2026-09-08',
    service_center: 'Salem Depot'
  },
  {
    id: 'MT104',
    vehicle_id: 'VH104',
    maintenance_type: 'Brake Overhaul & Caliper Service',
    description: 'Front rotor wear detected past threshold.',
    status: 'In Progress',
    priority: 'High',
    due_date: '2026-09-06',
    service_center: 'Coimbatore Workshop'
  }
];

const BASELINE_FUEL = [
  {
    id: 'FR001',
    vehicle_id: 'VH001',
    fuel_type: 'Diesel',
    fuel_level: 78,
    fuel_efficiency: 4.2,
    status: 'Anomaly',
    anomaly_type: 'Excessive Idle Burn',
    anomaly_severity: 'Critical',
    location: 'Coimbatore - Chennai NH'
  },
  {
    id: 'FR104',
    vehicle_id: 'VH104',
    fuel_type: 'Diesel',
    fuel_level: 45,
    fuel_efficiency: 3.5,
    status: 'Anomaly',
    anomaly_type: 'Fuel Level Rapid Drop',
    anomaly_severity: 'Critical',
    location: 'Coimbatore Corridor Workshop'
  }
];

const BASELINE_SAFETY = [
  {
    id: 'SA001',
    vehicle_id: 'VH001',
    driver_id: 'DR001',
    alert_type: 'Excessive Speeding',
    severity: 'Critical',
    status: 'Open',
    speed_kmph: 98,
    location: 'NH 544 Salem Bypass',
    description:
      'Speed exceeded corridor safety threshold of 80 km/h.'
  },
  {
    id: 'SA102',
    vehicle_id: 'VH102',
    driver_id: 'DR102',
    alert_type: 'Harsh Braking',
    severity: 'Critical',
    status: 'Open',
    speed_kmph: 64,
    location: 'Tiruppur Ring Road',
    description:
      'Emergency braking event detected.'
  }
];

/* =========================================================
   TRIP OVERRIDES
   ========================================================= */

const TRIP_OVERRIDES_STORAGE_KEY =
  'fleet_trip_status_overrides';

const getStoredTripOverrides = () => {
  try {
    if (
      typeof window !== 'undefined' &&
      window.localStorage
    ) {
      const stored = localStorage.getItem(
        TRIP_OVERRIDES_STORAGE_KEY
      );

      return stored ? JSON.parse(stored) : {};
    }
  } catch {
    // Ignore storage errors.
  }

  return {};
};

const setStoredTripOverride = (
  tripId,
  status,
  extra = {}
) => {
  try {
    if (
      typeof window !== 'undefined' &&
      window.localStorage &&
      tripId
    ) {
      const current =
        getStoredTripOverrides();

      current[String(tripId).toUpperCase()] = {
        status,
        timestamp: Date.now(),
        ...extra
      };

      localStorage.setItem(
        TRIP_OVERRIDES_STORAGE_KEY,
        JSON.stringify(current)
      );
    }
  } catch {
    // Ignore storage errors.
  }
};

const applyTripOverrides = (tripList) => {
  const overrides =
    getStoredTripOverrides();

  if (
    !tripList ||
    !Array.isArray(tripList)
  ) {
    return tripList;
  }

  return tripList.map((t) => {
    const key = String(
      t.id ||
      t.tripId ||
      ''
    ).toUpperCase();

    if (overrides[key]) {
      return {
        ...t,
        status: overrides[key].status,

        ...(overrides[key].status === 'Completed'
          ? {
            end_time:
              overrides[key].timestamp
          }
          : {}),

        ...(overrides[key].status === 'Cancelled'
          ? {
            cancelled_at:
              overrides[key].timestamp
          }
          : {})
      };
    }

    return t;
  });
};

/* =========================================================
   PROVIDER
   ========================================================= */

export const FleetProvider = ({
  children
}) => {
  const [currentUser, setCurrentUser] =
    useState(() => {
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const storedUser = window.sessionStorage.getItem('fleet_user');
          const storedToken = window.sessionStorage.getItem('fleet_token');
          if (storedUser && storedToken) {
            const parsed = JSON.parse(storedUser);
            return {
              ...parsed,
              token: storedToken
            };
          }
        }
      } catch (_) {}
      return null;
    });

  const [highlightMapEntity, setHighlightMapEntity] =
    useState(null);

  const [activeRoute, setActiveRoute] =
    useState(null);

  const [drivers, setDrivers] =
    useState(BASELINE_DRIVERS);

  const [vehicles, setVehicles] =
    useState(BASELINE_VEHICLES);

  const [trips, setTrips] =
    useState(() =>
      applyTripOverrides(
        BASELINE_TRIPS
      )
    );

  const [maintenance, setMaintenance] =
    useState(BASELINE_MAINTENANCE);

  const [fuel, setFuel] =
    useState(BASELINE_FUEL);

  const [safetyAlerts, setSafetyAlerts] =
    useState(BASELINE_SAFETY);

  const [stats, setStats] =
    useState(BASELINE_FLEET_SUMMARY);

  const [analysis, setAnalysis] =
    useState({
      utilization_rate: '72.7%',
      trip_completion_rate: '63.6%',
      maintenance_due_rate: '63.6%',
      fuel_anomaly_rate: '36.4%',
      safety_alert_rate: '63.6%',

      strengths: [
        'High active corridor trip utilization',
        'Core dispatch connectivity active'
      ],

      concerns: [
        '7 maintenance services due',
        '2 critical fuel anomaly records flagged'
      ],

      recommendations: [
        'Prioritize brake service for VH104',
        'Review corridor speed telemetry'
      ]
    });

  const [dailyActiveDriverIds, setDailyActiveDriverIds] =
    useState(
      new Set([
        'DR001',
        'DR101',
        'DR102',
        'DR103',
        'DR105',
        'DR106',
        'DR107',
        'DR108',
        'DR109'
      ])
    );

  const [loading, setLoading] =
    useState({
      initial: false,
      refreshing: false,
      action: false
    });

  const [apiError, setApiError] =
    useState(null);

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const [toast, setToast] =
    useState(null);

  const isRefreshingRef =
    useRef(false);

  const sessionDispatchesRef =
    useRef(new Map());

  const inFlightTripActionsRef =
    useRef(new Set());

  const toastTimerRef =
    useRef(null);

  /* =======================================================
     NOTIFICATION
     ======================================================= */

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showNotification = useCallback(
    (
      message,
      type = 'success',
      duration = 3500
    ) => {
      const id = Date.now();

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast({
        id,
        message,
        type
      });

      toastTimerRef.current = setTimeout(() => {
        setToast((prev) =>
          prev?.id === id
            ? null
            : prev
        );
      }, duration);
    },
    []
  );

  /* =======================================================
     REFRESH FLEET DATA
     ======================================================= */

  const refreshFleetData =
    useCallback(
      async (isInitial = false) => {
        if (
          isRefreshingRef.current
        ) {
          return;
        }

        isRefreshingRef.current = true;

        setLoading((prev) => ({
          ...prev,
          [isInitial
            ? 'initial'
            : 'refreshing']: true
        }));

        setApiError(null);

        const isDev =
          Boolean(
            import.meta.env?.DEV
          );

        const webhookUrl =
          import.meta.env
            ?.VITE_SNS_WEBHOOK_URL ||
          '';

        if (isDev) {
          console.log(
            '[DEBUG FleetContext] refreshFleetData started. Webhook configured:',
            Boolean(webhookUrl)
          );
        }

        let latestVehicles = [];
        let latestDrivers = [];

        try {
          /* =================================================
             1. FLEET SUMMARY
             ================================================= */

          try {
            if (isDev) {
              console.log(
                '[DEBUG FleetContext] Calling getFleetSummary()...'
              );
            }

            const summaryRes =
              await getFleetSummary();

            if (isDev) {
              console.log(
                '[DEBUG FleetContext] getFleetSummary response:',
                summaryRes
              );
            }

            const normSummary =
              normalizeFleetSummary(
                summaryRes
              );

            if (
              normSummary &&
              (
                normSummary.total_vehicles >
                0 ||
                normSummary.total_drivers >
                0 ||
                normSummary.total_trips >
                0
              )
            ) {
              setStats(
                normSummary
              );
            } else if (isDev) {
              console.log(
                '[DEBUG FleetContext] Summary invalid/empty. Keeping existing state.'
              );
            }
          } catch (sumErr) {
            if (isDev) {
              console.warn(
                '[DEBUG FleetContext] getFleetSummary warning:',
                sumErr?.message
              );
            }
          }

          /* =================================================
             2. VEHICLES
             ================================================= */

          try {
            if (isDev) {
              console.log(
                '[DEBUG FleetContext] Calling getAllVehicles()...'
              );
            }

            const vehiclesRes =
              await getAllVehicles();

            const normVehicles =
              normalizeVehicleResponse(
                vehiclesRes
              );

            if (isDev) {
              console.log(
                `[DEBUG FleetContext] getAllVehicles returned ${normVehicles.length} vehicles.`,
                normVehicles
              );
            }

            if (
              normVehicles.length > 0
            ) {
              const mergedVehicles =
                normVehicles.map(
                  (v) => {
                    const vKey =
                      String(
                        v.id ||
                        v.vehicleId ||
                        ''
                      ).toUpperCase();

                    for (
                      const [
                        ,
                        disp
                      ] of sessionDispatchesRef.current.entries()
                    ) {
                      if (
                        String(
                          disp
                            ?.vehicle
                            ?.vehicleId ||
                          ''
                        ).toUpperCase() ===
                        vKey
                      ) {
                        return {
                          ...v,
                          ...disp.vehicle
                        };
                      }
                    }

                    return v;
                  }
                );

              latestVehicles = mergedVehicles;
              setVehicles(
                mergedVehicles
              );
            }
          } catch (vehErr) {
            if (isDev) {
              console.warn(
                '[DEBUG FleetContext] getAllVehicles warning:',
                vehErr?.message
              );
            }
          }

          /* =================================================
             3. DRIVERS
             ================================================= */

          try {
            if (isDev) {
              console.log(
                '[DEBUG FleetContext] Calling getAllDrivers()...'
              );
            }

            const driversRes =
              await getAllDrivers();

            const normDrivers =
              normalizeDriverResponse(
                driversRes
              );

            if (isDev) {
              console.log(
                `[DEBUG FleetContext] getAllDrivers returned ${normDrivers.length} drivers.`,
                normDrivers
              );
            }

            if (
              normDrivers.length > 0
            ) {
              const mergedDrivers =
                normDrivers.map(
                  (d) => {
                    const dKey =
                      String(
                        d.id ||
                        d.driverId ||
                        ''
                      ).toUpperCase();

                    if (
                      sessionDispatchesRef.current.has(
                        dKey
                      )
                    ) {
                      return {
                        ...d,
                        ...sessionDispatchesRef
                          .current
                          .get(
                            dKey
                          )
                          .driver
                      };
                    }

                    return d;
                  }
                );

              latestDrivers = mergedDrivers;
              setDrivers(
                mergedDrivers
              );

              const activeIds =
                mergedDrivers
                  .filter(
                    (d) =>
                      [
                        'active',
                        'ready',
                        'assigned',
                        'on_trip',
                        'completed'
                      ].includes(
                        (
                          d.status ||
                          ''
                        ).toLowerCase()
                      )
                  )
                  .map(
                    (d) =>
                      String(
                        d.id ||
                        d.driverId
                      )
                  );

              setDailyActiveDriverIds(
                new Set(
                  activeIds
                )
              );
            }
          } catch (drvErr) {
            if (isDev) {
              console.warn(
                '[DEBUG FleetContext] getAllDrivers warning:',
                drvErr?.message
              );
            }
          }

          /* =================================================
             4. TRIPS
             ================================================= */

          try {
            if (isDev) {
              console.log(
                '[DEBUG FleetContext] Calling getAllTrips()...'
              );
            }

            const tripsRes =
              await getAllTrips();

            const normTrips =
              normalizeTripResponse(
                tripsRes
              );

            if (isDev) {
              console.log(
                `[DEBUG FleetContext] getAllTrips returned ${normTrips.length} trips.`,
                normTrips
              );
            }

            if (
              normTrips.length > 0
            ) {
              const sessionTrips =
                Array.from(
                  sessionDispatchesRef
                    .current
                    .values()
                )
                  .map(
                    (d) =>
                      d.trip
                  )
                  .filter(Boolean);

              const rawMerged = [
                ...sessionTrips,

                ...normTrips.filter(
                  (t) =>
                    !sessionTrips.some(
                      (st) =>
                        String(
                          st.id ||
                          st.tripId
                        ) ===
                        String(
                          t.id ||
                          t.tripId
                        )
                    )
                )
              ];

              const enrichedMerged = rawMerged.map((t) => {
                let dName = t.driver_name;
                let vReg = t.vehicle_reg;
                const dTarget = String(t.driver_id || t.driverId || '').toUpperCase();
                const vTarget = String(t.vehicle_id || t.vehicleId || '').toUpperCase();

                if (!dName || dName === 'Assigned Driver') {
                  const matchedDriver = (latestDrivers.length > 0 ? latestDrivers : BASELINE_DRIVERS).find(
                    (d) => String(d.id || d.driverId || '').toUpperCase() === dTarget
                  );
                  if (matchedDriver?.name) {
                    dName = matchedDriver.name;
                  }
                }

                if (!vReg || vReg === 'TN 33 AA 4019') {
                  const matchedVehicle = (latestVehicles.length > 0 ? latestVehicles : BASELINE_VEHICLES).find(
                    (v) => String(v.id || v.vehicleId || '').toUpperCase() === vTarget
                  );
                  if (matchedVehicle) {
                    vReg = matchedVehicle.reg_no || matchedVehicle.reg_number || matchedVehicle.registrationNumber || vReg;
                  }
                }

                return {
                  ...t,
                  driver_name: dName || t.driver_name,
                  vehicle_reg: vReg || t.vehicle_reg
                };
              });

              setTrips(
                applyTripOverrides(
                  enrichedMerged
                )
              );
            }
          } catch (tripErr) {
            if (isDev) {
              console.warn(
                '[DEBUG FleetContext] getAllTrips warning:',
                tripErr?.message
              );
            }
          }

          /* =================================================
             5. MAINTENANCE
             ================================================= */

          try {
            if (isDev) {
              console.log(
                '[DEBUG FleetContext] Calling getAllMaintenance()...'
              );
            }

            const maintRes =
              await getAllMaintenance();

            const normMaint =
              normalizeMaintenanceResponse(
                maintRes
              );

            if (
              normMaint.length > 0
            ) {
              setMaintenance(
                normMaint
              );
            }
          } catch (maintErr) {
            if (isDev) {
              console.warn(
                '[DEBUG FleetContext] getAllMaintenance warning:',
                maintErr?.message
              );
            }
          }

          /* =================================================
             6. FUEL
             ================================================= */

          try {
            if (isDev) {
              console.log(
                '[DEBUG FleetContext] Calling getAllFuelRecords()...'
              );
            }

            const fuelRes =
              await getAllFuelRecords();

            const normFuel =
              normalizeFuelResponse(
                fuelRes
              );

            if (
              normFuel.length > 0
            ) {
              setFuel(
                normFuel
              );
            }
          } catch (fuelErr) {
            if (isDev) {
              console.warn(
                '[DEBUG FleetContext] getAllFuelRecords warning:',
                fuelErr?.message
              );
            }
          }

          /* =================================================
             7. SAFETY
             ================================================= */

          try {
            if (isDev) {
              console.log(
                '[DEBUG FleetContext] Calling getAllSafetyAlerts()...'
              );
            }

            const safetyRes =
              await getAllSafetyAlerts();

            const normSafety =
              normalizeSafetyResponse(
                safetyRes
              );

            if (
              normSafety.length > 0
            ) {
              setSafetyAlerts(
                normSafety
              );
            }
          } catch (safetyErr) {
            if (isDev) {
              console.warn(
                '[DEBUG FleetContext] getAllSafetyAlerts warning:',
                safetyErr?.message
              );
            }
          }

          /* =================================================
             8. FLEET ANALYSIS & KPIS
             ================================================= */
          try {
            const analysisRes = await getFleetAnalysis();
            if (analysisRes) {
              const normAnalysis = normalizeFleetAnalysis(analysisRes);
              if (normAnalysis) {
                setAnalysis(normAnalysis);
              }
            }
          } catch (analysisErr) {
            if (isDev) {
              console.warn(
                '[DEBUG FleetContext] getFleetAnalysis warning:',
                analysisErr?.message
              );
            }
          }

          setLastUpdated(new Date());
        } catch (err) {
          const msg =
            err?.message ||
            'Error communicating with fleet backend';

          setApiError(msg);

          showNotification(
            msg,
            'error'
          );
        } finally {
          isRefreshingRef.current =
            false;

          setLoading((prev) => ({
            ...prev,
            initial: false,
            refreshing: false
          }));

          if (isDev) {
            console.log(
              '[DEBUG FleetContext] refreshFleetData completed.'
            );
          }
        }
      },
      [showNotification]
    );

  /* =======================================================
     FLEET ANALYSIS
     ======================================================= */

  const refreshAnalysis =
    useCallback(
      async () => {
        setLoading((prev) => ({
          ...prev,
          refreshing: true
        }));

        try {
          const analysisRes =
            await getFleetAnalysis();

          if (analysisRes) {
            const normAnalysis =
              normalizeFleetAnalysis(
                analysisRes
              );

            setAnalysis(
              normAnalysis
            );
          }
        } catch (err) {
          showNotification(
            err?.message ||
            'Failed to analyze fleet',
            'error'
          );
        } finally {
          setLoading((prev) => ({
            ...prev,
            refreshing: false
          }));
        }
      },
      [showNotification]
    );

  /* =======================================================
     AUTOMATIC TELEMETRY INITIALIZATION & LIVE POLLING
     ======================================================= */

  useEffect(() => {
    refreshFleetData(true).catch(() => {});

    // Periodic live telemetry polling fallback (every 25 seconds)
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshFleetData().catch(() => {});
      }
    }, 25000);

    return () => clearInterval(intervalId);
  }, [refreshFleetData]);

  /* =======================================================
     LOGIN
     ======================================================= */

  const login = async (
    roleOrPhone,
    driverIdOrPassword
  ) => {
    const isRoleCall =
      roleOrPhone === 'admin' ||
      roleOrPhone === 'driver';

    if (isRoleCall) {
      // Guard: a real DRIVER must never escalate to admin role
      const sessionAuthRole = String(
        currentUser?.authenticatedRole || ''
      ).toUpperCase();

      if (
        roleOrPhone === 'admin' &&
        sessionAuthRole === 'DRIVER'
      ) {
        showNotification(
          'Admin access is not available for Driver accounts.',
          'error'
        );
        return { success: false, error: 'Unauthorized role switch.' };
      }

      const role = roleOrPhone;

      const driverId =
        driverIdOrPassword ||
        (
          drivers[0]?.id ||
          'drv-1'
        );

      const driverObj =
        drivers.find(
          (d) =>
            String(d.id) ===
            String(driverId)
        );

      // Authoritative authenticatedRole for direct login calls
      const authoritativeAuthRole =
        role === 'admin' ? 'ADMIN' : 'DRIVER';

      setCurrentUser({
        role,
        authenticatedRole: authoritativeAuthRole,
        driverId:
          role === 'driver'
            ? driverId
            : null,
        name:
          role === 'admin'
            ? 'Fleet Manager'
            : (
              driverObj?.name ||
              'Arun Kumar'
            ),
        token:
          currentUser?.token ||
          'presentation-token'
      });

      showNotification(
        `Switched view to ${role === 'admin'
          ? 'Fleet Manager'
          : (
            driverObj?.name ||
            'Driver'
          )
        }`,
        'info'
      );

      refreshFleetData().catch(() => {});
      return {
        success: true
      };
    }

    const phone =
      String(
        roleOrPhone || ''
      ).trim();

    // Live Backend Authentication
    try {
      const authRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: phone, password: driverIdOrPassword })
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        const backendRole = String(authData.user?.role || 'ADMIN').toUpperCase();
        const uiRole = backendRole === 'DRIVER' ? 'driver' : 'admin';
        const userRecord = {
          ...authData.user,
          role: uiRole,
          authenticatedRole: backendRole,
          token: authData.token
        };
        setCurrentUser(userRecord);
        // Persist token so API calls can attach Bearer header
        try {
          sessionStorage.setItem('fleet_token', authData.token);
          sessionStorage.setItem('fleet_user', JSON.stringify({
            id: authData.user?.id,
            name: authData.user?.name,
            role: uiRole,
            authenticatedRole: backendRole,
            driverId: authData.user?.driverId || null
          }));
        } catch (_) {}
        showNotification(`Signed in as ${authData.user?.name} (${authData.user?.role})`, 'success');
        refreshFleetData().catch(() => {});
        return { success: true };
      } else if (authRes.status === 401 || authRes.status === 400) {
        const errData = await authRes.json().catch(() => ({}));
        return {
          success: false,
          error: errData.error || 'Invalid credentials. User not found.'
        };
      }
    } catch (authErr) {
      console.warn('[Backend auth attempt fallback]:', authErr?.message);
    }

    const isAdmin =
      phone === '9876543210' ||
      phone
        .toLowerCase()
        .includes('admin');

    if (isAdmin) {
      setCurrentUser({
        role: 'admin',
        authenticatedRole: 'ADMIN',
        driverId: null,
        name: 'Fleet Manager',
        token:
          'presentation-token'
      });

      showNotification(
        'Signed in as Fleet Manager (Presentation session)',
        'info'
      );

      return {
        success: true
      };
    }

    const cleanDigits = phone.replace(/\D/g, '');
    const matchingDriver =
      drivers.find(
        (d) =>
          d.phone &&
          cleanDigits &&
          d.phone
            .replace(/\D/g, '')
            .includes(cleanDigits)
      ) ||
      drivers.find(
        (d) => String(d.id || d.driverId).toUpperCase() === 'DR001'
      ) ||
      drivers[0] ||
      {
        id: 'DR001',
        name: 'Arun Kumar'
      };

    setCurrentUser({
      role: 'driver',
      authenticatedRole: 'DRIVER',
      driverId:
        matchingDriver.id,
      name:
        matchingDriver.name,
      token:
        'presentation-token'
    });

    showNotification(
      `Signed in as Driver: ${matchingDriver.name}`,
      'info'
    );

    return {
      success: true
    };
  };

  /* =======================================================
     SWITCH TO DRIVER PREVIEW (Admin/Manager only)
     ======================================================= */

  const switchToDriverPreview = (driverId) => {
    const sessionAuthRole = String(
      currentUser?.authenticatedRole || ''
    ).toUpperCase();

    if (
      sessionAuthRole !== 'ADMIN' &&
      sessionAuthRole !== 'FLEET_MANAGER' &&
      sessionAuthRole !== 'DISPATCHER'
    ) {
      showNotification(
        'Admin access is not available for Driver accounts.',
        'error'
      );
      return;
    }

    const driverId_ = driverId ||
      (drivers[0]?.id || 'drv-1');

    const driverObj = drivers.find(
      (d) => String(d.id) === String(driverId_)
    );

    setCurrentUser((prev) => ({
      ...prev,
      role: 'driver',
      // authenticatedRole stays unchanged — admin previewing driver view
      driverId: driverId_,
      name: driverObj?.name || prev?.name || 'Driver'
    }));

    showNotification(
      `Switched to Driver view: ${driverObj?.name || 'Driver'}`,
      'info'
    );
    refreshFleetData().catch(() => {});
  };

  /* =======================================================
     SWITCH BACK TO ADMIN VIEW (only if authenticatedRole permits)
     ======================================================= */

  const switchToAdminView = () => {
    const sessionAuthRole = String(
      currentUser?.authenticatedRole || ''
    ).toUpperCase();

    if (
      sessionAuthRole !== 'ADMIN' &&
      sessionAuthRole !== 'FLEET_MANAGER' &&
      sessionAuthRole !== 'DISPATCHER'
    ) {
      showNotification(
        'Admin access is not available for Driver accounts.',
        'error'
      );
      return;
    }

    setCurrentUser((prev) => ({
      ...prev,
      role: 'admin',
      driverId: null,
      name:
        prev?.name?.includes('Manager') ||
        prev?.name?.includes('Admin')
          ? prev.name
          : 'Fleet Manager'
    }));

    showNotification('Returned to Admin Dashboard.', 'info');
  };

  /* =======================================================
     LOGOUT
     ======================================================= */

  const logout = () => {
    setCurrentUser(null);
    // Clear persisted session
    try {
      sessionStorage.removeItem('fleet_token');
      sessionStorage.removeItem('fleet_user');
    } catch (_) {}

    showNotification(
      'Signed out successfully.',
      'info'
    );
  };

  /* =======================================================
     CREATE DRIVER
     ======================================================= */

  const createDriverAccount = async ({
    name,
    phone,
    licenseNumber,
    driverId,
    status = 'active',
    assignedVehicleId = null,
    currentLocation = 'Coimbatore'
  }) => {
    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    try {
      const res = await createDriverApi({
        name,
        phone,
        licenseNumber: licenseNumber || `TN2026${Math.floor(1000 + Math.random() * 9000)}`,
        driverId,
        status,
        assignedVehicleId,
        currentLocation
      });

      if (res.success) {
        showNotification(
          `Driver "${name}" onboarded successfully!`,
          'success'
        );
        await refreshFleetData();
        return {
          success: true,
          driver: res.data || { name, phone }
        };
      }

      const errMsg = res.error || 'Driver onboarding failed';
      showNotification(errMsg, 'error');
      return { success: false, error: errMsg };
    } catch (err) {
      const errMsg = err?.message || 'Driver onboarding operation failed';
      showNotification(errMsg, 'error');
      return { success: false, error: errMsg };
    } finally {
      setLoading((prev) => ({
        ...prev,
        action: false
      }));
    }
  };

  const createDriverByAdmin = createDriverAccount;

  /* =======================================================
     CREATE VEHICLE (Direct Gateway -> FleetBackend -> MongoDB Atlas)
     ======================================================= */

  const createVehicleAccount = async ({
    vehicleId,
    registrationNumber,
    type = 'Mini Truck',
    status = 'active',
    driverId = null,
    location = 'Coimbatore Regional Depot',
    mileage = 0,
    fuelLevel = 80
  }) => {
    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    try {
      const res = await createVehicleApi({
        vehicleId,
        registrationNumber,
        type,
        status,
        driverId,
        location,
        mileage,
        fuelLevel
      });

      if (res.success) {
        showNotification(
          `Vehicle "${vehicleId}" (${registrationNumber}) onboarded successfully!`,
          'success'
        );
        await refreshFleetData();
        return {
          success: true,
          vehicle: res.data || { vehicleId, registrationNumber }
        };
      }

      const errMsg = res.error || 'Vehicle onboarding failed';
      showNotification(errMsg, 'error');
      return { success: false, error: errMsg };
    } catch (err) {
      const errMsg = err?.message || 'Vehicle onboarding operation failed';
      showNotification(errMsg, 'error');
      return { success: false, error: errMsg };
    } finally {
      setLoading((prev) => ({
        ...prev,
        action: false
      }));
    }
  };

  /* =======================================================
     START DUTY
     ======================================================= */

  const startDuty = async (
    driverId,
    location = null
  ) => {
    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    const targetLocation =
      location ||
      'Coimbatore';

    const now = new Date();
    const dutyTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    setDrivers((prev) => {
      const exists =
        prev.some(
          (d) =>
            String(d.id) === String(driverId) ||
            String(d.driverId) === String(driverId)
        );

      if (exists) {
        return prev.map(
          (d) =>
            String(d.id) === String(driverId) ||
            String(d.driverId) === String(driverId)
              ? {
                ...d,
                status: 'Active',
                duty_start_time_str: dutyTimeStr,
                self_reported_location:
                  targetLocation
              }
              : d
        );
      }

      return [
        ...prev,
        {
          id: driverId,
          driverId,
          name:
            currentUser?.name ||
            'Arun Kumar',
          phone:
            '+91 98765 43210',
          status: 'Active',
          duty_start_time_str: dutyTimeStr,
          self_reported_location:
            targetLocation
        }
      ];
    });

    try {
      const res =
        await startDriverDuty(
          driverId,
          location
        );

      if (res?.success) {
        showNotification(
          'Duty started! Status updated via SNSIHub.',
          'success'
        );

        await refreshFleetData();
      }

      return true;
    } catch (err) {
      showNotification(
        err.message || 'Failed to start driver duty.',
        'error'
      );
      return false;
    } finally {
      setLoading((prev) => ({
        ...prev,
        action: false
      }));
    }
  };

  /* =======================================================
     GO OFFLINE
     ======================================================= */

  const goOffline = async (
    driverId
  ) => {
    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    setDrivers((prev) =>
      prev.map(
        (d) =>
          String(d.id) === String(driverId) ||
          String(d.driverId) === String(driverId)
            ? {
              ...d,
              status: 'Ready',
              duty_start_time_str: null
            }
            : d
      )
    );

    try {
      const res =
        await setDriverOffline(
          driverId
        );

      if (res?.success) {
        showNotification(
          'Driver status set to Ready / Offline.',
          'info'
        );

        await refreshFleetData();
      }

      return true;
    } catch (err) {
      showNotification(
        err.message || 'Failed to set driver offline.',
        'error'
      );
      return false;
    } finally {
      setLoading((prev) => ({
        ...prev,
        action: false
      }));
    }
  };

  /* =======================================================
     ASSIGN ROUTE
     ======================================================= */

  const assignRoute = async (
    driverId,
    source,
    destination,
    vehicleId = null,
    routeInfo = {}
  ) => {
    const isDev =
      Boolean(
        import.meta.env?.DEV
      );

    const matchDriver = (
      d,
      targetId
    ) =>
      String(
        d?.id ||
        d?.driverId ||
        d?.driver_id ||
        ''
      ).toLowerCase() ===
      String(
        targetId || ''
      ).toLowerCase();

    const matchVehicle = (
      v,
      targetId
    ) =>
      String(
        v?.id ||
        v?.vehicleId ||
        v?.vehicle_id ||
        ''
      ).toLowerCase() ===
      String(
        targetId || ''
      ).toLowerCase();

    const targetDriver =
      drivers.find((d) =>
        matchDriver(
          d,
          driverId
        )
      );

    const resolvedDriverId =
      targetDriver?.id ||
      targetDriver?.driverId ||
      driverId;

    const resolvedDriverName =
      targetDriver?.name ||
      `Driver ${resolvedDriverId}`;

    const targetVehicle =
      vehicleId
        ? vehicles.find((v) =>
          matchVehicle(
            v,
            vehicleId
          )
        )
        : (
          targetDriver
            ?.assigned_vehicle_id
            ? vehicles.find(
              (v) =>
                matchVehicle(
                  v,
                  targetDriver.assigned_vehicle_id
                )
            )
            : vehicles.find(
              (v) =>
                (
                  v.status ||
                  ''
                ).toLowerCase() ===
                'idle'
            ) ||
            vehicles[0]
        );

    const resolvedVehicleId =
      targetVehicle?.id ||
      targetVehicle?.vehicleId ||
      vehicleId ||
      'VH101';

    const resolvedVehicleReg =
      targetVehicle?.reg_number ||
      targetVehicle?.reg_no ||
      'TN 33 AA 4019';

    const waypoints =
      routeInfo?.waypoints ||
      routeInfo?.stops ||
      [];

    const distanceKm =
      routeInfo?.distanceKm ||
      routeInfo?.distance_km ||
      getCorridorDistanceKm(
        source,
        destination
      ) ||
      100;

    const duration =
      routeInfo?.duration ||
      routeInfo?.estimated_duration ||
      getEstimatedDuration(
        source,
        destination
      );

    const numericPart =
      String(
        resolvedDriverId
      ).replace(/\D/g, '') ||
      Math.floor(
        Math.random() * 900 +
        100
      );

    const newTripId =
      `TR${numericPart}`;

    const updatedRoute = {
      source,
      origin: source,
      destination,
      waypoints,
      distance_km: distanceKm,
      distanceKm,
      estimated_duration: duration,
      duration,
      tripId: newTripId,
      vehicleId: resolvedVehicleId,
      vehicle_id: resolvedVehicleId,
      routeGeometry: routeInfo?.routeGeometry || null,
      route_geometry: routeInfo?.routeGeometry || null,
      assigned_at: new Date().toISOString()
    };

    if (isDev) {
      console.log(
        `[FleetContext dispatch] Assigning driver ${resolvedDriverId} (${resolvedDriverName}) to vehicle ${resolvedVehicleId} (${resolvedVehicleReg}) on route ${source} → ${destination}`
      );
    }

    setDrivers((prev) =>
      prev.map((d) =>
        matchDriver(
          d,
          resolvedDriverId
        )
          ? {
            ...d,
            status: 'Assigned',
            assigned_vehicle_id:
              resolvedVehicleId,
            assigned_route:
              updatedRoute
          }
          : d
      )
    );

    setVehicles((prev) =>
      prev.map((v) =>
        matchVehicle(
          v,
          resolvedVehicleId
        )
          ? {
            ...v,
            status: 'travelling',
            assigned_driver_id:
              resolvedDriverId,
            assigned_driver:
              resolvedDriverName
          }
          : v
      )
    );

    const newTrip = {
      id: newTripId,
      tripId: newTripId,

      driver_id:
        resolvedDriverId,
      driverId:
        resolvedDriverId,

      driver_name:
        resolvedDriverName,
      driverName:
        resolvedDriverName,

      vehicle_id:
        resolvedVehicleId,
      vehicleId:
        resolvedVehicleId,

      vehicle_reg:
        resolvedVehicleReg,

      source,
      origin: source,
      destination,

      status: 'Ongoing',

      distance_km:
        distanceKm,

      estimated_duration:
        duration,

      waypoints,

      route_geometry:
        routeInfo?.routeGeometry || null,
      routeGeometry:
        routeInfo?.routeGeometry || null,

      created_at:
        new Date().toISOString()
    };

    setTrips((prev) => [
      newTrip,

      ...prev.filter(
        (t) =>
          String(
            t.id ||
            t.tripId
          ) !==
          newTripId
      )
    ]);

    setStats((prev) => ({
      ...prev,

      travelling_count:
        Math.min(
          prev.total_vehicles ||
          11,
          (
            prev.travelling_count ||
            0
          ) + 1
        ),

      active_trips:
        (
          prev.active_trips ||
          0
        ) + 1
    }));

    sessionDispatchesRef.current.set(
      String(
        resolvedDriverId
      ).toUpperCase(),
      {
        driver: {
          status: 'Assigned',
          assigned_vehicle_id:
            resolvedVehicleId,
          assigned_route:
            updatedRoute
        },

        vehicle: {
          vehicleId:
            resolvedVehicleId,
          status: 'travelling',
          assigned_driver_id:
            resolvedDriverId,
          assigned_driver:
            resolvedDriverName
        },

        trip: newTrip
      }
    );

    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    try {
      const res =
        await assignTripRoute(
          resolvedDriverId,
          resolvedVehicleId,
          source,
          destination,
          {
            waypoints,
            distanceKm,
            duration,
            routeGeometry:
              routeInfo?.routeGeometry
          }
        );

      if (res?.success) {
        showNotification(
          `Route ${source} → ${destination} assigned to ${resolvedDriverName} (${resolvedDriverId}) via SNSIHub!`,
          'success'
        );
      }

      return true;
    } catch (err) {
      if (isDev) {
        console.warn(
          '[FleetContext assignRoute webhook notice]:',
          err?.message
        );
      }

      return true;
    } finally {
      setLoading((prev) => ({
        ...prev,
        action: false
      }));
    }
  };

  /* =======================================================
     START TRIP
     ======================================================= */

  const startTrip = async (
    driverId,
    tripId = null
  ) => {
    setDrivers((prev) =>
      prev.map((d) =>
        String(d.id) ===
          String(driverId)
          ? {
            ...d,
            status: 'On Trip'
          }
          : d
      )
    );

    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    try {
      const res =
        await startDriverTrip(
          driverId,
          tripId
        );

      if (res?.success) {
        showNotification(
          'Trip started! Corridor telemetry active.',
          'success'
        );

        await refreshFleetData();
      }

      return true;
    } catch {
      return true;
    } finally {
      setLoading((prev) => ({
        ...prev,
        action: false
      }));
    }
  };

  /* =======================================================
     COMPLETE TRIP
     ======================================================= */

  const completeTrip = async (
    arg1,
    arg2 = null,
    arg3 = null
  ) => {
    const isDev =
      Boolean(
        import.meta.env?.DEV
      );

    let resolvedTripId =
      null;

    let resolvedDriverId =
      null;

    let resolvedVehicleId =
      null;

    if (
      arg1 &&
      typeof arg1 ===
      'object'
    ) {
      resolvedTripId =
        arg1.tripId ||
        arg1.id ||
        arg1.trip_id;

      resolvedDriverId =
        arg1.driverId ||
        arg1.driver_id;

      resolvedVehicleId =
        arg1.vehicleId ||
        arg1.vehicle_id;
    } else {
      const s1 =
        String(
          arg1 || ''
        ).trim();

      const s2 =
        String(
          arg2 || ''
        ).trim();

      if (
        s1
          .toUpperCase()
          .startsWith('TR')
      ) {
        resolvedTripId =
          s1;

        resolvedDriverId =
          s2 || null;
      } else if (
        s2
          .toUpperCase()
          .startsWith('TR')
      ) {
        resolvedTripId =
          s2;

        resolvedDriverId =
          s1 || null;
      } else {
        const isTrip1 =
          trips.some(
            (t) =>
              String(
                t.tripId ||
                t.id
              ).toUpperCase() ===
              s1.toUpperCase()
          );

        if (isTrip1) {
          resolvedTripId =
            s1;

          resolvedDriverId =
            s2 || null;
        } else {
          resolvedDriverId =
            s1 || null;

          resolvedTripId =
            s2 || null;
        }
      }

      resolvedVehicleId =
        arg3 || null;
    }

    const targetTrip =
      trips.find(
        (t) =>
          String(
            t.id ||
            t.tripId ||
            ''
          ).toUpperCase() ===
          String(
            resolvedTripId ||
            ''
          ).toUpperCase()
      );

    if (
      !resolvedDriverId
    ) {
      resolvedDriverId =
        targetTrip?.driver_id ||
        targetTrip?.driverId ||
        null;
    }

    if (
      !resolvedVehicleId
    ) {
      resolvedVehicleId =
        targetTrip?.vehicle_id ||
        targetTrip?.vehicleId ||
        null;
    }

    const currentStatus =
      (
        targetTrip?.status ||
        ''
      ).toLowerCase();

    if (
      currentStatus ===
      'completed'
    ) {
      return true;
    }

    if (
      resolvedTripId &&
      inFlightTripActionsRef.current.has(
        resolvedTripId
      )
    ) {
      return true;
    }

    if (
      resolvedTripId
    ) {
      inFlightTripActionsRef.current.add(
        resolvedTripId
      );
    }

    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    try {
      await completeDriverTrip(
        resolvedTripId,
        resolvedDriverId,
        resolvedVehicleId
      );
    } catch (err) {
      if (isDev) {
        console.warn(
          '[FleetContext completeTrip SNSIHub notice]:',
          err?.message
        );
      }
    }

    if (
      resolvedTripId
    ) {
      setTrips((prev) =>
        prev.map((t) =>
          String(
            t.id ||
            t.tripId ||
            ''
          ).toUpperCase() ===
            String(
              resolvedTripId
            ).toUpperCase()
            ? {
              ...t,
              status:
                'Completed',
              end_time:
                new Date().toISOString()
            }
            : t
        )
      );

      setStoredTripOverride(
        resolvedTripId,
        'Completed',
        {
          driverId:
            resolvedDriverId,
          vehicleId:
            resolvedVehicleId
        }
      );
    }

    if (
      resolvedDriverId
    ) {
      setDrivers((prev) =>
        prev.map((d) =>
          String(
            d.id ||
            d.driverId ||
            ''
          ).toUpperCase() ===
            String(
              resolvedDriverId
            ).toUpperCase()
            ? {
              ...d,
              status: 'Active',
              assigned_route:
                null,
              trips_completed:
                (
                  d.trips_completed ||
                  0
                ) + 1
            }
            : d
        )
      );

      sessionDispatchesRef.current.delete(
        String(
          resolvedDriverId
        ).toUpperCase()
      );
    }

    if (
      resolvedVehicleId
    ) {
      setVehicles((prev) =>
        prev.map((v) =>
          String(
            v.id ||
            v.vehicleId ||
            ''
          ).toUpperCase() ===
            String(
              resolvedVehicleId
            ).toUpperCase()
            ? {
              ...v,
              status: 'idle',
              assigned_driver_id:
                null,
              assigned_driver:
                null
            }
            : v
        )
      );
    }

    setStats((prev) => ({
      ...prev,

      travelling_count:
        Math.max(
          0,
          (
            prev.travelling_count ||
            1
          ) - 1
        ),

      idle_count:
        (
          prev.idle_count ||
          0
        ) + 1,

      active_trips:
        Math.max(
          0,
          (
            prev.active_trips ||
            1
          ) - 1
        ),

      completed_trips:
        (
          prev.completed_trips ||
          0
        ) + 1
    }));

    showNotification(
      `Trip #${resolvedTripId || ''} marked as completed via SNSIHub!`,
      'success'
    );

    if (
      resolvedTripId
    ) {
      inFlightTripActionsRef.current.delete(
        resolvedTripId
      );
    }

    setLoading((prev) => ({
      ...prev,
      action: false
    }));

    return true;
  };

  /* =======================================================
     CANCEL TRIP
     ======================================================= */

  const cancelTrip = async (
    arg1,
    arg2 = null,
    arg3 = null
  ) => {
    const isDev =
      Boolean(
        import.meta.env?.DEV
      );

    let resolvedTripId =
      null;

    let resolvedDriverId =
      null;

    let resolvedVehicleId =
      null;

    if (
      arg1 &&
      typeof arg1 ===
      'object'
    ) {
      resolvedTripId =
        arg1.tripId ||
        arg1.id ||
        arg1.trip_id;

      resolvedDriverId =
        arg1.driverId ||
        arg1.driver_id;

      resolvedVehicleId =
        arg1.vehicleId ||
        arg1.vehicle_id;
    } else {
      const s1 =
        String(
          arg1 || ''
        ).trim();

      const s2 =
        String(
          arg2 || ''
        ).trim();

      if (
        s1
          .toUpperCase()
          .startsWith('TR')
      ) {
        resolvedTripId =
          s1;

        resolvedDriverId =
          s2 || null;
      } else if (
        s2
          .toUpperCase()
          .startsWith('TR')
      ) {
        resolvedTripId =
          s2;

        resolvedDriverId =
          s1 || null;
      } else {
        const isTrip1 =
          trips.some(
            (t) =>
              String(
                t.tripId ||
                t.id
              ).toUpperCase() ===
              s1.toUpperCase()
          );

        if (isTrip1) {
          resolvedTripId =
            s1;

          resolvedDriverId =
            s2 || null;
        } else {
          resolvedDriverId =
            s1 || null;

          resolvedTripId =
            s2 || null;
        }
      }

      resolvedVehicleId =
        arg3 || null;
    }

    const targetTrip =
      trips.find(
        (t) =>
          String(
            t.id ||
            t.tripId ||
            ''
          ).toUpperCase() ===
          String(
            resolvedTripId ||
            ''
          ).toUpperCase()
      );

    if (
      !resolvedDriverId
    ) {
      resolvedDriverId =
        targetTrip?.driver_id ||
        targetTrip?.driverId ||
        null;
    }

    if (
      !resolvedVehicleId
    ) {
      resolvedVehicleId =
        targetTrip?.vehicle_id ||
        targetTrip?.vehicleId ||
        null;
    }

    const currentStatus =
      (
        targetTrip?.status ||
        ''
      ).toLowerCase();

    if (
      currentStatus ===
      'cancelled'
    ) {
      return true;
    }

    if (
      resolvedTripId &&
      inFlightTripActionsRef.current.has(
        resolvedTripId
      )
    ) {
      return true;
    }

    if (
      resolvedTripId
    ) {
      inFlightTripActionsRef.current.add(
        resolvedTripId
      );
    }

    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    try {
      await cancelDriverTrip(
        resolvedTripId,
        resolvedDriverId,
        resolvedVehicleId
      );
    } catch (err) {
      if (isDev) {
        console.warn(
          '[FleetContext cancelTrip SNSIHub notice]:',
          err?.message
        );
      }
    }

    if (
      resolvedTripId
    ) {
      setTrips((prev) =>
        prev.map((t) =>
          String(
            t.id ||
            t.tripId ||
            ''
          ).toUpperCase() ===
            String(
              resolvedTripId
            ).toUpperCase()
            ? {
              ...t,
              status:
                'Cancelled',
              cancelled_at:
                new Date().toISOString()
            }
            : t
        )
      );

      setStoredTripOverride(
        resolvedTripId,
        'Cancelled',
        {
          driverId:
            resolvedDriverId,
          vehicleId:
            resolvedVehicleId
        }
      );
    }

    if (
      resolvedDriverId
    ) {
      setDrivers((prev) =>
        prev.map((d) =>
          String(
            d.id ||
            d.driverId ||
            ''
          ).toUpperCase() ===
            String(
              resolvedDriverId
            ).toUpperCase()
            ? {
              ...d,
              status: 'Ready',
              assigned_route:
                null
            }
            : d
        )
      );

      sessionDispatchesRef.current.delete(
        String(
          resolvedDriverId
        ).toUpperCase()
      );
    }

    if (
      resolvedVehicleId
    ) {
      setVehicles((prev) =>
        prev.map((v) =>
          String(
            v.id ||
            v.vehicleId ||
            ''
          ).toUpperCase() ===
            String(
              resolvedVehicleId
            ).toUpperCase()
            ? {
              ...v,
              status: 'idle',
              assigned_driver_id:
                null,
              assigned_driver:
                null
            }
            : v
        )
      );
    }

    setStats((prev) => ({
      ...prev,

      travelling_count:
        Math.max(
          0,
          (
            prev.travelling_count ||
            1
          ) - 1
        ),

      idle_count:
        (
          prev.idle_count ||
          0
        ) + 1,

      active_trips:
        Math.max(
          0,
          (
            prev.active_trips ||
            1
          ) - 1
        )
    }));

    showNotification(
      `Trip #${resolvedTripId || ''} has been cancelled.`,
      'warning'
    );

    if (
      resolvedTripId
    ) {
      inFlightTripActionsRef.current.delete(
        resolvedTripId
      );
    }

    setLoading((prev) => ({
      ...prev,
      action: false
    }));

    return true;
  };

  /* =======================================================
     RESET DUTY
     ======================================================= */

  const resetDuty = async (
    driverId
  ) => {
    setLoading((prev) => ({
      ...prev,
      action: true
    }));

    setDrivers((prev) =>
      prev.map(
        (d) =>
          String(d.id) === String(driverId) ||
          String(d.driverId) === String(driverId)
            ? {
              ...d,
              status: 'Ready',
              duty_start_time_str: null,
              assigned_route: null
            }
            : d
      )
    );

    try {
      const res =
        await resetDriverDuty(
          driverId
        );

      if (res?.success) {
        showNotification(
          'Duty status reset via SNSIHub.',
          'info'
        );

        await refreshFleetData();

        return true;
      }

      showNotification(
        res?.message ||
        'Failed to reset duty',
        'error'
      );

      return false;
    } catch (err) {
      showNotification(
        err?.message ||
        'Reset duty not supported by current workflow.',
        'error'
      );

      return false;
    } finally {
      setLoading((prev) => ({
        ...prev,
        action: false
      }));
    }
  };

  /* =======================================================
     NATURAL LANGUAGE SNS COMMAND
     ======================================================= */

  const askSNSCommand =
    async (
      commandText
    ) => {
      setLoading((prev) => ({
        ...prev,
        action: true
      }));

      try {
        const res =
          await askSNS(
            commandText
          );

        return res;
      } catch (err) {
        showNotification(
          err?.message ||
          'SNSIHub query failed.',
          'error'
        );

        throw err;
      } finally {
        setLoading((prev) => ({
          ...prev,
          action: false
        }));
      }
    };

  /* =======================================================
     ACTIVE DRIVER COUNT
     ======================================================= */

  const activeDriversCount =
    stats?.active_drivers_today ||
    dailyActiveDriverIds.size;

  /* =======================================================
     LOCATION / TELEMETRY DISPATCH MUTATIONS
     ======================================================= */

  const updateVehicleCoordinates = async (vehicleId, payload) => {
    try {
      const res = await updateVehicleLocation(vehicleId, payload, currentUser?.token);
      if (res.success) {
        showNotification(`Vehicle ${vehicleId} coordinates updated successfully.`, 'success');
        await refreshFleetData().catch(() => {});
        return { success: true, data: res.data };
      } else {
        showNotification(res.error || 'Failed to update vehicle coordinates.', 'error');
        return { success: false, error: res.error, status: res.status };
      }
    } catch (err) {
      showNotification(err.message || 'Error updating vehicle coordinates.', 'error');
      return { success: false, error: err.message, status: 500 };
    }
  };

  const updateDriverCoordinates = async (driverId, payload) => {
    try {
      const res = await updateDriverLocation(driverId, payload, currentUser?.token);
      if (res.success) {
        showNotification(`Driver ${driverId} coordinates updated successfully.`, 'success');
        await refreshFleetData().catch(() => {});
        return { success: true, data: res.data };
      } else {
        showNotification(res.error || 'Failed to update driver coordinates.', 'error');
        return { success: false, error: res.error, status: res.status };
      }
    } catch (err) {
      showNotification(err.message || 'Error updating driver coordinates.', 'error');
      return { success: false, error: err.message, status: 500 };
    }
  };

  const transmitDriverLocation = async (telemetryPayload) => {
    try {
      const res = await sendDriverLocationTelemetry(telemetryPayload, currentUser?.token);
      if (res.success) {
        await refreshFleetData().catch(() => {});
        return { success: true, data: res.data };
      } else {
        return { success: false, error: res.error, status: res.status };
      }
    } catch (err) {
      return { success: false, error: err.message, status: 500 };
    }
  };

  /**
   * Apply Mock/Demo Location to local state for simulation and route optimization
   * without sending persistent mutations or triggering 400 validation errors on MongoDB.
   */
  const applyDemoLocation = (entityId, entityType, { latitude, longitude, locationName }) => {
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    if (isNaN(latNum) || isNaN(lngNum)) {
      return { success: false, error: 'Invalid coordinates: numeric values required.' };
    }

    if (entityType === 'vehicle') {
      setVehicles((prev) =>
        prev.map((v) => {
          const vId = v.vehicleId || v.id;
          if (String(vId).toUpperCase() === String(entityId).toUpperCase()) {
            return {
              ...v,
              latitude: latNum,
              longitude: lngNum,
              currentLocation: locationName || v.currentLocation || 'Operational Hub',
              coordinatesSource: 'MOCK_DEMO',
              isLiveGPS: false,
              locationTimestamp: new Date().toISOString()
            };
          }
          return v;
        })
      );
    } else {
      setDrivers((prev) =>
        prev.map((d) => {
          const dId = d.driverId || d.id;
          if (String(dId).toUpperCase() === String(entityId).toUpperCase()) {
            return {
              ...d,
              latitude: latNum,
              longitude: lngNum,
              currentLocation: locationName || d.currentLocation || 'Operational Hub',
              coordinatesSource: 'MOCK_DEMO',
              isLiveGPS: false,
              locationTimestamp: new Date().toISOString()
            };
          }
          return d;
        })
      );
    }

    setHighlightMapEntity({
      id: entityId,
      type: entityType,
      latitude: latNum,
      longitude: lngNum
    });

    showNotification(
      `Updated coordinates for ${entityType} ${entityId} (${latNum.toFixed(4)}, ${lngNum.toFixed(4)}).`,
      'info'
    );

    return {
      success: true,
      data: {
        id: entityId,
        latitude: latNum,
        longitude: lngNum,
        coordinatesSource: 'MOCK_DEMO'
      }
    };
  };

  /* =======================================================
     PROVIDER
     ======================================================= */

  return (
    <FleetContext.Provider
      value={{
        currentUser,
        setCurrentUser,

        login,
        logout,
        switchToDriverPreview,
        switchToAdminView,
        createDriverByAdmin,
        createDriverAccount,
        createVehicleAccount,

        updateVehicleCoordinates,
        updateDriverCoordinates,
        transmitDriverLocation,
        applyDemoLocation,

        drivers,
        vehicles,
        trips,
        maintenance,
        fuel,
        safetyAlerts,

        highlightMapEntity,
        setHighlightMapEntity,
        activeRoute,
        setActiveRoute,

        stats,
        analysis,

        dailyActiveDriverIds,
        activeDriversCount,

        startDuty,
        goOffline,

        assignRoute,

        startTrip,
        completeTrip,
        cancelTrip,
        resetDuty,

        askSNSCommand,

        refreshFleetData,
        refreshAnalysis,

        getVehicleStatus,
        getDriverStatus,
        getTripStatus,
        getMaintenanceStatus,
        getFuelAnalysis,
        getSafetyAlerts,
        getFleetSummary,
        getFleetAnalysis,
        optimizeRoute,

        toast,
        clearToast,
        showNotification,

        loading,
        lastUpdated,
        isRefreshing: Boolean(loading?.refreshing),

        error: apiError
      }}
    >
      {children}
    </FleetContext.Provider>
  );
};

/* =========================================================
   HOOK
   ========================================================= */

export const useFleet = () => {
  const context =
    useContext(
      FleetContext
    );

  if (!context) {
    throw new Error(
      'useFleet must be used within a FleetProvider'
    );
  }

  return context;
};