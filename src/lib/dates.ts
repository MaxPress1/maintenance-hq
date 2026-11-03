const kyivDate = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric" });

export function formatDate(value: string | null) {
  return value ? kyivDate.format(new Date(value)) : "Не вказано";
}

export function dateInput(value: string | null) {
  if (!value) return "";
  const parts = kyivDate.formatToParts(new Date(value));
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

export function endOfKyivDay(value: string) {
  if (!value) return null;
  const noon = new Date(`${value}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Kyiv", timeZoneName: "longOffset" })
    .formatToParts(noon).find((part) => part.type === "timeZoneName")!.value.replace("GMT", "");
  return new Date(`${value}T23:59:59${offset}`).toISOString();
}