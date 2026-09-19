/** ينزّل أي كائن JavaScript كملف JSON قابل للتنزيل. */
export function downloadJson(filename, dataObj) {
  const jsonContent = JSON.stringify(dataObj, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
