# dev-assistant-mcp-server

토큰 최적화를 위한 범용 개발 보조 MCP 서버.  
파일 전체를 Claude 컨텍스트에 붙여넣는 대신, 필요한 부분만 쿼리해서 토큰 사용량을 줄입니다.

---

## 🛡️ Engineering Standards: Surgical Debugging & Strategy

이 MCP 서버를 사용하는 모든 AI 에이전트는 아래의 **5단계 엔지니어링 표준**을 엄격히 준수해야 합니다. 이는 최소한의 토큰으로 최대한의 정밀도를 확보하기 위함입니다.

1. **현상 파악 (Observe Symptoms First)**
   - 코드를 수정하기 전, `jarvis_status`나 로그 파일 등을 통해 실제 증거(Raw Evidence)를 수집합니다.
   - 가설만으로 코딩하지 않으며, 반드시 실제 상태를 확인한 후 작업을 시작합니다.

2. **원인 역추적 (Root Cause Tracing)**
   - 증상에서부터 `fs_search_in_file` 등을 활용해 코드를 거슬러 올라가 근본 원인을 찾습니다.
   - `Input → Processing → Output`의 흐름 중 에러가 발생하는 가장 앞단의 지점을 식별합니다.

3. **의존관계 정렬 (Dependency Ordering)**
   - 여러 이슈가 있을 경우, 의존성 순서로 정렬합니다. 
   - "A를 고치지 않으면 B를 테스트할 수 있는가?"를 질문하여 선행 작업을 결정합니다.

4. **정밀한 수정 (Surgical Precision)**
   - `fs_read_file`로 필요한 섹션만 읽고, 모호함 없이 정확한 파일 경로와 코드 블록을 수정합니다.
   - 수정한 후에는 반드시 검증 과정을 거칩니다.

5. **목적 중심 설계 (Purpose-Centric Design)**
   - 모든 기능은 사용자의 "실제 문제 해결"에 얼마나 기여하는가를 기준으로 설계합니다.
   - 불필요한 전체 로드보다, 핵심 로직의 정밀한 조작을 우선시합니다.

---

## 📋 변경 이력

| 날짜 | 구분 | 내용 |
|------|------|------|
| 2026-04-29 | 🛡️ DOCS | "Engineering Standards: Surgical Debugging & Strategy" 수칙 추가 |
| 2026-04-01 | 🆕 NEW | `changelog_add` / `changelog_view` 도구 추가 — README 변경이력 자동 기록 |
| 2026-04-01 | 🆕 NEW | `reversal_*` 도구 5개 추가 (Reversal 격겜 프로젝트 전용) |
| 2026-04-01 | 🔧 FIX | `jarvis_status` Windows 호환 수정 (`ps aux` → `wmic`) |
| 2026-04-01 | 🔧 FIX | `jarvis_list_packages` 기본 Python 경로 `python3` → `python` |
| 2026-04-01 | 🆕 NEW | `.exe` 단일 파일 빌드 구성 (`npm run build:exe`) |
| 2026-04-01 | 🆕 NEW | Watch Mode 구성 — 저장 시 자동 `.exe` 재빌드 (`npm run watch:exe`) |

---

## 제공 도구 (19개)

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
| `jarvis_status` | 봇 프로세스 실행 여부 확인 (Windows/Linux 크로스플랫폼) |
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

### 🗓️ 메타 (README 변경이력) 🆕
| 도구 | 설명 |
|------|------|
| `changelog_add` | README.md 변경이력 테이블에 한 줄 추가 (NEW/FIX/UPDATE/BREAK/DOCS/PERF) |
| `changelog_view` | README.md 변경이력 최신 N개 조회 |

### 🎮 Reversal 격겜 프로젝트 🆕
| 도구 | 설명 |
|------|------|
| `reversal_read_spec` | 스펙 문서에서 섹션 번호로 읽기 (예: "4.3") — 1100줄 전체 로드 없이 |
| `reversal_get_state` | 현재 구현 Phase + 완료 항목 + 마지막 노트 조회 |
| `reversal_set_state` | Phase 업데이트, 완료 항목 추가, 작업 노트 저장 |
| `reversal_read_function` | reversal.html에서 특정 함수 블록만 추출 |
| `reversal_replace_function` | reversal.html에서 특정 함수 블록 교체 (자동 .bak 백업) |

---

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

---

## 토큰 절약 예시

**전:** `bot.py` 전체 파일 (500줄) → 컨텍스트에 붙여넣기  
**후:** `jarvis_code_outline` → 함수 목록 (20줄) → 필요한 명령어만 `jarvis_get_command`

**전:** Excel 파일 업로드 → 전체 시트 로드  
**후:** `lab_excel_sheets` → `lab_excel_summary` → 필요한 행만 `lab_excel_read`

**전:** REVERSAL-BUILD-SPEC.md (1114줄) 전체 붙여넣기  
**후:** `reversal_read_spec({ section: "4.3" })` → 파싱 알고리즘 섹션만

---

## 🚀 단일 실행 파일(.exe) 빌드

Node.js 없이 어디서나 실행 가능한 `.exe` 파일 생성.

### 한 번 빌드
```bash
npm run build:exe
# → build/dev-assistant-mcp.exe 생성
```

### Watch Mode (개발용)
소스 저장(`Ctrl+S`) 시 자동으로 `.exe` 재빌드:
```bash
npm run watch:exe
# src/ 폴더 감지 → 변경 시 자동 build:exe 실행
```

**`.exe` 사용 시 Claude 등록:**
```json
{
  "mcpServers": {
    "dev-assistant": {
      "command": "C:/path/to/build/dev-assistant-mcp.exe"
    }
  }
}
```
