const I18N = {
  _lang: 'ko',

  get lang() { return this._lang; },

  toggle() {
    this._lang = this._lang === 'ko' ? 'en' : 'ko';
    localStorage.setItem('termimmim-lang', this._lang);
    return this._lang;
  },

  init() {
    const saved = localStorage.getItem('termimmim-lang');
    if (saved) this._lang = saved;
  },

  t(key) {
    const entry = this.data[key];
    if (!entry) return key;
    return entry[this._lang] || entry['en'] || key;
  },

  data: {
    // Header
    'header.subtitle': {
      ko: '브라우저 기반 터미널 시뮬레이터',
      en: 'Browser-based terminal simulator for practice',
    },
    'footer.help': {
      ko: '터미널에 <code>help</code>를 입력하면 전체 명령어를 볼 수 있습니다',
      en: 'Type <code>help</code> in the terminal to see all commands',
    },

    // Welcome
    'welcome.hint': {
      ko: '터미널의 궁금한 부분을 눌러보세요!',
      en: 'Click on any part of the terminal to learn more!',
    },

    // Guide section
    'guide.title': {
      ko: '빠른 참조',
      en: 'Quick Reference',
    },
    // File System card
    'guide.fs.title': { ko: '파일 시스템', en: 'File System' },
    'guide.fs.ls': { ko: '파일 목록 보기', en: 'list files' },
    'guide.fs.cd': { ko: '디렉토리 이동', en: 'change directory' },
    'guide.fs.mkdir': { ko: '디렉토리 생성', en: 'create directory' },
    'guide.fs.touch': { ko: '파일 생성', en: 'create file' },
    'guide.fs.cat': { ko: '파일 내용 보기', en: 'view file' },
    'guide.fs.rm': { ko: '파일 삭제', en: 'remove file' },
    'guide.fs.find': { ko: '파일 찾기', en: 'find files' },
    'guide.fs.chmod': { ko: '권한 변경', en: 'permissions' },
    // Git Basics card
    'guide.git.title': { ko: 'Git 기본', en: 'Git Basics' },
    'guide.git.init': { ko: '저장소 초기화', en: 'initialize repo' },
    'guide.git.add': { ko: '변경사항 스테이징', en: 'stage changes' },
    'guide.git.commit': { ko: '커밋하기', en: 'commit' },
    'guide.git.status': { ko: '상태 확인', en: 'check status' },
    'guide.git.log': { ko: '히스토리 보기', en: 'view history' },
    'guide.git.diff': { ko: '변경사항 보기', en: 'see changes' },
    // Git Branches card
    'guide.branch.title': { ko: 'Git 브랜치', en: 'Git Branches' },
    'guide.branch.list': { ko: '브랜치 목록', en: 'list branches' },
    'guide.branch.create': { ko: '생성', en: 'create' },
    'guide.branch.switch': { ko: '전환', en: 'switch' },
    'guide.branch.create_switch': { ko: '생성 & 전환', en: 'create & switch' },
    'guide.branch.merge': { ko: '병합', en: 'merge' },
    'guide.branch.delete': { ko: '삭제', en: 'delete' },
    // Pipe & Text card
    'guide.pipe.title': { ko: '파이프 & 텍스트', en: 'Pipe & Text' },
    'guide.pipe.pipe': { ko: '출력 연결', en: 'pipe output' },
    'guide.pipe.grep': { ko: '검색', en: 'search' },
    'guide.pipe.sort': { ko: '정렬', en: 'sort lines' },
    'guide.pipe.uniq': { ko: '중복 제거', en: 'deduplicate' },
    'guide.pipe.sed': { ko: '치환', en: 'replace' },
    'guide.pipe.alias': { ko: '별칭 설정', en: 'alias' },
    'guide.pipe.echo': { ko: '이스케이프', en: 'escapes' },
    // Vi card
    'guide.vi.title': { ko: 'Vi 에디터', en: 'Vi Editor' },
    'guide.vi.open': { ko: '에디터 열기', en: 'open editor' },
    'guide.vi.insert': { ko: '입력 모드', en: 'insert mode' },
    'guide.vi.normal': { ko: '일반 모드', en: 'normal mode' },
    'guide.vi.save': { ko: '저장', en: 'save' },
    'guide.vi.quit': { ko: '종료', en: 'quit' },
    'guide.vi.savequit': { ko: '저장 & 종료', en: 'save & quit' },
    'guide.vi.dd': { ko: '줄 삭제', en: 'delete line' },
    'guide.vi.move': { ko: '커서 이동', en: 'move cursor' },

    // Tooltips - Prompt
    'tip.userhost': {
      ko: '사용자이름@호스트이름 — 현재 로그인한 사용자와 컴퓨터 이름입니다',
      en: 'username@hostname — the logged-in user and computer name',
    },
    'tip.home': {
      ko: '~ 는 홈 디렉토리(/home/user)를 의미합니다',
      en: '~ means the home directory (/home/user)',
    },
    'tip.path': {
      ko: '현재 위치: ',
      en: 'Current directory: ',
    },
    'tip.dollar': {
      ko: '$ 는 일반 사용자를 의미합니다 (# 이면 root)',
      en: '$ means a regular user (# means root)',
    },
    'tip.branch': {
      ko: '현재 작업 중인 git 브랜치입니다',
      en: 'The current git branch you are working on',
    },

    // Tooltips - ls -l
    'tip.owner': { ko: '소유자(owner)', en: 'owner' },
    'tip.group': { ko: '그룹(group)', en: 'group' },
    'tip.isdir': { ko: '디렉토리(폴더)입니다', en: 'This is a directory' },
    'tip.isfile': { ko: '일반 파일입니다', en: 'This is a regular file' },

    // Tooltips - permissions
    'tip.perm.dir': { ko: '디렉토리', en: 'directory' },
    'tip.perm.link': { ko: '심볼릭 링크', en: 'symbolic link' },
    'tip.perm.file': { ko: '파일', en: 'file' },
    'tip.perm.owner': { ko: '소유자', en: 'owner' },
    'tip.perm.group': { ko: '그룹', en: 'group' },
    'tip.perm.other': { ko: '기타', en: 'other' },
    'tip.perm.read': { ko: '읽기', en: 'read' },
    'tip.perm.write': { ko: '쓰기', en: 'write' },
    'tip.perm.exec': { ko: '실행', en: 'execute' },
    'tip.perm.none': { ko: '없음', en: 'none' },

    // Tooltips - git status
    'tip.git.onbranch': {
      ko: '현재 작업 중인 브랜치입니다',
      en: 'The branch you are currently working on',
    },
    'tip.git.staged': {
      ko: 'git add로 스테이징된 파일들. commit하면 이 변경사항이 저장됩니다',
      en: 'Files staged with git add. These changes will be saved on commit',
    },
    'tip.git.newfile': {
      ko: '새로 추가된 파일 (git이 처음 추적)',
      en: 'Newly added file (first time tracked by git)',
    },
    'tip.git.modified': {
      ko: '수정된 파일 (이전 커밋과 다름)',
      en: 'Modified file (differs from last commit)',
    },
    'tip.git.notstaged': {
      ko: '변경되었지만 아직 git add 하지 않은 파일들입니다',
      en: 'Changed files not yet staged with git add',
    },
    'tip.git.deleted': {
      ko: '파일이 삭제되었습니다',
      en: 'File has been deleted',
    },
    'tip.git.unstaged_modified': {
      ko: '파일이 수정되었지만 아직 스테이징되지 않았습니다',
      en: 'File is modified but not yet staged',
    },
    'tip.git.untracked': {
      ko: 'git이 아직 추적하지 않는 새 파일들입니다. git add로 추적을 시작하세요',
      en: 'New files not yet tracked by git. Use git add to start tracking',
    },
    'tip.git.untracked_file': {
      ko: '추적되지 않는 파일 — git add 로 추가하세요',
      en: 'Untracked file — use git add to include it',
    },

    // Language toggle
    'lang.button': { ko: 'EN', en: 'KO' },
  }
};
