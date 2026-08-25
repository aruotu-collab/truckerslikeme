export type ParsedLoad = {
  origin: string | null;
  destination: string | null;
  miles: number | null;
  rateTotal: number | null;
  ratePerMile: number | null;
  notes: string[];
};

function money(n: string) {
  return Number(n.replace(/,/g, ""));
}

/**
 * Lightweight rate-conf / load board paste parser (no AI required).
 * Pulls origin/dest, miles, total rate, and RPM when present.
 */
export function parseLoadText(raw: string): ParsedLoad {
  const text = raw.replace(/\r/g, "\n");
  const notes: string[] = [];
  let origin: string | null = null;
  let destination: string | null = null;
  let miles: number | null = null;
  let rateTotal: number | null = null;
  let ratePerMile: number | null = null;

  const milesMatch =
    text.match(
      /(?:total\s*)?(?:trip\s*)?miles?[\s:]*([0-9]{2,5}(?:,[0-9]{3})?)/i,
    ) ||
    text.match(/\b([0-9]{3,4})\s*(?:mi|miles)\b/i) ||
    text.match(/\bmi(?:les)?[\s:]*([0-9]{2,5})/i);
  if (milesMatch) {
    miles = Math.round(money(milesMatch[1]));
  }

  const totalRate =
    text.match(
      /(?:line\s*haul|linehaul|total\s*rate|rate\s*total|pay(?:ment)?|amount)[\s:]*\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    ) ||
    text.match(
      /\$\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)\b/,
    ) ||
    text.match(
      /\$\s*([0-9]{3,5}(?:\.[0-9]{1,2})?)\b/,
    );
  if (totalRate) {
    rateTotal = money(totalRate[1]);
  }

  const rpmMatch =
    text.match(
      /(?:rate\s*per\s*mile|per\s*mile|\$?\/\s*mi|rpm)[\s:]*\$?\s*([0-9]+(?:\.[0-9]{1,3})?)/i,
    ) || text.match(/\$\s*([0-9]\.[0-9]{2})\s*(?:\/|per)\s*mi/i);
  if (rpmMatch) {
    ratePerMile = money(rpmMatch[1]);
  }

  // Match place → place on a single line (UK postcodes / counties OK).
  // Do not use \s in place tokens — it would swallow newlines.
  const arrow =
    text.match(
      /([A-Za-z0-9][A-Za-z0-9 .',-]{1,70})\s*(?:→|->|–|—)\s*([A-Za-z0-9][A-Za-z0-9 .',-]{1,70})/,
    ) ||
    text.match(
      /(?:from|origin|pu|pickup)[\s:]+([^\n]{2,70}?).{0,12}?(?:to|dest|delivery|del)[\s:]+([^\n]{2,70})/im,
    );

  // US City, ST → City, ST (exact uppercase regions only — not "DE" from Devon)
  const usStyle = text.match(
    /\b([A-Za-z][A-Za-z .'-]{1,28}),?\s*([A-Z]{2})\s*(?:→|->|to|–|—)\s*([A-Za-z][A-Za-z .'-]{1,28}),?\s*([A-Z]{2})\b/,
  );

  if (arrow) {
    origin = arrow[1].trim().replace(/^(?:item|miles|rate)\s*:\s*/i, "");
    destination = arrow[2].trim();
  } else if (
    usStyle &&
    /^[A-Z]{2}$/.test(usStyle[2]) &&
    /^[A-Z]{2}$/.test(usStyle[4])
  ) {
    origin = `${usStyle[1].trim()}, ${usStyle[2]}`;
    destination = `${usStyle[3].trim()}, ${usStyle[4]}`;
  }

  if (rateTotal == null && ratePerMile != null && miles != null) {
    rateTotal = Math.round(ratePerMile * miles * 100) / 100;
    notes.push("Total rate estimated from RPM × miles.");
  }
  if (ratePerMile == null && rateTotal != null && miles != null && miles > 0) {
    ratePerMile = Math.round((rateTotal / miles) * 1000) / 1000;
  }

  if (miles == null) notes.push("Could not find trip miles — enter manually.");
  if (rateTotal == null)
    notes.push("Could not find total rate — enter manually.");

  return { origin, destination, miles, rateTotal, ratePerMile, notes };
}
