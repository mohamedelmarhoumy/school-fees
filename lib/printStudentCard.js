/**
 * بيفتح نافذة جديدة فيها كارنيه الطالب (اسم + صف + مجموعة + QR) بمقاس كارت بلاستيك
 * قياسي (85.6mm × 54mm) وبيشغّل حوار الطباعة تلقائياً، بنفس أسلوب printReport.js.
 */
export function printStudentCard({ studentName, studentNumber, gradeName, groupName, qrDataUrl, schoolName }) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('المتصفح منع فتح نافذة جديدة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>كارنيه الطالب — ${studentName}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #111827; background: #f1f5f9; }
  .hint { text-align: center; color: #6b7280; font-size: 12.5px; margin-bottom: 16px; }
  .card {
    width: 85.6mm;
    height: 54mm;
    margin: 0 auto 14px;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    background: linear-gradient(135deg, #ffffff, #f8fafc);
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  }
  .card-info { flex: 1; min-width: 0; }
  .card-school { font-size: 10px; color: #6b7280; font-weight: 700; margin-bottom: 6px; }
  .card-name { font-size: 15px; font-weight: 800; margin-bottom: 4px; overflow-wrap: break-word; }
  .card-line { font-size: 11px; color: #374151; margin-bottom: 2px; }
  .card-qr { width: 30mm; height: 30mm; flex-shrink: 0; }
  .card-qr img { width: 100%; height: 100%; object-fit: contain; }
  @media print {
    body { padding: 0; background: #fff; }
    .hint { display: none; }
    .card { box-shadow: none; page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="hint">هيتفتح حوار الطباعة تلقائياً — تقدر تطبع على كارت بلاستيك أو ورقي وتقصّه.</div>
  <div class="card">
    <div class="card-info">
      <div class="card-school">${schoolName || 'كارنيه الطالب'}</div>
      <div class="card-name">${studentName}</div>
      ${gradeName ? `<div class="card-line">الصف: ${gradeName}</div>` : ''}
      ${groupName ? `<div class="card-line">المجموعة: ${groupName}</div>` : ''}
      ${studentNumber ? `<div class="card-line">رقم الطالب: ${studentNumber}</div>` : ''}
    </div>
    <div class="card-qr"><img src="${qrDataUrl}" alt="QR" /></div>
  </div>
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
