// 0=الأحد ... 6=السبت — نفس ترقيم JavaScript Date.getDay()
export const WEEKDAY_LABELS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
// ترتيب العرض في كل شاشات التطبيق: الأسبوع يبدأ سبت وينتهي جمعة.
// (الأرقام المخزّنة في قاعدة البيانات بتفضل بنفس ترقيم JavaScript Date.getDay() زي ما هي)
export const SATURDAY_FIRST_ORDER = [6, 0, 1, 2, 3, 4, 5];

export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export const PAYMENT_STATUS_COLORS = {
  paid: '#16a34a',
  partial: '#ea580c',
  unpaid: '#dc2626',
};

export const PAYMENT_STATUS_LABELS = {
  paid: 'دافع',
  partial: 'دفع جزء',
  unpaid: 'لم يدفع',
};

export const ATTENDANCE_STATUS_LABELS = {
  present: 'حاضر',
  late: 'تأخير',
  absent: 'غائب',
};

export const ATTENDANCE_STATUS_COLORS = {
  present: '#16a34a',
  late: '#ea580c',
  absent: '#dc2626',
};
