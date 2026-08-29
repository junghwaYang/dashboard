-- 최고관리자(Admin) 계정 생성 및 비밀번호/권한 설정
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  admin_uid UUID := gen_random_uuid();
  existing_uid UUID;
BEGIN
  SELECT id INTO existing_uid FROM auth.users WHERE email = 'admin@dashboard.app';

  IF existing_uid IS NULL THEN
    -- 1. auth.users에 신규 어드민 계정 생성
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated',
      'authenticated',
      'admin@dashboard.app',
      extensions.crypt('admin123@!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"최고관리자 (Admin)"}',
      NOW(),
      NOW()
    );

    -- 2. profiles 테이블에 admin role 부여
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      avatar_url,
      team_id,
      role,
      created_at,
      updated_at
    )
    VALUES (
      admin_uid,
      'admin@dashboard.app',
      '최고관리자 (Admin)',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      NULL,
      'admin',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      full_name = '최고관리자 (Admin)',
      updated_at = NOW();

  ELSE
    -- 3. 이미 존재하는 경우 비밀번호 및 권한 업데이트
    UPDATE auth.users
    SET 
      encrypted_password = extensions.crypt('admin123@!', extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = existing_uid;

    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      avatar_url,
      team_id,
      role,
      created_at,
      updated_at
    )
    VALUES (
      existing_uid,
      'admin@dashboard.app',
      '최고관리자 (Admin)',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      NULL,
      'admin',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      full_name = '최고관리자 (Admin)',
      updated_at = NOW();
  END IF;
END $$;
