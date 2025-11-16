# TrendRadar × Cherry Studio 배포 가이드 🍒

> **적합한 대상**: 프로그래밍 기초가 없는 사용자
> **클라이언트**: Cherry Studio(무료 오픈소스 GUI 클라이언트)

---

## 📥 첫 번째 단계: Cherry Studio 다운로드

### Windows 사용자

공식 웹사이트에서 다운로드: https://cherry-ai.com/
또는 직접 다운로드: [Cherry-Studio-Windows.exe](https://github.com/kangfenmao/cherry-studio/releases/latest)

### Mac 사용자

공식 웹사이트에서 다운로드: https://cherry-ai.com/
또는 직접 다운로드: [Cherry-Studio-Mac.dmg](https://github.com/kangfenmao/cherry-studio/releases/latest)


---

## 📦 두 번째 단계: 프로젝트 코드 얻기

왜 프로젝트 코드를 얻어야 하나요?

AI 분석 기능은 프로젝트의 뉴스 데이터를 읽어야 작동합니다. GitHub Actions 또는 Docker 배포를 사용하든 상관없이, 크롤러가 생성한 뉴스 데이터는 프로젝트의 output 디렉토리에 저장됩니다. 따라서 MCP 서버를 설정하기 전에 완전한 프로젝트 코드(데이터 파일 포함)를 먼저 얻어야 합니다.

기술 수준에 따라 다음 방법 중 하나를 선택할 수 있습니다:

### 방법 1: Git Clone(기술 사용자에게 권장)

Git에 익숙하다면 다음 명령어를 사용하여 프로젝트를 복제할 수 있습니다:

```bash
git clone https://github.com/당신의사용자이름/당신의프로젝트이름.git
cd 당신의프로젝트이름
```

**장점**:

- 언제든지 한 명령어로 최신 데이터를 로컬로 갱신할 수 있습니다(`git pull`)

### 방법 2: ZIP 압축 파일 직접 다운로드(초보자에게 권장)


1. **GitHub 프로젝트 페이지 방문**

   - 프로젝트 링크: `https://github.com/당신의사용자이름/당신의프로젝트이름`

2. **압축 파일 다운로드**

   - 초록색 "Code" 버튼 클릭
   - "Download ZIP" 선택
   - 또는 직접 방문: `https://github.com/당신의사용자이름/당신의프로젝트이름/archive/refs/heads/master.zip`


**주의사항**:

- 절차가 다소 번거로우며, 이후 데이터 업데이트 시 위의 절차를 반복한 후 로컬 데이터(output 디렉토리)를 덮어씌워야 합니다

---

## 🚀 세 번째 단계: 원클릭 MCP 서버 배포

### Windows 사용자

1. **프로젝트 폴더의 `setup-windows.bat` 더블클릭 실행**
2. **설치 완료 대기**
3. **표시된 설정 정보 기록**(명령 경로 및 파라미터)

### Mac 사용자

1. **터미널 열기**(Launchpad에서 "Terminal" 검색)
2. **프로젝트 폴더의 `setup-mac.sh`를 터미널 윈도우로 드래그**
3. **Enter 키 누르기**
4. **표시된 설정 정보 기록**

---

## 🔧 네 번째 단계: Cherry Studio 설정

### 1. 설정 열기

Cherry Studio를 실행하고, 오른쪽 상단의 ⚙️ **설정** 버튼 클릭

### 2. MCP 서버 추가

설정 페이지에서: **MCP** → **추가** 클릭

### 3. 설정 입력(중요!)

위의 설치 스크립트에서 표시된 정보에 따라 작성

### 4. 저장 및 활성화

- **저장** 버튼 클릭
- MCP 서버 목록의 토글이 **활성화** 상태인지 확인 ✅

---

## ✅ 다섯 번째 단계: 성공 여부 확인

### 1. 연결 테스트

Cherry Studio의 대화 창에 입력:

```
최신 뉴스를 크롤링해줘
```

또는 다른 테스트 명령 시도:

```
최근 3일간 "인공지능" 관련 뉴스 검색
2025년 1월의 "테슬라" 관련 보도 찾기
"iPhone" 열도 추세 분석
```

**팁**: "최근 3일간"이라고 말하면 AI가 자동으로 날짜 범위를 계산하고 검색합니다.

### 2. 성공 표시

설정이 성공하면 AI는:

- ✅ TrendRadar 도구 호출
- ✅ 실제 뉴스 데이터 반환
- ✅ 플랫폼, 제목, 순위 등 정보 표시


---

## 🎯 고급 설정

### HTTP 모드(선택사항)

원격 접근 또는 다중 클라이언트 공유가 필요한 경우 HTTP 모드를 사용할 수 있습니다:

#### Windows

`start-http.bat` 더블클릭 실행

#### Mac

```bash
./start-http.sh
```

그 다음 Cherry Studio에서 설정:

```
유형: streamableHttp
URL: http://localhost:3333/mcp
```
