/*
  What a report is allowed to say about a player.

  This is a privacy control, not a layout option, and the default is the point:
  a fresh report carries the player's name, position, club, the period and the
  development content. Not their date of birth, not their height and weight, not
  their contact details. Everything beyond the minimum is added by the player,
  one field at a time, and the preview shows exactly what a recipient will see.

  Reports are the only surface in MIDO XI where a young player's data leaves the
  platform. Getting the default wrong here is not a bad experience — it is a
  disclosure they did not make.

  Client-safe: identifiers and labels only.
*/

export type ReportField =
  | "dateOfBirth"
  | "physical"
  | "nationality"
  | "contact"
  | "matchLog"
  | "filmObservations"
  | "checkins"
  | "coachFeedback";

export interface FieldDef {
  id: ReportField;
  label: string;
  hint: string;
  /** Personal data about the player rather than a record of their football. */
  sensitive?: boolean;
}

export const REPORT_FIELDS: FieldDef[] = [
  {
    id: "matchLog",
    label: "Match log",
    hint: "Every match in the period, with minutes and returns.",
  },
  {
    id: "filmObservations",
    label: "Film observations",
    hint: "What MIDO read on your film, with its confidence marked.",
  },
  {
    id: "coachFeedback",
    label: "Coach feedback",
    hint: "Notes your coach wrote. They are attributed, and you choose whether they appear.",
  },
  {
    id: "checkins",
    label: "Check-ins",
    hint: "How you reported feeling. Personal — most reports do not need it.",
    sensitive: true,
  },
  {
    id: "physical",
    label: "Height and weight",
    hint: "Physical measurements.",
    sensitive: true,
  },
  {
    id: "dateOfBirth",
    label: "Date of birth",
    hint: "Identifying, especially for a young player. Age alone is usually enough.",
    sensitive: true,
  },
  {
    id: "nationality",
    label: "Nationality",
    hint: "Shown on the header line.",
    sensitive: true,
  },
  {
    id: "contact",
    label: "Contact email",
    hint: "Only for a report you are sending to a club or trial.",
    sensitive: true,
  },
];

/**
 * The minimum a development report needs to be worth reading.
 *
 * Nothing sensitive is on this list, and that is deliberate — it is the shape
 * of a report a player produces without thinking about it.
 */
export const DEFAULT_FIELDS: ReportField[] = ["matchLog", "filmObservations"];

/** Parse the `?show=` parameter. Unknown names are dropped, not guessed at. */
export function parseFields(value: string | string[] | undefined): ReportField[] {
  if (value === undefined) return DEFAULT_FIELDS;
  const raw = (Array.isArray(value) ? value.join(",") : value).split(",").map((s) => s.trim());
  const known = new Set(REPORT_FIELDS.map((f) => f.id));
  return raw.filter((s): s is ReportField => known.has(s as ReportField));
}

export function fieldsToParam(fields: ReportField[]): string {
  return fields.join(",");
}

export function fieldDef(id: ReportField): FieldDef {
  return REPORT_FIELDS.find((f) => f.id === id) ?? REPORT_FIELDS[0];
}
