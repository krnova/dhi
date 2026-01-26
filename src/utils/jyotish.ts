import * as SunCalc from 'suncalc';

// Planetary sequence for each day (0 = Sunday)
const DAY_RULERS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

// Chaldean order for planetary hours
const PLANETARY_ORDER = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];

// Planetary qualities and activities
const PLANET_DATA = {
  Sun: { color: '#f59e0b', quality: 'auspicious' as const, activity: 'Leadership', dayActivity: 'Authority', nightActivity: 'Recovery' },
  Moon: { color: '#60a5fa', quality: 'neutral' as const, activity: 'Emotions', dayActivity: 'Intuition', nightActivity: 'Dreams' },
  Mars: { color: '#ef4444', quality: 'neutral' as const, activity: 'Action', dayActivity: 'Courage', nightActivity: 'Rest' },
  Mercury: { color: '#10b981', quality: 'neutral' as const, activity: 'Communication', dayActivity: 'Learning', nightActivity: 'Planning' },
  Jupiter: { color: '#8b5cf6', quality: 'auspicious' as const, activity: 'Wisdom', dayActivity: 'Expansion', nightActivity: 'Study' },
  Venus: { color: '#ec4899', quality: 'auspicious' as const, activity: 'Creativity', dayActivity: 'Beauty', nightActivity: 'Art' },
  Saturn: { color: '#6b7280', quality: 'inauspicious' as const, activity: 'Discipline', dayActivity: 'Work', nightActivity: 'Solitude' },
};

export interface PlanetaryHour {
  planet: string;
  color: string;
  quality: 'auspicious' | 'neutral' | 'inauspicious';
  activity: string;
  isDaytime: boolean;
  hourNumber: number;
  startTime: Date;
  endTime: Date;
}

export interface JyotishData {
  currentHour: PlanetaryHour;
  sunrise: Date;
  sunset: Date;
  dayRuler: string;
}

/**
 * Get the planetary ruler for a given day of week
 */
function getDayRuler(date: Date): string {
  return DAY_RULERS[date.getDay()];
}

/**
 * Get the next planet in Chaldean order
 */
function getNextPlanet(currentPlanet: string): string {
  const currentIndex = PLANETARY_ORDER.indexOf(currentPlanet);
  const nextIndex = (currentIndex + 1) % PLANETARY_ORDER.length;
  return PLANETARY_ORDER[nextIndex];
}

/**
 * Calculate planetary hours for a given date and location
 */
export function calculatePlanetaryHours(
  date: Date,
  latitude: number,
  longitude: number
): JyotishData | null {
  try {
    // Get sun times for the location
    const times = SunCalc.getTimes(date, latitude, longitude);
    const sunrise = times.sunrise;
    const sunset = times.sunset;

    // Check if sunrise/sunset are valid
    if (!sunrise || !sunset || isNaN(sunrise.getTime()) || isNaN(sunset.getTime())) {
      console.error('Invalid sunrise/sunset times');
      return null;
    }

    const now = date;
    const isDaytime = now >= sunrise && now < sunset;

    // Calculate hour length
    let periodStart: Date;
    let periodEnd: Date;
    
    if (isDaytime) {
      periodStart = sunrise;
      periodEnd = sunset;
    } else {
      // Night time - from sunset to next sunrise
      const tomorrow = new Date(date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextSunrise = SunCalc.getTimes(tomorrow, latitude, longitude).sunrise;
      
      if (now < sunrise) {
        // Before sunrise - use previous sunset
        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);
        periodStart = SunCalc.getTimes(yesterday, latitude, longitude).sunset;
        periodEnd = sunrise;
      } else {
        // After sunset
        periodStart = sunset;
        periodEnd = nextSunrise;
      }
    }

    const periodDuration = periodEnd.getTime() - periodStart.getTime();
    const hourLength = periodDuration / 12;

    // Get day ruler
    // Vedic days run from sunrise to sunrise
    // If before sunrise, use previous day's ruler
    let dayRulerDate = new Date(date);
    if (date < sunrise) {
      // Before sunrise = still previous Vedic day
      dayRulerDate.setDate(dayRulerDate.getDate() - 1);
    }
    const dayRuler = getDayRuler(dayRulerDate);

    // Calculate which planetary hour we're in
    const elapsedTime = now.getTime() - periodStart.getTime();
    const hourNumber = Math.floor(elapsedTime / hourLength);
    
    // Clamp hour number between 0-11
    const clampedHourNumber = Math.max(0, Math.min(11, hourNumber));

    // Calculate planetary ruler for this hour
    let planet = dayRuler;
    
    // If daytime, start from day ruler at hour 0
    // If nighttime, continue sequence from where day ended
    if (!isDaytime) {
      // Day ends at hour 12, so night starts at hour 13 in sequence
      for (let i = 0; i < 12; i++) {
        planet = getNextPlanet(planet);
      }
    }
    
    // Advance to current hour
    for (let i = 0; i < clampedHourNumber; i++) {
      planet = getNextPlanet(planet);
    }

    const planetData = PLANET_DATA[planet as keyof typeof PLANET_DATA];
    const activity = isDaytime ? planetData.dayActivity : planetData.nightActivity;

    const hourStart = new Date(periodStart.getTime() + (clampedHourNumber * hourLength));
    const hourEnd = new Date(periodStart.getTime() + ((clampedHourNumber + 1) * hourLength));

    const currentHour: PlanetaryHour = {
      planet,
      color: planetData.color,
      quality: planetData.quality,
      activity,
      isDaytime,
      hourNumber: clampedHourNumber + 1, // 1-indexed for display
      startTime: hourStart,
      endTime: hourEnd,
    };

    return {
      currentHour,
      sunrise,
      sunset,
      dayRuler,
    };
  } catch (error) {
    console.error('Error calculating planetary hours:', error);
    return null;
  }
}

/**
 * Get default location (Delhi, India as fallback)
 */
export function getDefaultLocation(): { latitude: number; longitude: number } {
  return {
    latitude: 28.6139, // Delhi
    longitude: 77.2090,
  };
}
