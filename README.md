# Container Order Management

컨테이너 주문·구매를 관리하는 Next.js 웹 앱입니다.  
제품 마스터, PO(구매 주문) 등록, 엑셀 일괄 업로드, 구매 내역 조회를 지원합니다.

## 주요 기능

- **제품 관리** — 등록·수정, 품목 ID / Rate 검색, 최근 PO 표시, 구매 내역 조회, 조회 결과 엑셀 내보내기
- **구매/컨테이너 주문 등록** — PO 마스터 저장 후 엑셀로 품목 일괄 등록
- **구매 내역 조회** — PO별 품목 상세, PO 삭제
- **한/영 UI** — 화면 우측 상단에서 언어 전환
- **로그인** — Supabase Auth 이메일/비밀번호 로그인 (미로그인 시 접근 불가)

## 기술 스택

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React](https://react.dev/) 19
- [Supabase](https://supabase.com/) (PostgreSQL)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [SheetJS (xlsx)](https://sheetjs.com/) — 엑셀 업로드/다운로드

## 사전 요구 사항

- Node.js 20+
- npm
- Supabase 프로젝트

## 로컬 실행

### 1. 저장소 클론

```bash
git clone https://github.com/panasia5-sketch/container-app.git
cd container-app
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.example`을 복사해 `.env.local`을 만듭니다.

```bash
cp .env.example .env.local
```

Supabase 대시보드 → **Project Settings → API**에서 값을 입력합니다.

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |

### 4. Supabase DB 스키마 적용

Supabase 대시보드 → **SQL Editor**에서 순서대로 실행합니다.

1. `supabase/schema.sql` — 전체 스키마
2. (기존 DB에 컬럼 추가 시) `supabase/migrations/` 아래 SQL 파일

### 5. Supabase Auth 설정

1. Supabase → **Authentication → Providers → Email** — Email 로그인·**회원가입(Sign up)** 활성화
2. (선택) **Authentication → Email → Confirm email** — 이메일 확인 필요 여부 설정
3. **Authentication → Users** — 관리자가 직접 계정 추가도 가능
3. SQL Editor에서 `supabase/migrations/add_auth_rls.sql` 실행 — **로그인한 사용자만** DB 접근 허용
4. SQL Editor에서 `supabase/migrations/add_user_profiles.sql` 실행 — **역할(권한) 테이블** 생성

> RLS 마이그레이션 전에는 누구나 데이터 접근 가능합니다. 배포 전 반드시 실행하세요.

#### 사용자 역할 부여

최초 로그인 시 기본 역할은 `viewer`(조회 전용)입니다. 관리자는 Supabase SQL Editor에서 변경합니다:

```sql
update user_profiles set role = 'admin' where email = 'your@email.com';
-- role: admin | manager | viewer
```

| 역할 | 메뉴 | 주요 권한 |
|------|------|-----------|
| `admin` | 제품·구매·내역 | 전체 CRUD |
| `manager` | 제품·구매·내역 | 전체 CRUD |
| `viewer` | 제품·내역 | 조회·엑셀 export만 (등록/수정/삭제 불가) |

메뉴·기능 권한은 `lib/auth/permissions.ts`에서 중앙 관리합니다.

### 6. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 엑셀 업로드 형식

1행: 헤더, 2행부터 데이터.

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| item_no | description | packaging | quantity | unit_price | duty | tax | rate |

- PO 마스터를 먼저 저장한 뒤, 해당 PO를 선택하고 엑셀을 업로드합니다.
- 업로드 시 해당 PO의 기존 품목은 **삭제 후 교체**됩니다.
- `products`에 없는 `item_no`는 자동 등록됩니다.

## npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |

## 프로젝트 구조

```
app/
  components/ContainerOrderApp.tsx   # 메인 UI
  page.tsx
lib/
  supabase.ts                        # Supabase 클라이언트
  excel-purchase.ts                  # 구매 엑셀 파싱
  excel-product-export.ts            # 제품 조회 결과 export
  product-sync.ts                    # products / purchase_record 동기화
  product-lookup.ts                  # 최근 PO, 제품별 구매 내역
supabase/
  schema.sql
  migrations/
```

## Vercel 배포

GitHub 연동 후 Vercel에서 Import하면 됩니다. 자세한 단계는 아래 **배포 가이드**를 참고하세요.

### Vercel 환경 변수

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

> `NEXT_PUBLIC_` 변수는 브라우저에 노출됩니다. Supabase **anon key**는 클라이언트용이며, RLS 정책으로 접근을 제한하세요.

## 보안 참고

- `.env.local`은 Git에 커밋하지 마세요 (`.gitignore`에 포함됨).
- `add_auth_rls.sql` 적용 후 **로그인한 사용자만** 데이터 CRUD 가능합니다.
- 사용자 계정은 Supabase 대시보드에서 관리자가 생성합니다.

## License

Private / internal use.
