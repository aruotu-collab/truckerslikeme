-- Run in Supabase SQL editor if alerts/system_alerts already exist.
-- Adds live-feed kinds for weigh stations and truck repair.

alter type public.activity_kind add value if not exists 'weigh';
alter type public.activity_kind add value if not exists 'repair';
