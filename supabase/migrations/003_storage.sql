insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('job-images','job-images',true,800000,array['image/jpeg','image/png']) on conflict(id) do nothing;
-- Only server-side service_role uploads after authentication and byte signature checks.
-- No authenticated/anonymous INSERT policy is deliberately provided.
