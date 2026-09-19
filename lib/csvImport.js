/** يقسّم نص CSV لصفوف/أعمدة، مع دعم بسيط للحقول المحاطة بعلامات تنصيص. */
export function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);

  for (const line of lines) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }

  return rows;
}
