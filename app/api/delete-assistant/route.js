import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const { assistantId } = await request.json();
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'غير مصرح.' }, { status: 401 });
    }
    if (!assistantId) {
      return NextResponse.json({ error: 'معرّف المساعد مطلوب.' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerData?.user) {
      return NextResponse.json({ error: 'الجلسة غير صالحة.' }, { status: 401 });
    }
    const callerId = callerData.user.id;

    // تأكد إن المساعد ده فعلاً تابع للمدرس اللي بيطلب الحذف
    const { data: assistantProfile } = await admin
      .from('profiles')
      .select('owner_id, role')
      .eq('id', assistantId)
      .single();

    if (!assistantProfile || assistantProfile.role !== 'assistant' || assistantProfile.owner_id !== callerId) {
      return NextResponse.json({ error: 'مش مسموح لك تحذف الحساب ده.' }, { status: 403 });
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(assistantId);
    if (deleteError) {
      return NextResponse.json({ error: 'تعذّر حذف الحساب، حاول تاني.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'حصلت مشكلة غير متوقعة.' }, { status: 500 });
  }
}
