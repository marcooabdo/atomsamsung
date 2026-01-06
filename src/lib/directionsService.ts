export async function gerarPolylineComDirectionsService(
  pontoBase: { lat: number; lng: number },
  osIncluidas: Array<{ lat: number; lng: number }>
): Promise<string | undefined> {
  try {
    if (!window.google?.maps || osIncluidas.length === 0) {
      return undefined;
    }

    const directionsService = new google.maps.DirectionsService();

    const waypoints = osIncluidas.map(os => ({
      location: new google.maps.LatLng(os.lat, os.lng),
      stopover: true
    }));

    if (waypoints.length > 25) {
      waypoints.splice(25);
    }

    const request: google.maps.DirectionsRequest = {
      origin: new google.maps.LatLng(pontoBase.lat, pontoBase.lng),
      destination: new google.maps.LatLng(pontoBase.lat, pontoBase.lng),
      waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false
    };

    return new Promise((resolve) => {
      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const polyline = result.routes[0]?.overview_polyline;
          resolve(polyline);
        } else {
          resolve(undefined);
        }
      });
    });
  } catch (error) {
    return undefined;
  }
}

export async function calcularDistanciaRealComGoogleMaps(
  origem: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): Promise<{ distancia_km: number; tempo_minutos: number } | null> {
  try {
    if (!window.google?.maps) {
      return null;
    }

    const distanceMatrixService = new google.maps.DistanceMatrixService();

    const request: google.maps.DistanceMatrixRequest = {
      origins: [new google.maps.LatLng(origem.lat, origem.lng)],
      destinations: [new google.maps.LatLng(destino.lat, destino.lng)],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC
    };

    return new Promise((resolve) => {
      distanceMatrixService.getDistanceMatrix(request, (response, status) => {
        if (status === google.maps.DistanceMatrixStatus.OK && response) {
          const result = response.rows[0]?.elements[0];
          if (result?.status === 'OK') {
            const distancia_km = result.distance.value / 1000;
            const tempo_minutos = Math.ceil(result.duration.value / 60);
            resolve({ distancia_km, tempo_minutos });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    return null;
  }
}
