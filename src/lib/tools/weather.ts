import { fetchJson } from "./http";

export interface DailyWeather {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationProbability: number | null;
  summary: string;
}

export interface WeatherReport {
  source: "forecast" | "unavailable";
  days: DailyWeather[];
  note?: string;
}

interface OpenMeteoDaily {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    weather_code: number[];
  };
}

// Open-Meteo forecasts reach 16 days ahead.
const FORECAST_HORIZON_DAYS = 16;

/** Daily forecast for the trip dates from Open-Meteo (free, no key). */
export async function getWeather(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  today: Date = new Date(),
): Promise<WeatherReport> {
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + FORECAST_HORIZON_DAYS - 1);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  if (startDate > horizonIso || endDate < todayIso) {
    return {
      source: "unavailable",
      days: [],
      note: "Trip dates are outside the 16-day forecast window; plan for typical seasonal weather.",
    };
  }

  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
      timezone: "auto",
      start_date: startDate < todayIso ? todayIso : startDate,
      end_date: endDate > horizonIso ? horizonIso : endDate,
    });
  const { daily } = await fetchJson<OpenMeteoDaily>("Open-Meteo", url);
  return {
    source: "forecast",
    days: daily.time.map((date, i) => ({
      date,
      tempMaxC: daily.temperature_2m_max[i],
      tempMinC: daily.temperature_2m_min[i],
      precipitationProbability: daily.precipitation_probability_max[i] ?? null,
      summary: describeWeatherCode(daily.weather_code[i]),
    })),
  };
}

/** WMO weather interpretation codes, condensed. */
export function describeWeatherCode(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}
