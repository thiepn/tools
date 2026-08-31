export interface SalaryEquivalents {
  annual: number;
  monthly: number;
  weekly: number;
  dailyFiveDayWeek: number;
  hourly: number;
}

function validateWorkSchedule(hoursPerWeek: number, paidWeeksPerYear: number): void {
  if (!(hoursPerWeek > 0)) throw new Error('Hours per week must be greater than zero.');
  if (!(paidWeeksPerYear > 0)) throw new Error('Paid weeks per year must be greater than zero.');
}

function fromAnnual(annual: number, hoursPerWeek: number, paidWeeksPerYear: number): SalaryEquivalents {
  validateWorkSchedule(hoursPerWeek, paidWeeksPerYear);
  if (annual < 0) throw new Error('Annual salary cannot be negative.');
  const weekly = annual / paidWeeksPerYear;
  return {
    annual,
    monthly: annual / 12,
    weekly,
    dailyFiveDayWeek: weekly / 5,
    hourly: annual / (hoursPerWeek * paidWeeksPerYear),
  };
}

export function salaryEquivalentsFromAnnual(
  annualSalary: number,
  hoursPerWeek: number,
  paidWeeksPerYear: number,
): SalaryEquivalents {
  return fromAnnual(annualSalary, hoursPerWeek, paidWeeksPerYear);
}

export function salaryEquivalentsFromHourly(
  hourlyWage: number,
  hoursPerWeek: number,
  paidWeeksPerYear: number,
): SalaryEquivalents {
  validateWorkSchedule(hoursPerWeek, paidWeeksPerYear);
  if (hourlyWage < 0) throw new Error('Hourly wage cannot be negative.');
  return fromAnnual(hourlyWage * hoursPerWeek * paidWeeksPerYear, hoursPerWeek, paidWeeksPerYear);
}
