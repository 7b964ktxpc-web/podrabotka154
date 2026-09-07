const errors=[];const required=['NEXT_PUBLIC_APP_URL','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];for(const k of required)if(!process.env[k])errors.push(k+' is missing');
for(const k of ['NEXT_PUBLIC_APP_URL','SUPABASE_URL'])if(process.env[k]&&!URL.canParse(process.env[k]))errors.push(k+' is not a URL');
if(process.env.NODE_ENV==='production'&&process.env.NEXT_PUBLIC_APP_URL&&!process.env.NEXT_PUBLIC_APP_URL.startsWith('https://'))errors.push('Production APP_URL must be HTTPS');
if(process.env.DEMO_DATA==='true')errors.push('DEMO_DATA is not supported by this release; use an isolated test database');
if(process.env.PAYMENT_PROVIDER&&process.env.PAYMENT_PROVIDER!=='sandbox')errors.push('Only sandbox payment provider is implemented');
if(process.env.SANDBOX_PAYMENTS_ENABLED==='true'&&(process.env.PAYMENT_WEBHOOK_SECRET||'').length<32)errors.push('PAYMENT_WEBHOOK_SECRET must contain at least 32 random characters');
if(process.env.TELEGRAM_BOT_TOKEN&&(process.env.TELEGRAM_WEBHOOK_SECRET||'').length<32)errors.push('TELEGRAM_WEBHOOK_SECRET must contain at least 32 random characters');
if(Boolean(process.env.PUSH_PUBLIC_KEY)!==Boolean(process.env.PUSH_PRIVATE_KEY))errors.push('Both Push keys must be set together');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Configuration presence checks passed. External connections have NOT been tested.');
