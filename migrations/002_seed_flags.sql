-- Example values, one per type. The comment shows what the app detects.
insert into flags (key, value) values
  ('new_checkout', 'false'),                                -- boolean
  ('max_items',    '6'),                                    -- integer
  ('discount',     '0.15'),                                 -- number
  ('banner_text',  'Free shipping this week'),              -- string (not valid JSON)
  ('promo_code',   '"2026"'),                               -- string (quoted on purpose)
  ('theme',        '{"accent":"#2563eb","rounded":true}')   -- json
on conflict (key) do nothing;
