import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return respond(405, { error: 'დაუშვებელი მოთხოვნა.' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const siteUrl = Deno.env.get('STAGE90_SITE_URL');
  if (!url || !serviceKey || !siteUrl) return respond(500, { error: 'რეგისტრაციის სერვისი არ არის გამართული.' });

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return respond(401, { error: 'საჭიროა ავტორიზაცია.' });

  const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller, error: callerError } = await client.auth.getUser(token);
  if (callerError || !caller.user) return respond(401, { error: 'საჭიროა ავტორიზაცია.' });
  const { data: admin } = await client.from('profiles').select('role').eq('id', caller.user.id).maybeSingle();
  if (admin?.role !== 'admin') return respond(403, { error: 'ამ მოქმედების უფლება არ გაქვთ.' });

  let body: { requestId?: string; decision?: string };
  try { body = await request.json(); } catch { return respond(400, { error: 'მოთხოვნა არასწორია.' }); }
  if (!body.requestId || !['approve', 'reject'].includes(body.decision ?? '')) {
    return respond(400, { error: 'მოთხოვნა არასწორია.' });
  }

  const { data: application } = await client.from('registration_requests').select('*')
    .eq('id', body.requestId).eq('status', 'pending').maybeSingle();
  if (!application) return respond(404, { error: 'განაცხადი ვერ მოიძებნა ან უკვე განხილულია.' });

  const nextStatus = body.decision === 'approve' ? 'approved' : 'rejected';
  const { data: claimed, error: claimError } = await client.from('registration_requests')
    .update({ status: nextStatus, reviewed_at: new Date().toISOString(), reviewed_by: caller.user.id })
    .eq('id', application.id).eq('status', 'pending').select('id').maybeSingle();
  if (claimError || !claimed) return respond(409, { error: 'განაცხადი უკვე განხილულია.' });
  if (body.decision === 'reject') return respond(200, { status: 'rejected' });

  const redirectTo = new URL('/?stage90_invite=1', siteUrl).toString();
  const metadata = {
    role: application.requested_role,
    display_name: application.display_name,
    artist_name: application.requested_role === 'author' ? application.display_name : undefined,
    verification_link: application.social_url,
    social_url: application.social_url,
    registration_request_id: application.id,
    approval_token: application.approval_token,
  };
  const { data: invitation, error: inviteError } = await client.auth.admin.inviteUserByEmail(
    application.email, { data: metadata, redirectTo },
  );
  if (inviteError || !invitation.user) {
    await client.from('registration_requests').update({ status: 'pending', reviewed_at: null, reviewed_by: null })
      .eq('id', application.id);
    return respond(502, { error: 'მოწვევის გაგზავნა ვერ მოხერხდა. შეამოწმეთ ელ-ფოსტა და საფოსტო სერვისი.' });
  }

  const { error: profileError } = await client.from('profiles').upsert({
    id: invitation.user.id,
    email: application.email,
    display_name: application.display_name,
    artist_name: application.requested_role === 'author' ? application.display_name : null,
    verification_link: application.social_url,
    role: application.requested_role,
    is_verified: true,
  }, { onConflict: 'id' });
  if (profileError) {
    await client.auth.admin.deleteUser(invitation.user.id);
    await client.from('registration_requests').update({ status: 'pending', reviewed_at: null, reviewed_by: null })
      .eq('id', application.id);
    return respond(500, { error: 'პროფილის შექმნა ვერ მოხერხდა.' });
  }

  await client.from('registration_requests').update({ invited_user_id: invitation.user.id })
    .eq('id', application.id);
  return respond(200, { status: 'approved' });
});
