-- auth.identities 및 auth.users 완전 보정 스크립트
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  admin_uid UUID;
BEGIN
  -- 1. 기존 admin 유저 ID 가져오기 또는 새로 생성
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'admin@dashboard.app';

  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();
    
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
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated',
      'authenticated',
      'admin@dashboard.app',
      extensions.crypt('admin123@!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"최고관리자 (Admin)"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    -- 기존 유저 비밀번호 및 필드 업데이트
    UPDATE auth.users
    SET 
      encrypted_password = extensions.crypt('admin123@!', extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = '{"full_name":"최고관리자 (Admin)"}'::jsonb,
      updated_at = NOW()
    WHERE id = admin_uid;
  END IF;

  -- 2. auth.identities 테이블에 identity 레코드 생성 (Database error finding user 해결의 핵심)
  DELETE FROM auth.identities WHERE user_id = admin_uid;
  
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    admin_uid,
    admin_uid,
    jsonb_build_object('sub', admin_uid::text, 'email', 'admin@dashboard.app'),
    'email',
    admin_uid::text,
    NOW(),
    NOW(),
    NOW()
  );

  -- 3. profiles 테이블 업데이트
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

END $$;
