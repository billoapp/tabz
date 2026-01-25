-- Enum Types
create type public.transaction_status as enum ('pending', 'sent', 'completed', 'failed', 'cancelled');

create table public.audit_logs (
  id uuid not null default extensions.uuid_generate_v4 (),
  bar_id uuid null,
  tab_id uuid null,
  staff_id uuid null,
  action text not null,
  details jsonb null,
  created_at timestamp with time zone null default now(),
  constraint audit_logs_pkey primary key (id),
  constraint audit_logs_bar_id_fkey foreign KEY (bar_id) references bars (id) on delete CASCADE,
  constraint audit_logs_tab_id_fkey foreign KEY (tab_id) references tabs (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_audit_bar on public.audit_logs using btree (bar_id) TABLESPACE pg_default;

create index IF not exists idx_audit_tab on public.audit_logs using btree (tab_id) TABLESPACE pg_default;

create index IF not exists idx_audit_created on public.audit_logs using btree (created_at) TABLESPACE pg_default;

create table public.bar_products (
  id uuid not null default extensions.uuid_generate_v4 (),
  bar_id uuid null,
  product_id uuid null,
  sale_price numeric(10, 2) not null default 0,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  custom_product_id uuid null,
  name text not null,
  description text null,
  category text not null,
  image_url text null,
  sku text null,
  constraint bar_products_pkey primary key (id),
  constraint bar_products_bar_id_fkey foreign KEY (bar_id) references bars (id) on delete CASCADE,
  constraint bar_products_product_id_fkey foreign KEY (product_id) references products (id) on delete set null,
  constraint check_product_xor_custom check (
    (
      (product_id is null) <> (custom_product_id is null)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_bar_products_bar on public.bar_products using btree (bar_id) TABLESPACE pg_default;

create index IF not exists idx_bar_products_product on public.bar_products using btree (product_id) TABLESPACE pg_default;

create unique INDEX IF not exists idx_bar_products_global_unique on public.bar_products using btree (bar_id, product_id) TABLESPACE pg_default
where
  (product_id is not null);

create unique INDEX IF not exists idx_bar_products_custom_unique on public.bar_products using btree (bar_id, custom_product_id) TABLESPACE pg_default
where
  (custom_product_id is not null);

create index IF not exists idx_bar_products_custom on public.bar_products using btree (custom_product_id) TABLESPACE pg_default;

create index IF not exists idx_bar_products_category on public.bar_products using btree (category) TABLESPACE pg_default;

create index IF not exists idx_bar_products_name on public.bar_products using btree (name) TABLESPACE pg_default;

create trigger update_bar_products_updated_at BEFORE
update on bar_products for EACH row
execute FUNCTION update_updated_at_column ();

create table public.bars (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  location text null,
  phone text null,
  email text null,
  webhook_url text null,
  qr_code_url text null,
  subscription_tier text null default 'free'::text,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  slug text null,
  pdf_menu_url text null,
  menu_type text null default 'interactive'::text,
  static_menu_url text null,
  static_menu_type text null,
  notification_new_orders boolean null default false,
  notification_pending_approvals boolean null default false,
  notification_payments boolean null default false,
  payment_cash_enabled boolean null default true,
  payment_card_enabled boolean null default false,
  card_provider text null,
  business_hours_mode text null default 'simple'::text,
  business_hours_simple jsonb null,
  business_hours_advanced jsonb null,
  business_24_hours boolean null default false,
  timezone text null default 'Africa/Nairobi'::text,
  slideshow_settings jsonb null default '{"transitionSpeed": 10000}'::jsonb,
  alert_timeout integer null default 5,
  alert_sound_enabled boolean null default true,
  alert_custom_audio_url text null,
  alert_volume numeric(3, 2) null default 0.8,
  alert_custom_audio_name text null,
  table_setup_enabled boolean null default false,
  table_count integer null default 0,
  mpesa_enabled boolean null default false,
  mpesa_environment character varying(20) null default 'sandbox'::character varying,
  mpesa_business_shortcode character varying(20) null,
  mpesa_consumer_key_encrypted text null,
  mpesa_consumer_secret_encrypted text null,
  mpesa_passkey_encrypted text null,
  mpesa_callback_url text null,
  mpesa_setup_completed boolean null default false,
  mpesa_last_test_at timestamp with time zone null,
  mpesa_test_status character varying(20) null default 'pending'::character varying,
  constraint bars_pkey primary key (id),
  constraint bars_slug_unique unique (slug),
  constraint bars_slug_key unique (slug),
  constraint bars_mpesa_test_status_check check (
    (
      (mpesa_test_status)::text = any (
        (
          array[
            'pending'::character varying,
            'success'::character varying,
            'failed'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint bars_static_menu_type_check check (
    (
      (static_menu_type is null)
      or (
        static_menu_type = any (
          array['pdf'::text, 'image'::text, 'slideshow'::text]
        )
      )
    )
  ),
  constraint bars_business_hours_mode_check check (
    (
      business_hours_mode = any (
        array['simple'::text, 'advanced'::text, '24hours'::text]
      )
    )
  ),
  constraint bars_subscription_tier_check check (
    (
      subscription_tier = any (
        array['free'::text, 'pro'::text, 'enterprise'::text]
      )
    )
  ),
  constraint bars_menu_type_check check (
    (
      menu_type = any (array['interactive'::text, 'static'::text])
    )
  ),
  constraint bars_mpesa_environment_check check (
    (
      (mpesa_environment)::text = any (
        (
          array[
            'sandbox'::character varying,
            'production'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists bars_slug_idx on public.bars using btree (slug) TABLESPACE pg_default;

create index IF not exists idx_bars_menu_type on public.bars using btree (menu_type) TABLESPACE pg_default;

create index IF not exists idx_bars_slug on public.bars using btree (slug) TABLESPACE pg_default;

create trigger update_bars_updated_at BEFORE
update on bars for EACH row
execute FUNCTION update_updated_at_column ();

create table public.bars_slug_backup (
  id uuid null,
  name text null,
  slug text null,
  created_at timestamp with time zone null
) TABLESPACE pg_default;

create table public.categories (
  name text not null,
  image_url text not null,
  created_at timestamp with time zone null default now(),
  constraint categories_pkey primary key (name)
) TABLESPACE pg_default;

create table public.custom_products (
  id uuid not null default extensions.uuid_generate_v4 (),
  bar_id uuid null,
  name text not null,
  category text not null,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  description text null,
  image_url text null,
  sku text null,
  constraint custom_products_pkey primary key (id),
  constraint custom_products_sku_key unique (sku),
  constraint custom_products_bar_id_fkey foreign KEY (bar_id) references bars (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_custom_products_bar on public.custom_products using btree (bar_id) TABLESPACE pg_default;

create table public.devices (
  id uuid not null default gen_random_uuid (),
  device_id text not null,
  fingerprint text not null,
  user_id uuid null,
  created_at timestamp with time zone null default now(),
  last_seen timestamp with time zone null default now(),
  last_bar_id uuid null,
  is_active boolean null default true,
  suspicious_activity_count integer null default 0,
  user_agent text null,
  platform text null,
  screen_resolution text null,
  timezone text null,
  is_suspicious boolean not null default false,
  language text null,
  hardware_concurrency integer null,
  device_memory integer null,
  install_count integer not null default 1,
  last_install_at timestamp with time zone null default now(),
  pwa_installed boolean null default false,
  total_tabs_created integer not null default 0,
  total_amount_spent numeric(10, 2) null default 0.00,
  deleted_at timestamp with time zone null,
  constraint devices_pkey primary key (id),
  constraint devices_device_id_key unique (device_id),
  constraint devices_fingerprint_key unique (fingerprint),
  constraint devices_last_bar_id_fkey foreign KEY (last_bar_id) references bars (id),
  constraint devices_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_devices_last_seen on public.devices using btree (last_seen desc) TABLESPACE pg_default;

create index IF not exists idx_devices_created_at on public.devices using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_devices_is_active on public.devices using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_devices_deleted_at on public.devices using btree (deleted_at) TABLESPACE pg_default
where
  (deleted_at is null);

create index IF not exists idx_devices_user_active on public.devices using btree (user_id, is_active) TABLESPACE pg_default;

create index IF not exists idx_devices_device_id on public.devices using btree (device_id) TABLESPACE pg_default;

create index IF not exists idx_devices_fingerprint on public.devices using btree (fingerprint) TABLESPACE pg_default;

create index IF not exists idx_devices_user_id on public.devices using btree (user_id) TABLESPACE pg_default;

create trigger trigger_update_device_last_seen BEFORE
update on devices for EACH row
execute FUNCTION update_device_last_seen ();

create table public.feedback (
  id uuid not null default gen_random_uuid (),
  email text not null,
  message text not null,
  bar_name text null,
  created_at timestamp with time zone null default now(),
  constraint feedback_pkey primary key (id)
) TABLESPACE pg_default;

create table public.food_products (
  id uuid not null default extensions.uuid_generate_v4 (),
  bar_id uuid null,
  product_id uuid null,
  sale_price numeric(10, 2) not null default 0,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  custom_product_id uuid null,
  name text not null,
  description text null,
  category text not null,
  image_url text null,
  sku text null,
  constraint food_products_pkey primary key (id),
  constraint food_products_bar_id_fkey foreign KEY (bar_id) references bars (id) on delete CASCADE,
  constraint food_products_product_id_fkey foreign KEY (product_id) references products (id) on delete set null,
  constraint food_check_product_xor_custom check (
    (
      (product_id is null) <> (custom_product_id is null)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_food_products_bar on public.food_products using btree (bar_id) TABLESPACE pg_default;

create index IF not exists idx_food_products_product on public.food_products using btree (product_id) TABLESPACE pg_default;

create unique INDEX IF not exists idx_food_products_global_unique on public.food_products using btree (bar_id, product_id) TABLESPACE pg_default
where
  (product_id is not null);

create unique INDEX IF not exists idx_food_products_custom_unique on public.food_products using btree (bar_id, custom_product_id) TABLESPACE pg_default
where
  (custom_product_id is not null);

create index IF not exists idx_food_products_custom on public.food_products using btree (custom_product_id) TABLESPACE pg_default;

create index IF not exists idx_food_products_category on public.food_products using btree (category) TABLESPACE pg_default;

create index IF not exists idx_food_products_name on public.food_products using btree (name) TABLESPACE pg_default;

create trigger update_food_products_updated_at BEFORE
update on food_products for EACH row
execute FUNCTION update_updated_at_column ();

create table public.mpesa_credential_events (
  id uuid not null default gen_random_uuid (),
  credential_id uuid not null,
  tenant_id uuid not null,
  event_type text not null,
  event_data jsonb null,
  user_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint mpesa_credential_events_pkey primary key (id),
  constraint mpesa_credential_events_credential_id_fkey foreign KEY (credential_id) references mpesa_credentials (id) on delete CASCADE,
  constraint mpesa_credential_events_tenant_id_fkey foreign KEY (tenant_id) references bars (id) on delete CASCADE,
  constraint mpesa_credential_events_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint mpesa_credential_events_event_type_check check (
    (
      event_type = any (
        array[
          'created'::text,
          'updated'::text,
          'tested'::text,
          'rotated'::text,
          'deleted'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create table public.mpesa_credentials (
  id uuid not null default gen_random_uuid (),
  tenant_id uuid not null,
  environment text not null,
  business_shortcode text not null,
  consumer_key_enc bytea not null,
  consumer_secret_enc bytea not null,
  passkey_enc bytea not null,
  callback_url text not null,
  timeout_url text null,
  initiator_name text null,
  security_credential_enc bytea null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint mpesa_credentials_pkey primary key (id),
  constraint mpesa_credentials_tenant_id_environment_key unique (tenant_id, environment),
  constraint mpesa_credentials_tenant_id_fkey foreign KEY (tenant_id) references bars (id) on delete CASCADE,
  constraint mpesa_credentials_environment_check check (
    (
      environment = any (array['sandbox'::text, 'production'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_mpesa_credentials_tenant_id on public.mpesa_credentials using btree (tenant_id) TABLESPACE pg_default;

create index IF not exists idx_mpesa_credentials_environment on public.mpesa_credentials using btree (environment) TABLESPACE pg_default;

create index IF not exists idx_mpesa_credentials_active on public.mpesa_credentials using btree (is_active) TABLESPACE pg_default;

create trigger trigger_update_mpesa_credentials_updated_at BEFORE
update on mpesa_credentials for EACH row
execute FUNCTION update_mpesa_credentials_updated_at ();

create table public.mpesa_transactions (
  id uuid not null default gen_random_uuid (),
  tab_id uuid not null,
  customer_id text null,
  phone_number text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'KES'::text,
  status public.transaction_status not null default 'pending'::public.transaction_status,
  checkout_request_id text null,
  merchant_request_id text null,
  mpesa_receipt_number text null,
  transaction_date timestamp with time zone null,
  failure_reason text null,
  result_code integer null,
  environment text not null,
  callback_data jsonb null,
  tab_payment_id uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint mpesa_transactions_pkey primary key (id),
  constraint mpesa_transactions_tab_id_fkey foreign KEY (tab_id) references tabs (id) on delete CASCADE,
  constraint mpesa_transactions_tab_payment_id_fkey foreign KEY (tab_payment_id) references tab_payments (id) on delete set null,
  constraint mpesa_transactions_checkout_request_id_key unique (checkout_request_id),
  constraint mpesa_transactions_mpesa_receipt_number_key unique (mpesa_receipt_number),
  constraint mpesa_transactions_amount_check check ((amount > (0)::numeric)),
  constraint mpesa_transactions_currency_check check ((currency = 'KES'::text)),
  constraint mpesa_transactions_environment_check check ((environment = any (array['sandbox'::text, 'production'::text])))
) TABLESPACE pg_default;

create index IF not exists idx_mpesa_transactions_tab_id on public.mpesa_transactions using btree (tab_id) TABLESPACE pg_default;

create index IF not exists idx_mpesa_transactions_status on public.mpesa_transactions using btree (status) TABLESPACE pg_default;

create index IF not exists idx_mpesa_transactions_phone on public.mpesa_transactions using btree (phone_number) TABLESPACE pg_default;

create index IF not exists idx_mpesa_transactions_checkout_request on public.mpesa_transactions using btree (checkout_request_id) TABLESPACE pg_default;

create index IF not exists idx_mpesa_transactions_receipt on public.mpesa_transactions using btree (mpesa_receipt_number) TABLESPACE pg_default;

create index IF not exists idx_mpesa_transactions_created on public.mpesa_transactions using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_mpesa_transactions_environment on public.mpesa_transactions using btree (environment) TABLESPACE pg_default;

create index IF not exists idx_mpesa_transactions_payment on public.mpesa_transactions using btree (tab_payment_id) TABLESPACE pg_default;

create trigger trigger_update_mpesa_transactions_updated_at BEFORE
update on mpesa_transactions for EACH row
execute FUNCTION update_mpesa_transactions_updated_at ();

create trigger trigger_validate_transaction_state_transition BEFORE
update on mpesa_transactions for EACH row
execute FUNCTION validate_transaction_state_transition ();

create table public.overdue_backfill_log (
  id serial not null,
  backfill_date timestamp without time zone null default now(),
  tabs_updated integer null,
  notes text null,
  constraint overdue_backfill_log_pkey primary key (id)
) TABLESPACE pg_default;

create table public.products (
  id uuid not null default extensions.uuid_generate_v4 (),
  supplier_id uuid null,
  name text not null,
  category text null,
  image_url text null,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint products_pkey primary key (id),
  constraint products_supplier_id_fkey foreign KEY (supplier_id) references suppliers (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_products_supplier_id on public.products using btree (supplier_id) TABLESPACE pg_default;

create index IF not exists idx_products_name_lower on public.products using btree (lower(name)) TABLESPACE pg_default;

create table public.slideshow_images (
  id uuid not null default gen_random_uuid (),
  bar_id uuid null,
  image_url text not null,
  display_order integer not null,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint slideshow_images_pkey primary key (id),
  constraint slideshow_images_bar_id_display_order_key unique (bar_id, display_order),
  constraint slideshow_images_bar_id_fkey foreign KEY (bar_id) references bars (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_slideshow_images_bar_display_order on public.slideshow_images using btree (bar_id, display_order) TABLESPACE pg_default;

create index IF not exists idx_slideshow_images_active on public.slideshow_images using btree (active) TABLESPACE pg_default;

create index IF not exists idx_slideshow_images_bar_id on public.slideshow_images using btree (bar_id) TABLESPACE pg_default;

create trigger update_slideshow_images_updated_at BEFORE
update on slideshow_images for EACH row
execute FUNCTION update_updated_at_column ();

create table public.suppliers (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  logo_url text null,
  subscription_tier text null,
  active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint suppliers_pkey primary key (id),
  constraint suppliers_subscription_tier_check check (
    (
      subscription_tier = any (
        array['basic'::text, 'featured'::text, 'premium'::text]
      )
    )
  )
) TABLESPACE pg_default;

create view public.tab_balances as
select
  t.id as tab_id,
  t.bar_id,
  t.tab_number,
  t.status,
  COALESCE(
    sum(
      case
        when o.status = 'confirmed'::text then o.total
        else 0::numeric
      end
    ),
    0::numeric
  ) as total_orders,
  COALESCE(sum(p.amount), 0::numeric) as total_payments,
  COALESCE(
    sum(
      case
        when o.status = 'confirmed'::text then o.total
        else 0::numeric
      end
    ),
    0::numeric
  ) - COALESCE(sum(p.amount), 0::numeric) as balance
from
  tabs t
  left join tab_orders o on t.id = o.tab_id
  left join tab_payments p on t.id = p.tab_id
  and p.status = 'success'::text
group by
  t.id,
  t.bar_id,
  t.tab_number,
  t.status;

create table public.tab_orders (
  id uuid not null default extensions.uuid_generate_v4 (),
  tab_id uuid not null,
  items jsonb not null,
  total numeric(10, 2) not null,
  status text null default 'pending'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  initiated_by text null default 'customer'::text,
  confirmed_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  order_number integer null,
  rejection_reason public.rejection_reason null,
  cancelled_by text null,
  constraint tab_orders_pkey primary key (id),
  constraint tab_orders_tab_id_fkey foreign KEY (tab_id) references tabs (id) on delete CASCADE,
  constraint tab_orders_cancelled_by_check check (
    (
      cancelled_by = any (
        array['customer'::text, 'staff'::text, 'system'::text]
      )
    )
  ),
  constraint tab_orders_initiated_by_check check (
    (
      initiated_by = any (array['customer'::text, 'staff'::text])
    )
  ),
  constraint tab_orders_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'confirmed'::text,
          'cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_orders_tab on public.tab_orders using btree (tab_id) TABLESPACE pg_default;

create index IF not exists idx_orders_status on public.tab_orders using btree (status) TABLESPACE pg_default;

create index IF not exists idx_orders_created on public.tab_orders using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_orders_tab_created on public.tab_orders using btree (tab_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_orders_initiated_by on public.tab_orders using btree (initiated_by) TABLESPACE pg_default;

create index IF not exists idx_tab_orders_tab_id on public.tab_orders using btree (tab_id) TABLESPACE pg_default;

create index IF not exists idx_tab_orders_status on public.tab_orders using btree (status) TABLESPACE pg_default;

create index IF not exists idx_tab_orders_items_gin on public.tab_orders using gin (items) TABLESPACE pg_default;

create index IF not exists idx_tab_orders_rejection_reason on public.tab_orders using btree (rejection_reason) TABLESPACE pg_default;

create index IF not exists idx_tab_orders_cancelled_by on public.tab_orders using btree (cancelled_by) TABLESPACE pg_default;

create index IF not exists idx_orders_number on public.tab_orders using btree (order_number) TABLESPACE pg_default;

create trigger assign_order_number_trigger BEFORE INSERT on tab_orders for EACH row
execute FUNCTION assign_order_number ();

create trigger prevent_orders_on_overdue_tabs_trigger BEFORE INSERT
or
update on tab_orders for EACH row
execute FUNCTION prevent_orders_on_overdue_tabs ();

create trigger set_order_status_timestamps BEFORE
update on tab_orders for EACH row
execute FUNCTION set_order_status_timestamps ();

create trigger update_orders_updated_at BEFORE
update on tab_orders for EACH row
execute FUNCTION update_updated_at_column ();

create trigger validate_not_cold_trigger BEFORE INSERT
or
update on tab_orders for EACH row
execute FUNCTION validate_not_cold_preference ();

create table public.tab_payments (
  id uuid not null default extensions.uuid_generate_v4 (),
  tab_id uuid not null,
  amount numeric(10, 2) not null,
  method text not null,
  status text null default 'pending'::text,
  reference text null,
  metadata jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint tab_payments_pkey primary key (id),
  constraint tab_payments_tab_id_fkey foreign KEY (tab_id) references tabs (id) on delete CASCADE,
  constraint tab_payments_method_check check (
    (
      method = any (array['mpesa'::text, 'cash'::text, 'card'::text])
    )
  ),
  constraint tab_payments_status_check check (
    (
      status = any (
        array['pending'::text, 'success'::text, 'failed'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_payments_tab on public.tab_payments using btree (tab_id) TABLESPACE pg_default;

create index IF not exists idx_payments_method on public.tab_payments using btree (method) TABLESPACE pg_default;

create index IF not exists idx_payments_status on public.tab_payments using btree (status) TABLESPACE pg_default;

create index IF not exists idx_payments_created on public.tab_payments using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_payments_tab_created on public.tab_payments using btree (tab_id, created_at desc) TABLESPACE pg_default;

create trigger trigger_auto_close_overdue_tab
after INSERT on tab_payments for EACH row
execute FUNCTION auto_close_overdue_tab_on_payment ();

create trigger update_payments_updated_at BEFORE
update on tab_payments for EACH row
execute FUNCTION update_updated_at_column ();

create table public.tab_telegram_messages (
  id uuid not null default gen_random_uuid (),
  tab_id uuid not null,
  message text not null,
  order_type character varying(20) null default 'telegram'::character varying,
  status character varying(20) null default 'pending'::character varying,
  message_metadata jsonb null default '{}'::jsonb,
  customer_notified boolean null default false,
  staff_acknowledged_at timestamp with time zone null,
  customer_notified_at timestamp with time zone null,
  initiated_by character varying(20) null default 'customer'::character varying,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint tab_telegram_messages_pkey primary key (id),
  constraint tab_telegram_messages_tab_id_fkey foreign KEY (tab_id) references tabs (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_tab_telegram_messages_tab_id on public.tab_telegram_messages using btree (tab_id) TABLESPACE pg_default;

create index IF not exists idx_tab_telegram_messages_status on public.tab_telegram_messages using btree (status) TABLESPACE pg_default;

create index IF not exists idx_tab_telegram_messages_created_at on public.tab_telegram_messages using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_telegram_messages_tab_status on public.tab_telegram_messages using btree (tab_id, status) TABLESPACE pg_default;

create index IF not exists idx_telegram_messages_created_at on public.tab_telegram_messages using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_telegram_messages_staff_ack on public.tab_telegram_messages using btree (staff_acknowledged_at desc) TABLESPACE pg_default
where
  (staff_acknowledged_at is not null);

create trigger notify_customer_trigger BEFORE
update on tab_telegram_messages for EACH row
execute FUNCTION notify_customer_on_acknowledge ();

create trigger update_tab_telegram_messages_updated_at BEFORE
update on tab_telegram_messages for EACH row
execute FUNCTION update_updated_at_column ();

create table public.tabs (
  id uuid not null default extensions.uuid_generate_v4 (),
  bar_id uuid not null,
  tab_number integer not null,
  owner_identifier text null,
  status text null default 'open'::text,
  opened_at timestamp with time zone null default now(),
  closed_at timestamp with time zone null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  closed_by text null,
  device_identifier text null,
  moved_to_overdue_at timestamp with time zone null,
  overdue_reason text null,
  sound_enabled boolean null default true,
  vibration_enabled boolean null default true,
  constraint tabs_pkey primary key (id),
  constraint tabs_bar_id_tab_number_key unique (bar_id, tab_number),
  constraint tabs_bar_id_fkey foreign KEY (bar_id) references bars (id) on delete CASCADE,
  constraint tabs_closed_by_check check (
    (
      closed_by = any (array['customer'::text, 'staff'::text])
    )
  ),
  constraint tabs_status_check check (
    (
      status = any (
        array['open'::text, 'overdue'::text, 'closed'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_tabs_bar on public.tabs using btree (bar_id) TABLESPACE pg_default;

create index IF not exists idx_tabs_status on public.tabs using btree (status) TABLESPACE pg_default;

create index IF not exists idx_tabs_owner on public.tabs using btree (owner_identifier) TABLESPACE pg_default;

create index IF not exists idx_tabs_bar_status on public.tabs using btree (bar_id, status) TABLESPACE pg_default;

create index IF not exists idx_tabs_bar_id on public.tabs using btree (bar_id) TABLESPACE pg_default;

create index IF not exists idx_tabs_owner_identifier_status on public.tabs using btree (owner_identifier, status) TABLESPACE pg_default;

create index IF not exists idx_tabs_bar_overdue on public.tabs using btree (bar_id, status) TABLESPACE pg_default
where
  (status = 'overdue'::text);

create index IF not exists idx_tabs_device_overdue on public.tabs using btree (device_identifier, status) TABLESPACE pg_default
where
  (status = 'overdue'::text);

create index IF not exists idx_tabs_created_at_recent on public.tabs using btree (created_at desc) TABLESPACE pg_default;

create trigger set_tab_number BEFORE INSERT on tabs for EACH row
execute FUNCTION generate_tab_number ();

create trigger trigger_prevent_multiple_open_tabs BEFORE INSERT
or
update on tabs for EACH row
execute FUNCTION prevent_multiple_open_tabs ();

create trigger trigger_update_device_stats_on_tab_close
after
update on tabs for EACH row
execute FUNCTION update_device_stats_on_tab_close ();

create trigger trigger_update_device_stats_on_tab_create
after INSERT on tabs for EACH row
execute FUNCTION update_device_stats_on_tab_create ();

create trigger update_tabs_updated_at BEFORE
update on tabs for EACH row
execute FUNCTION update_updated_at_column ();

create view public.telegram_messages_with_tabs as
select
  tm.id,
  tm.tab_id,
  tm.message,
  tm.order_type,
  tm.status,
  tm.message_metadata,
  tm.customer_notified,
  tm.staff_acknowledged_at,
  tm.customer_notified_at,
  tm.initiated_by,
  tm.created_at,
  tm.updated_at,
  t.tab_number,
  t.status as tab_status,
  t.notes,
  b.name as bar_name,
  b.id as bar_id
from
  tab_telegram_messages tm
  join tabs t on tm.tab_id = t.id
  join bars b on t.bar_id = b.id
order by
  tm.created_at desc;

create table public.user_bar_permissions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  bar_id uuid not null,
  role text null,
  created_at timestamp with time zone null default now(),
  constraint user_bar_permissions_pkey primary key (id),
  constraint user_bar_permissions_bar_id_fkey foreign KEY (bar_id) references bars (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.user_bars (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  bar_id uuid not null,
  role text not null default 'staff'::text,
  created_at timestamp with time zone null default now(),
  constraint user_bars_pkey primary key (id),
  constraint user_bars_user_id_bar_id_key unique (user_id, bar_id),
  constraint user_bars_bar_id_fkey foreign KEY (bar_id) references bars (id) on delete CASCADE,
  constraint user_bars_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_bars_role_check check (
    (
      role = any (
        array['owner'::text, 'manager'::text, 'staff'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_user_bars_user_id on public.user_bars using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_bars_bar_id on public.user_bars using btree (bar_id) TABLESPACE pg_default;