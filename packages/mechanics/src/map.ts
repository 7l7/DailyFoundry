export interface LatLng { lat:number; lng:number; }
export interface MapQuestion { id:string; prompt:string; answer:LatLng; }
const EARTH_RADIUS_KM = 6371;
const toRad = (value:number) => value * Math.PI / 180;
export function distanceKm(a:LatLng,b:LatLng):number {
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng), lat1=toRad(a.lat), lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*EARTH_RADIUS_KM*Math.asin(Math.sqrt(h));
}
export function scoreMap(guess:LatLng,answer:LatLng,maxScore=1000,zeroScoreDistanceKm=5000):number {
  const distance=distanceKm(guess,answer);
  return Math.max(0,Math.round(maxScore*(1-distance/zeroScoreDistanceKm)));
}
