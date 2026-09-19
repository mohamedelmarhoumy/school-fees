/**
 * بيفتح نافذة جديدة فيها تقرير HTML منسّق ويشغّل حوار الطباعة تلقائياً —
 * المستخدم يختار "حفظ كـ PDF" من نافذة الطباعة نفسها. الطريقة دي بتضمن
 * ظهور العربي صح 100% (لأنها استخدام عادي للمتصفح) بدون أي مكتبة PDF
 * بتحتاج تضمين خط عربي يدوي وممكن تسبب مشاكل ترميز.
 */
export function printReport({ title, subtitle, columns, rows, totalsLine }) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('المتصفح منع فتح نافذة جديدة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return;
  }

  const tableRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #111827; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: right; }
  th { background: #f3f4f6; font-weight: 700; }
  .totals { margin-top: 14px; font-weight: 700; font-size: 14px; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <h1>${title}</h1>
  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
  <table>
    <thead><tr>${columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  ${totalsLine ? `<div class="totals">${totalsLine}</div>` : ''}
  <script>
    window.onload = function () {
      window.print();
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
