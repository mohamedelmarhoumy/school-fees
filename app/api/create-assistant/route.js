import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, display_name, permissions } = body || {};
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    }
    if (!email || !password) {
      return NextResponse.json({ error: 'الإيميل وكلمة المرور مطلوبين.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور لازم تكون 6 حروف/أرقام على الأقل.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // تأكد إن اللي بيطلب ده صاحب حساب (owner) فعلاً ونشط
    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerData?.user) {
      return NextResponse.json({ error: 'الجلسة غير صالحة.' }, { status: 401 });
    }
    const callerId = callerData.user.id;

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerId)
      .single();

    if (!callerProfile || callerProfile.role !== 'owner' || !callerProfile.is_active) {
      return NextResponse.json({ error: 'مسموح للمدرس (صاحب الحساب) بس يضيف مساعدين.' }, { status: 403 });
    }

    // إنشاء حساب الدخول للمساعد
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      const msg = createError?.message?.includes('already registered')
        ? 'الإيميل ده متسجّل بالفعل.'
        : 'تعذّر إنشاء الحساب، حاول تاني.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // ربط المساعد بالمدرس + الصلاحيات (upsert عشان يتغلّب على أي صف افتراضي
    // ممكن يكون اتعمل تلقائي بالـ trigger وقت إنشاء الحساب)
    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: newUser.user.id,
        owner_id: callerId,
        role: 'assistant',
        email,
        display_name: display_name || email,
        can_attendance: !!permissions?.attendance,
        can_payments: !!permissions?.payments,
        can_students: !!permissions?.students,
        can_view_financials: !!permissions?.financials,
        is_active: true,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      return NextResponse.json({ error: 'اتعمل الحساب لكن حصلت مشكلة في ضبط الصلاحيات.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: newUser.user.id });
  } catch (err) {
    return NextResponse.json({ error: 'حصلت مشكلة غير متوقعة.' }, { status: 500 });
  }
}
