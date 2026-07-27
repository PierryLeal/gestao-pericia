import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(url, serviceKey);

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@admin.com',
    password: 'admin123',
    email_confirm: true,
  });
  if (error) throw error;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'admin', nome: 'Administrador' })
    .eq('id', data.user.id);
  if (profileError) throw profileError;

  console.log(`Admin seeded: ${data.user.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
