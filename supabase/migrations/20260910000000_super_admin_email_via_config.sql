-- 슈퍼관리자 이메일을 커밋된 소스가 아니라 Postgres 설정값(GUC)에서 읽도록 전환.
-- 이 마이그레이션 자체는 GUC를 세팅하지 않는다. 실제 이메일 값은
-- Supabase 프로젝트별로 SQL Editor에서 아래를 1회 실행해 둔다(값은 커밋 금지):
--
--   ALTER DATABASE postgres SET app.super_admin_email = '실제 관리자 이메일';
--
-- 설정 전에는 current_setting(..., true)가 NULL을 반환하므로
-- 어떤 계정도 관리자로 승격되지 않는다(폐쇄 기본값, fail-closed).
SELECT 1; -- 문서화 목적의 no-op 마이그레이션
