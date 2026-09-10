/** يبني ملف CSV (يفتح مباشرة في Excel) وينزّله على الجهاز. */
export function downloadCsv(filename, headers, rows) {
  const escapeCell = (cell) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // BOM لضمان ظهور الحروف العربية بشكل صحيح عند فتح الملف في Excel
  const bom = '\uFEFF';
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  const csvContent = bom + lines.join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
