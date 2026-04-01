class CommandHandler {
  constructor(fs, git) {
    this.fs = fs;
    this.git = git;
    this.env = {
      USER: 'user',
      HOME: '/home/user',
    };
  }

  execute(input) {
    const trimmed = input.trim();
    if (!trimmed) return '';

    // Handle echo with redirect
    const redirectAppend = trimmed.match(/^(.+?)>>(.+)$/);
    const redirectWrite = trimmed.match(/^(.+?)(?<!>)>([^>].*)$/);

    if (redirectAppend) {
      const output = this._runCommand(redirectAppend[1].trim());
      const filePath = redirectAppend[2].trim();
      const text = typeof output === 'string' ? this._stripHtml(output) : output;
      const result = this.fs.writeFile(filePath, text + '\n', true);
      return result.error || '';
    }
    if (redirectWrite) {
      const output = this._runCommand(redirectWrite[1].trim());
      const filePath = redirectWrite[2].trim();
      const text = typeof output === 'string' ? this._stripHtml(output) : output;
      const result = this.fs.writeFile(filePath, text + '\n', false);
      return result.error || '';
    }

    return this._runCommand(trimmed);
  }

  _runCommand(input) {
    const parts = this._parse(input);
    if (parts.length === 0) return '';

    const cmd = parts[0];
    const args = parts.slice(1);

    const commands = {
      help: () => this._help(),
      ls: () => this._ls(args),
      cd: () => this._cd(args),
      pwd: () => this.fs.currentPath,
      cat: () => this._cat(args),
      echo: () => this._echo(args),
      mkdir: () => this._mkdir(args),
      touch: () => this._touch(args),
      rm: () => this._rm(args),
      cp: () => this._cp(args),
      mv: () => this._mv(args),
      clear: () => '__CLEAR__',
      whoami: () => this.env.USER,
      date: () => new Date().toString(),
      history: () => '__HISTORY__',
      git: () => this._git(args),
      export: () => this._export(args),
      env: () => Object.entries(this.env).map(([k, v]) => `${k}=${v}`).join('\n'),
      which: () => args[0] ? `/usr/bin/${args[0]}` : 'usage: which command',
      head: () => this._head(args),
      tail: () => this._tail(args),
      wc: () => this._wc(args),
      grep: () => this._grep(args),
      man: () => `No manual entry for ${args[0] || '???'}. Try "help" instead.`,
    };

    if (commands[cmd]) return commands[cmd]();
    return `<span class="color-red">${cmd}: command not found</span>`;
  }

  _parse(input) {
    const parts = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
      if (ch === ' ' && !inSingle && !inDouble) {
        if (current) { parts.push(current); current = ''; }
        continue;
      }
      // Expand $VAR in double quotes or unquoted
      if (ch === '$' && !inSingle) {
        let varName = '';
        let j = i + 1;
        while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) {
          varName += input[j]; j++;
        }
        if (varName) {
          current += this.env[varName] || '';
          i = j - 1;
          continue;
        }
      }
      current += ch;
    }
    if (current) parts.push(current);
    return parts;
  }

  _help() {
    return `<span class="bold color-cyan">Available Commands:</span>

<span class="color-green">File System:</span>
  ls [path]          List directory contents
  cd [path]          Change directory
  pwd                Print working directory
  cat <file>         Display file contents
  echo <text>        Print text (supports > and >>)
  mkdir <dir>        Create directory
  touch <file>       Create empty file
  rm [-r] <path>     Remove file or directory
  cp <src> <dest>    Copy file
  mv <src> <dest>    Move/rename file
  head [-n N] <file> Show first N lines
  tail [-n N] <file> Show last N lines
  wc <file>          Count lines, words, chars
  grep <pat> <file>  Search in file

<span class="color-green">Other:</span>
  whoami             Print current user
  date               Print current date
  clear              Clear terminal
  history            Show command history
  env                Show environment variables
  export KEY=VALUE   Set environment variable
  help               Show this help

<span class="color-green">Git Commands:</span>
  git init           Initialize a repository
  git status         Show working tree status
  git add <file>     Stage changes
  git commit -m "msg" Record changes
  git log            Show commit history
  git branch [name]  List/create branches
  git checkout <br>  Switch branches
  git checkout -b <br> Create and switch branch
  git merge <branch> Merge branch
  git diff           Show changes
  git help           Show git help`;
  }

  _ls(args) {
    const flags = args.filter(a => a.startsWith('-'));
    const path = args.find(a => !a.startsWith('-'));
    const showAll = flags.some(f => f.includes('a'));
    const showLong = flags.some(f => f.includes('l'));

    const result = this.fs.listDir(path);
    if (result.error) return `<span class="color-red">${result.error}</span>`;

    let entries = result.entries;
    if (showAll) {
      entries = [{ name: '.', type: 'dir' }, { name: '..', type: 'dir' }, ...entries];
    }

    if (entries.length === 0) return '';

    if (showLong) {
      return entries.map(e => {
        const perm = e.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
        const cls = e.type === 'dir' ? 'dir-entry' : 'file-entry';
        return `${perm}  user user  <span class="${cls}">${e.name}</span>`;
      }).join('\n');
    }

    return entries.map(e => {
      const cls = e.type === 'dir' ? 'dir-entry' : 'file-entry';
      return `<span class="${cls}">${e.name}</span>`;
    }).join('  ');
  }

  _cd(args) {
    const result = this.fs.changeDir(args[0]);
    return result.error ? `<span class="color-red">${result.error}</span>` : '';
  }

  _cat(args) {
    if (args.length === 0) return '<span class="color-red">cat: missing operand</span>';
    const outputs = [];
    for (const a of args) {
      const result = this.fs.readFile(a);
      if (result.error) return `<span class="color-red">${result.error}</span>`;
      outputs.push(result.content);
    }
    return this._escapeHtml(outputs.join(''));
  }

  _echo(args) {
    return args.join(' ');
  }

  _mkdir(args) {
    if (args.length === 0) return '<span class="color-red">mkdir: missing operand</span>';
    const pFlag = args.includes('-p');
    const dirs = args.filter(a => a !== '-p');
    for (const d of dirs) {
      const result = this.fs.createDir(d);
      if (result.error) return `<span class="color-red">${result.error}</span>`;
    }
    return '';
  }

  _touch(args) {
    if (args.length === 0) return '<span class="color-red">touch: missing operand</span>';
    for (const a of args) {
      const result = this.fs.touch(a);
      if (result.error) return `<span class="color-red">${result.error}</span>`;
    }
    return '';
  }

  _rm(args) {
    const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr');
    const paths = args.filter(a => !a.startsWith('-'));
    if (paths.length === 0) return '<span class="color-red">rm: missing operand</span>';
    for (const p of paths) {
      const result = this.fs.remove(p, recursive);
      if (result.error) return `<span class="color-red">${result.error}</span>`;
    }
    return '';
  }

  _cp(args) {
    if (args.length < 2) return '<span class="color-red">cp: missing operand</span>';
    const result = this.fs.copy(args[0], args[1]);
    return result.error ? `<span class="color-red">${result.error}</span>` : '';
  }

  _mv(args) {
    if (args.length < 2) return '<span class="color-red">mv: missing operand</span>';
    const result = this.fs.move(args[0], args[1]);
    return result.error ? `<span class="color-red">${result.error}</span>` : '';
  }

  _head(args) {
    let n = 10;
    let file = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && args[i + 1]) { n = parseInt(args[++i]); }
      else file = args[i];
    }
    if (!file) return '<span class="color-red">head: missing operand</span>';
    const result = this.fs.readFile(file);
    if (result.error) return `<span class="color-red">${result.error}</span>`;
    return this._escapeHtml(result.content.split('\n').slice(0, n).join('\n'));
  }

  _tail(args) {
    let n = 10;
    let file = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && args[i + 1]) { n = parseInt(args[++i]); }
      else file = args[i];
    }
    if (!file) return '<span class="color-red">tail: missing operand</span>';
    const result = this.fs.readFile(file);
    if (result.error) return `<span class="color-red">${result.error}</span>`;
    return this._escapeHtml(result.content.split('\n').slice(-n).join('\n'));
  }

  _wc(args) {
    if (args.length === 0) return '<span class="color-red">wc: missing operand</span>';
    const result = this.fs.readFile(args[0]);
    if (result.error) return `<span class="color-red">${result.error}</span>`;
    const lines = result.content.split('\n').length;
    const words = result.content.split(/\s+/).filter(Boolean).length;
    const chars = result.content.length;
    return `  ${lines}  ${words}  ${chars} ${args[0]}`;
  }

  _grep(args) {
    if (args.length < 2) return '<span class="color-red">usage: grep pattern file</span>';
    const pattern = args[0];
    const file = args[1];
    const result = this.fs.readFile(file);
    if (result.error) return `<span class="color-red">${result.error}</span>`;
    try {
      const regex = new RegExp(pattern, 'g');
      const matches = result.content.split('\n').filter(line => regex.test(line));
      regex.lastIndex = 0;
      return matches.map(l => {
        const escaped = this._escapeHtml(l);
        return escaped.replace(new RegExp(this._escapeHtml(pattern), 'g'),
          m => `<span class="color-red bold">${m}</span>`);
      }).join('\n');
    } catch {
      return '<span class="color-red">grep: invalid regular expression</span>';
    }
  }

  _export(args) {
    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq > 0) {
        this.env[a.slice(0, eq)] = a.slice(eq + 1);
      }
    }
    return '';
  }

  _git(args) {
    if (args.length === 0 || args[0] === 'help') return this._gitHelp();

    const sub = args[0];
    const subArgs = args.slice(1);

    const gitCommands = {
      init: () => {
        const r = this.git.init();
        return r.error ? `<span class="color-yellow">${r.error}</span>` : `<span class="color-green">${r.output}</span>`;
      },
      status: () => {
        const r = this.git.status(this.fs);
        return r.error ? `<span class="color-red">${r.error}</span>` : r.output;
      },
      add: () => {
        const r = this.git.add(subArgs, this.fs);
        return r.error ? `<span class="color-red">${r.error}</span>` : '';
      },
      commit: () => {
        let message = '';
        const mIdx = subArgs.indexOf('-m');
        if (mIdx !== -1 && subArgs[mIdx + 1]) {
          message = subArgs[mIdx + 1];
        }
        const r = this.git.commit(message, this.fs);
        return r.error ? `<span class="color-red">${r.error}</span>` : `<span class="color-green">${r.output}</span>`;
      },
      log: () => {
        const r = this.git.log();
        return r.error ? `<span class="color-red">${r.error}</span>` : r.output;
      },
      branch: () => {
        const r = this.git.branch(subArgs);
        return r.error ? `<span class="color-red">${r.error}</span>` : r.output;
      },
      checkout: () => {
        const r = this.git.checkout(subArgs, this.fs);
        return r.error ? `<span class="color-red">${r.error}</span>` : `<span class="color-green">${r.output}</span>`;
      },
      merge: () => {
        const r = this.git.merge(subArgs);
        return r.error ? `<span class="color-red">${r.error}</span>` : `<span class="color-green">${r.output}</span>`;
      },
      diff: () => {
        const r = this.git.diff(this.fs);
        return r.error ? `<span class="color-red">${r.error}</span>` : r.output;
      },
      restore: () => {
        if (subArgs[0] === '--staged') {
          const r = this.git.restoreStaged(subArgs.slice(1));
          return r.error ? `<span class="color-red">${r.error}</span>` : '';
        }
        return '<span class="color-red">usage: git restore --staged &lt;file&gt;</span>';
      },
    };

    if (gitCommands[sub]) return gitCommands[sub]();
    return `<span class="color-red">git: '${sub}' is not a git command. See 'git help'.</span>`;
  }

  _gitHelp() {
    return `<span class="bold color-cyan">Git Commands:</span>

  git init                 Initialize a new repository
  git status               Show the working tree status
  git add <file>           Add file to staging area
  git add .                Stage all changes
  git commit -m "message"  Commit staged changes
  git log                  Show commit history
  git diff                 Show unstaged changes
  git branch               List branches
  git branch <name>        Create a new branch
  git branch -d <name>     Delete a branch
  git checkout <branch>    Switch to a branch
  git checkout -b <branch> Create and switch to a branch
  git merge <branch>       Merge a branch into current
  git restore --staged <f> Unstage a file`;
  }

  _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _stripHtml(text) {
    return text.replace(/<[^>]*>/g, '');
  }
}
