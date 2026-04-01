# dev-assistant-mcp-server

토큰 최적화를 위한 범용 개발 보조 MCP 서버.  
파일 전체를 Claude 컨텍스트에 붙여넣는 대신, 필요한 부분만 쿼리해서 토큰 사용량을 줄입니다.

## 제공 도구 (12개)

### 📁 파일 시스템 (범용)
| 도구 | 설명 |
|------|------|
| `fs_read_file` | 라인 범위 지정 읽기 — 파일 전체 대신 필요한 섹션만 |
| `fs_search_in_file` | 키워드 검색 + 주변 컨텍스트 추출 |
| `fs_list_dir` | 디렉토리 목록 (재귀/확장자 필터 지원) |
| `fs_write_file` | 파일 쓰기/추가 |

### 🤖 Jarvis 봇
| 도구 | 설명 |
|------|------|
| `jarvis_status` | 봇 프로세스 실행 여부 확인 |
| `jarvis_code_outline` | bot.py 함수/명령어 목록만 추출 (전체 파일 로드 없이) |
| `jarvis_get_command` | 특정 명령어 코드 블록만 추출 |
| `jarvis_list_packages` | pip 패키지 목록 확인 |

### 🔬 실험 데이터 (PSpice / Excel)
| 도구 | 설명 |
|------|------|
| `lab_excel_sheets` | Excel 시트 목록 및 크기 확인 |
| `lab_excel_read` | 시트 데이터 읽기 (행/열 범위 지정) |
| `lab_excel_summary` | 수치 컬럼 통계 (min/max/mean) |
| `lab_pspice_parse` | PSpice .out 파일 파싱 → 노드 전압/전류/전력 추출 |

## 설치

### 1. 빌드
```bash
npm install
npm run build
```

### 2-A. Claude Desktop 등록
`%APPDATA%\Claude\claude_desktop_config.json` 에 추가:

```json
{
  "mcpServers": {
    "dev-assistant": {
      "command": "node",
      "args": ["C:/path/to/dev-assistant-mcp-server/dist/index.js"]
    }
  }
}
```

### 2-B. Claude Code 등록
```bash
claude mcp add dev-assistant node /path/to/dev-assistant-mcp-server/dist/index.js
```

## 토큰 절약 예시

**전:** `bot.py` 전체 파일 (500줄) → 컨텍스트에 붙여넣기  
**후:** `jarvis_code_outline` → 함수 목록 (20줄) → 필요한 명령어만 `jarvis_get_command`

**전:** Excel 파일 업로드 → 전체 시트 로드  
**후:** `lab_excel_sheets` → `lab_excel_summary` → 필요한 행만 `lab_excel_read`

---

## 🚀 단일 실행 파일(.exe) 배포 및 자동 업데이트 계획 (진행 대기)

> **상태:** 현재 시스템 환경(Node.js) 세팅을 위해 대기 중인 예약 작업입니다. 에디터를 재시작하신 후 AI에게 **"README.md에 적혀있는 .exe 자동화 세팅 진행해줘"** 라고 말씀하시면 즉시 이 작업을 대행합니다.

### 1. 단일 실행 파일(`.exe`) 굽기 구성
- 한 번의 명령어(`npm run build:exe` 등)로 전체 코드를 묶어내어 다른 시스템 어디에서나 **무설치**로 사용할 수 있는 `.exe` 파일 생성 프로세스를 구축합니다.

### 2. "코딩한 거 보고 자동 업데이트" 기능 (개발용 Watch Mode)
- 소스코드를 고치고 저장(`Ctrl + S`)할 때마다 백그라운드에 켜둔 자동화 스크립트가 이를 감지하여 **자동으로 최신 `.exe` 파일을 다시 구워내도록** 설정합니다.
- **활용법:** 개발할 때는 이 기능 켜두고 다른 작업에 집중하시고, 다른 시스템으로 옮기실 땐 최종 업데이트된 `.exe` 단 1개만 복사해가시면 됩니다.
