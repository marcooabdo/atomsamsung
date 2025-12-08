interface Coordinates {
  lat: number;
  lng: number;
}

interface DistanceMatrixElement {
  distance: number;
  duration: number;
  status: string;
}

interface DistanceMatrixResult {
  origins: Coordinates[];
  destinations: Coordinates[];
  matrix: DistanceMatrixElement[][];
}

interface DirectionsLeg {
  distance: number;
  duration: number;
  startLocation: Coordinates;
  endLocation: Coordinates;
  steps: any[];
}

interface DirectionsResult {
  polyline: string;
  legs: DirectionsLeg[];
  totalDistance: number;
  totalDuration: number;
  waypointOrder: number[];
}

interface GeocodeResult {
  coordinates: Coordinates;
  formattedAddress: string;
}

class GoogleMapsService {
  private apiKey: string;
  private cache: Map<string, any> = new Map();
  private requestQueue: Promise<any>[] = [];
  private maxConcurrentRequests = 10;

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Google Maps API key not configured. Please add VITE_GOOGLE_MAPS_API_KEY to .env file');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  private generateCacheKey(prefix: string, data: any): string {
    return `${prefix}_${JSON.stringify(data)}`;
  }

  private getFromCache(key: string, maxAge: number = 3600000): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private async throttleRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    while (this.requestQueue.length >= this.maxConcurrentRequests) {
      await Promise.race(this.requestQueue);
    }

    const promise = requestFn().finally(() => {
      const index = this.requestQueue.indexOf(promise);
      if (index > -1) {
        this.requestQueue.splice(index, 1);
      }
    });

    this.requestQueue.push(promise);
    return promise;
  }

  async calculateDistanceMatrix(
    origins: Coordinates[],
    destinations: Coordinates[],
    options: {
      mode?: 'driving' | 'walking' | 'bicycling';
      avoid?: 'tolls' | 'highways' | 'ferries';
      trafficModel?: 'best_guess' | 'pessimistic' | 'optimistic';
      departureTime?: Date;
    } = {}
  ): Promise<DistanceMatrixResult> {
    if (!this.isConfigured()) {
      return this.calculateEuclideanDistanceMatrix(origins, destinations);
    }

    const cacheKey = this.generateCacheKey('distanceMatrix', { origins, destinations, options });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.throttleRequest(async () => {
        const originStr = origins.map(c => `${c.lat},${c.lng}`).join('|');
        const destStr = destinations.map(c => `${c.lat},${c.lng}`).join('|');

        const params = new URLSearchParams({
          origins: originStr,
          destinations: destStr,
          mode: options.mode || 'driving',
          key: this.apiKey,
          language: 'pt-BR',
          units: 'metric'
        });

        if (options.avoid) {
          params.append('avoid', options.avoid);
        }

        if (options.trafficModel && options.departureTime) {
          params.append('traffic_model', options.trafficModel);
          params.append('departure_time', Math.floor(options.departureTime.getTime() / 1000).toString());
        }

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Distance Matrix API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status !== 'OK') {
          throw new Error(`Distance Matrix API returned status: ${data.status}`);
        }

        const matrix: DistanceMatrixElement[][] = data.rows.map((row: any) =>
          row.elements.map((element: any) => ({
            distance: element.status === 'OK' ? element.distance.value : Infinity,
            duration: element.status === 'OK' ? element.duration.value : Infinity,
            status: element.status
          }))
        );

        const result = {
          origins,
          destinations,
          matrix
        };

        this.setCache(cacheKey, result);
        return result;
      });

      return result;
    } catch (error) {
      console.error('Distance Matrix API error, falling back to Euclidean:', error);
      return this.calculateEuclideanDistanceMatrix(origins, destinations);
    }
  }

  private calculateEuclideanDistanceMatrix(
    origins: Coordinates[],
    destinations: Coordinates[]
  ): DistanceMatrixResult {
    const matrix: DistanceMatrixElement[][] = origins.map(origin =>
      destinations.map(dest => {
        const distance = this.calculateEuclideanDistance(origin, dest);
        const duration = (distance / 40) * 3600;
        return {
          distance,
          duration,
          status: 'OK'
        };
      })
    );

    return {
      origins,
      destinations,
      matrix
    };
  }

  private calculateEuclideanDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371000;
    const lat1 = (point1.lat * Math.PI) / 180;
    const lat2 = (point2.lat * Math.PI) / 180;
    const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async getOptimizedRoute(
    waypoints: Coordinates[],
    startPoint: Coordinates,
    endPoint?: Coordinates,
    options: {
      mode?: 'driving' | 'walking' | 'bicycling';
      avoid?: 'tolls' | 'highways' | 'ferries';
      optimize?: boolean;
      trafficModel?: 'best_guess' | 'pessimistic' | 'optimistic';
      departureTime?: Date;
    } = {}
  ): Promise<DirectionsResult> {
    if (!this.isConfigured()) {
      return this.calculateFallbackRoute(waypoints, startPoint, endPoint);
    }

    const cacheKey = this.generateCacheKey('directions', { waypoints, startPoint, endPoint, options });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.throttleRequest(async () => {
        const origin = `${startPoint.lat},${startPoint.lng}`;
        const destination = endPoint ? `${endPoint.lat},${endPoint.lng}` : origin;
        const waypointsStr = waypoints.map(w => `${w.lat},${w.lng}`).join('|');

        const params = new URLSearchParams({
          origin,
          destination,
          waypoints: options.optimize !== false ? `optimize:true|${waypointsStr}` : waypointsStr,
          mode: options.mode || 'driving',
          key: this.apiKey,
          language: 'pt-BR',
          units: 'metric'
        });

        if (options.avoid) {
          params.append('avoid', options.avoid);
        }

        if (options.trafficModel && options.departureTime) {
          params.append('traffic_model', options.trafficModel);
          params.append('departure_time', Math.floor(options.departureTime.getTime() / 1000).toString());
        }

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Directions API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status !== 'OK') {
          throw new Error(`Directions API returned status: ${data.status}`);
        }

        const route = data.routes[0];
        const legs: DirectionsLeg[] = route.legs.map((leg: any) => ({
          distance: leg.distance.value,
          duration: leg.duration.value,
          startLocation: {
            lat: leg.start_location.lat,
            lng: leg.start_location.lng
          },
          endLocation: {
            lat: leg.end_location.lat,
            lng: leg.end_location.lng
          },
          steps: leg.steps
        }));

        const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
        const totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);

        const result: DirectionsResult = {
          polyline: route.overview_polyline.points,
          legs,
          totalDistance,
          totalDuration,
          waypointOrder: route.waypoint_order || []
        };

        this.setCache(cacheKey, result);
        return result;
      });

      return result;
    } catch (error) {
      console.error('Directions API error, falling back:', error);
      return this.calculateFallbackRoute(waypoints, startPoint, endPoint);
    }
  }

  private calculateFallbackRoute(
    waypoints: Coordinates[],
    startPoint: Coordinates,
    endPoint?: Coordinates
  ): DirectionsResult {
    const points = [startPoint, ...waypoints];
    if (endPoint) {
      points.push(endPoint);
    }

    const legs: DirectionsLeg[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.calculateEuclideanDistance(points[i], points[i + 1]);
      const duration = (distance / 40) * 3600;

      legs.push({
        distance,
        duration,
        startLocation: points[i],
        endLocation: points[i + 1],
        steps: []
      });
    }

    return {
      polyline: '',
      legs,
      totalDistance: legs.reduce((sum, leg) => sum + leg.distance, 0),
      totalDuration: legs.reduce((sum, leg) => sum + leg.duration, 0),
      waypointOrder: waypoints.map((_, i) => i)
    };
  }

  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API key not configured');
    }

    const cacheKey = this.generateCacheKey('geocode', address);
    const cached = this.getFromCache(cacheKey, 86400000);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        address,
        key: this.apiKey,
        language: 'pt-BR'
      });

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results.length) {
        return null;
      }

      const result = {
        coordinates: {
          lat: data.results[0].geometry.location.lat,
          lng: data.results[0].geometry.location.lng
        },
        formattedAddress: data.results[0].formatted_address
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const googleMapsService = new GoogleMapsService();

export type {
  Coordinates,
  DistanceMatrixElement,
  DistanceMatrixResult,
  DirectionsLeg,
  DirectionsResult,
  GeocodeResult
};
