/**
 * Holidays Roxy celebrates. Each has a collection in the catalog (`holiday: id`), one of which is a free gift
 * while its window is open: the week before the first day, through the last day. Days are the family's local
 * day (`YYYY-MM-DD`), the same day streaks use.
 */

export const HOLIDAYS = [
	"newyear",
	"lunarnewyear",
	"valentines",
	"holi",
	"eidalfitr",
	"passover",
	"easter",
	"earthday",
	"eidaladha",
	"halloween",
	"diadelosmuertos",
	"diwali",
	"thanksgiving",
	"hanukkah",
	"christmas",
	"kwanzaa",
] as const;
export type HolidayId = (typeof HOLIDAYS)[number];

export const HOLIDAY_LABEL: Record<HolidayId, string> = {
	newyear: "New Year",
	lunarnewyear: "Lunar New Year",
	valentines: "Valentine’s Day",
	holi: "Holi",
	eidalfitr: "Eid al-Fitr",
	passover: "Passover",
	easter: "Easter",
	earthday: "Earth Day",
	eidaladha: "Eid al-Adha",
	halloween: "Halloween",
	diadelosmuertos: "Día de los Muertos",
	diwali: "Diwali",
	thanksgiving: "Thanksgiving",
	hanukkah: "Hanukkah",
	christmas: "Christmas",
	kwanzaa: "Kwanzaa",
};

/** One line a kid can read about each holiday, shown on its banner. */
export const HOLIDAY_NOTE: Record<HolidayId, string> = {
	newyear: "A brand-new year begins.",
	lunarnewyear: "The new year on the lunar calendar, with lanterns and red for luck.",
	valentines: "A day for hearts and kind notes to friends.",
	holi: "The festival of colours, welcoming spring.",
	eidalfitr: "The joyful feast at the end of Ramadan.",
	passover: "Eight days remembering the journey to freedom.",
	easter: "A spring celebration with eggs and flowers.",
	earthday: "A day to care for our planet.",
	eidaladha: "The festival of sharing, with family and feasts.",
	halloween: "Costumes, pumpkins and spooky fun.",
	diadelosmuertos: "Remembering loved ones with marigolds and music.",
	diwali: "The festival of lights.",
	thanksgiving: "Saying thank you with family and food.",
	hanukkah: "Eight nights of lights.",
	christmas: "Trees, lights and giving.",
	kwanzaa: "Seven days celebrating family, community and culture.",
};

/** How many days each lasts, counting the first. */
const LENGTH: Record<HolidayId, number> = {
	newyear: 1,
	lunarnewyear: 7,
	valentines: 1,
	holi: 2,
	eidalfitr: 3,
	passover: 8,
	easter: 1,
	earthday: 1,
	eidaladha: 4,
	halloween: 1,
	diadelosmuertos: 2,
	diwali: 5,
	thanksgiving: 1,
	hanukkah: 8,
	christmas: 1,
	kwanzaa: 7,
};

/** Days before the first day that the collection opens. */
export const LEAD_DAYS = 7;

/**
 * First days of holidays on lunar or lunisolar calendars, by year. Islamic dates depend on the moon being seen,
 * so they can shift by a day; the week-long window covers that. Extend this table before 2031 — a test fails
 * when a year is missing.
 */
export const HOLIDAY_DATES: Partial<Record<HolidayId, Record<number, string>>> = {
	lunarnewyear: { 2026: "02-17", 2027: "02-06", 2028: "01-26", 2029: "02-13", 2030: "02-03" },
	holi: { 2026: "03-04", 2027: "03-22", 2028: "03-11", 2029: "03-01", 2030: "03-20" },
	eidalfitr: { 2026: "03-20", 2027: "03-10", 2028: "02-27", 2029: "02-15", 2030: "02-05" },
	passover: { 2026: "04-02", 2027: "04-22", 2028: "04-11", 2029: "03-31", 2030: "04-18" },
	eidaladha: { 2026: "05-27", 2027: "05-16", 2028: "05-05", 2029: "04-24", 2030: "04-13" },
	diwali: { 2026: "11-08", 2027: "10-29", 2028: "10-17", 2029: "11-05", 2030: "10-26" },
	hanukkah: { 2026: "12-05", 2027: "12-25", 2028: "12-13", 2029: "12-02", 2030: "12-21" },
};

const FIXED: Partial<Record<HolidayId, string>> = {
	newyear: "01-01",
	valentines: "02-14",
	earthday: "04-22",
	halloween: "10-31",
	diadelosmuertos: "11-01",
	christmas: "12-25",
	kwanzaa: "12-26",
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (day: string, n: number) => {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return iso(d);
};

/** Easter Sunday (Western), by the anonymous Gregorian algorithm. */
export function easter(year: number): string {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return `${year}-${pad(month)}-${pad(day)}`;
}

/** US Thanksgiving: the fourth Thursday of November. */
export function thanksgiving(year: number): string {
	const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();
	return `${year}-11-${pad(1 + ((4 - first + 7) % 7) + 21)}`;
}

/** The first day of a holiday in a year, or null when the date table doesn't reach that year yet. */
export function holidayStart(id: HolidayId, year: number): string | null {
	if (id === "easter") return easter(year);
	if (id === "thanksgiving") return thanksgiving(year);
	const fixed = FIXED[id];
	if (fixed) return `${year}-${fixed}`;
	const md = HOLIDAY_DATES[id]?.[year];
	return md ? `${year}-${md}` : null;
}

export type HolidayWindow = { id: HolidayId; start: string; first: string; end: string };

/** The collection's window: it opens LEAD_DAYS before the first day and closes after the last. */
export function holidayWindow(id: HolidayId, year: number): HolidayWindow | null {
	const first = holidayStart(id, year);
	if (!first) return null;
	return { id, start: addDays(first, -LEAD_DAYS), first, end: addDays(first, LENGTH[id] - 1) };
}

/** Holidays whose window includes `day`. Checks last year's too, so Kwanzaa still shows on New Year's Day. */
export function activeHolidays(day: string): HolidayWindow[] {
	const year = Number(day.slice(0, 4));
	const out: HolidayWindow[] = [];
	for (const id of HOLIDAYS) {
		for (const y of [year - 1, year, year + 1]) {
			const w = holidayWindow(id, y);
			if (w && w.start <= day && day <= w.end) {
				out.push(w);
				break;
			}
		}
	}
	return out.sort((a, b) => a.first.localeCompare(b.first));
}

/** Whole days between two `YYYY-MM-DD` dates (b − a). */
export function daysBetween(a: string, b: string): number {
	return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
