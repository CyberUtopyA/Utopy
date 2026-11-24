import { useEffect, useState } from "react";

type Weather = { temperature: number; code: number; updatedAt: number; areaKey?:string };
type Atmosphere = { time: "morning" | "day" | "sunset" | "night"; weather: "sunny" | "cloudy" | "rain" | "unknown"; label: string };

const MAX_AGE = 25 * 60 * 1000;

function moment(): Atmosphere["time"] {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  return hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "day" : hour >= 17 && hour < 19.5 ? "sunset" : "night";
}

function describe(code: number): Atmosphere["weather"] {
  if ([0, 1].includes(code)) return "sunny";
  if ([2, 3, 45, 48].includes(code)) return "cloudy";
  return Number.isFinite(code) ? "rain" : "unknown";
}

export function useCircularAtmosphere(latitude: number | null, longitude: number | null, authorized = false): Atmosphere & { observation: (Weather & { source:string; expiresAt:number }) | null } {
  const [time, setTime] = useState(moment);
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setTime(moment()); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15 * 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!authorized || latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) { setWeather(null); return; }
    const key = `utopy:map-weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
    const controller = new AbortController();
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      let cached: Weather | null = null;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        if (parsed && Number.isFinite(parsed.temperature) && Number.isFinite(parsed.code) && Number.isFinite(parsed.updatedAt)) cached = parsed;
      } catch { /* El cache es opcional. */ }
      const fresh=cached && cached.updatedAt<=Date.now()+5000 && Date.now()-cached.updatedAt<MAX_AGE;
      if (active) setWeather(fresh?{...cached!,areaKey:key}:null);
      if (fresh) return;
      pending = true;
      try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", latitude.toFixed(2));
        url.searchParams.set("longitude", longitude.toFixed(2));
        url.searchParams.set("current", "temperature_2m,weather_code");
        url.searchParams.set("forecast_days", "1");
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) return;
        const current = (await response.json())?.current;
        if (!Number.isFinite(current?.temperature_2m) || !Number.isFinite(current?.weather_code)) return;
        const next = { temperature: current.temperature_2m, code: current.weather_code, updatedAt: Date.now(),areaKey:key };
        if (!active) return;
        setWeather(next);
        try {
          const keys=Object.keys(localStorage).filter(value=>value.startsWith('utopy:map-weather:'));
          for(const old of keys){try{const entry=JSON.parse(localStorage.getItem(old)||'null');if(!entry||!Number.isFinite(entry.updatedAt)||Date.now()-entry.updatedAt>=MAX_AGE)localStorage.removeItem(old);}catch{localStorage.removeItem(old);}}
          const remaining=Object.keys(localStorage).filter(value=>value.startsWith('utopy:map-weather:')&&value!==key);
          while(remaining.length>=8)localStorage.removeItem(remaining.shift()!);
          localStorage.setItem(key, JSON.stringify(next));
        } catch { /* Disponible sin almacenamiento. */ }
      } catch { /* Si no hay red conservamos la última observación. */ }
      finally { pending = false; }
    };
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; controller.abort(); window.removeEventListener("focus", onFocus); };
  }, [latitude, longitude, authorized]);

  const areaKey=latitude==null||longitude==null?'':`utopy:map-weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const valid=authorized && weather && weather.areaKey===areaKey && weather.updatedAt<=Date.now()+5000 && Date.now()-weather.updatedAt<MAX_AGE ? weather : null;
  const condition = valid ? describe(valid.code) : "unknown";
  const icon = condition === "rain" ? "☂" : condition === "cloudy" ? "☁" : time === "night" ? "☾" : "☀";
  return { time, weather: condition, label: valid ? `${icon} ${Math.round(valid.temperature)}°` : "", observation:valid?{...valid,source:'https://api.open-meteo.com/v1/forecast',expiresAt:valid.updatedAt+MAX_AGE}:null };
}
