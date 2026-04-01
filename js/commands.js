class CommandHandler {
  constructor(fs, git) {
    this.fs = fs;
    this.git = git;
    this.aliases = {};
    this.stdin = null; // piped input
    this.env = {
      USER: 'user',
      HOME: '/home/user',
    };
  }

  execute(input) {
    const trimmed = input.trim();
    if (!trimmed) return '';

    // Expand alias (first word only)
    const expanded = this._expandAlias(trimmed);

    // Handle pipes: split on | outside quotes
    const pipeSegments = this._splitPipes(expanded);
    if (pipeSegments.length > 1) {
      return this._executePipeline(pipeSegments);
    }

    return this._executeOne(expanded);
  }

  _expandAlias(input) {
    const firstSpace = input.indexOf(' ');
    const cmd = firstSpace > 0 ? input.slice(0, firstSpace) : input;
    const rest = firstSpace > 0 ? input.slice(firstSpace) : '';
    if (this.aliases[cmd]) {
      return this.aliases[cmd] + rest;
    }
    return input;
  }

  _splitPipes(input) {
    const segments = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === "'" && !inDouble) { inSingle = !inSingle; current += ch; continue; }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; current += ch; continue; }
      if (ch === '|' && !inSingle && !inDouble) {
        segments.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) segments.push(current.trim());
    return segments;
  }

  _executePipeline(segments) {
    let output = '';
    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        this.stdin = this._stripHtml(output);
      }
      output = this._executeOne(segments[i]);
      this.stdin = null;
    }
    return output;
  }

  _executeOne(input) {
    // Handle redirect at the end
    const redirectAppend = input.match(/^(.+?)>>(.+)$/);
    const redirectWrite = input.match(/^(.+?)(?<!>)>([^>].*)$/);

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

    return this._runCommand(input);
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
      sort: () => this._sort(args),
      uniq: () => this._uniq(args),
      find: () => this._find(args),
      sed: () => this._sed(args),
      chmod: () => this._chmod(args),
      alias: () => this._alias(args),
      unalias: () => this._unalias(args),
      vi: () => this._vi(args),
      vim: () => this._vi(args),
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

  // Get text input: from stdin (pipe) or from a file arg
  _getInput(args) {
    if (this.stdin) return this.stdin;
    const file = args.find(a => !a.startsWith('-'));
    if (!file) return null;
    const result = this.fs.readFile(file);
    if (result.error) return result;
    return result.content;
  }

  _help() {
    return `<span class="bold color-cyan">Available Commands:</span>

<span class="color-green">File System:</span>
  ls [path]            List directory contents
  cd [path]            Change directory
  pwd                  Print working directory
  cat <file>           Display file contents
  echo [-n] [-e] <txt> Print text (supports > and >>)
  mkdir <dir>          Create directory
  touch <file>         Create empty file
  rm [-r] <path>       Remove file or directory
  cp <src> <dest>      Copy file
  mv <src> <dest>      Move/rename file
  find [path] -name p  Find files by name
  chmod <mode> <file>  Change file permissions
  head [-n N] <file>   Show first N lines
  tail [-n N] <file>   Show last N lines

<span class="color-green">Text Processing:</span>
  grep <pat> [file]    Search (supports pipe)
  sed 's/a/b/' [file]  Stream editor
  sort [file]          Sort lines
  uniq [file]          Remove duplicate lines
  wc [file]            Count lines, words, chars

<span class="color-green">Editor:</span>
  vi [file]            Open file in vi editor

<span class="color-green">Other:</span>
  alias [name=cmd]     Define/list aliases
  unalias <name>       Remove alias
  whoami               Print current user
  date                 Print current date
  clear                Clear terminal
  history              Show command history
  env                  Show environment variables
  export KEY=VALUE     Set environment variable
  help                 Show this help

<span class="color-green">Pipe:</span>
  cmd1 | cmd2          Pipe output of cmd1 to cmd2
  Example: cat file | grep error | sort | uniq

<span class="color-green">Git Commands:</span>
  git help             Show git commands`;
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
      const resolvedDir = this.fs.resolvePath(path || '.');
      return entries.map(e => {
        let perm;
        if (e.name === '.' || e.name === '..') {
          perm = 'drwxr-xr-x';
        } else {
          const node = this.fs.getNode(resolvedDir + '/' + e.name);
          perm = node ? this.fs.modeToString(node) : (e.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--');
        }
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
    if (this.stdin) return this._escapeHtml(this.stdin);
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
    let noNewline = false;
    let escapes = false;
    const textArgs = [];

    for (const a of args) {
      if (a === '-n') { noNewline = true; continue; }
      if (a === '-e') { escapes = true; continue; }
      textArgs.push(a);
    }

    let text = textArgs.join(' ');

    if (escapes) {
      text = text
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    }

    return text;
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
    const fileArgs = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && args[i + 1]) { n = parseInt(args[++i]); }
      else fileArgs.push(args[i]);
    }
    const input = this._getInput(fileArgs);
    if (input === null) return '<span class="color-red">head: missing operand</span>';
    if (input.error) return `<span class="color-red">${input.error}</span>`;
    const text = typeof input === 'string' ? input : '';
    return this._escapeHtml(text.split('\n').slice(0, n).join('\n'));
  }

  _tail(args) {
    let n = 10;
    const fileArgs = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && args[i + 1]) { n = parseInt(args[++i]); }
      else fileArgs.push(args[i]);
    }
    const input = this._getInput(fileArgs);
    if (input === null) return '<span class="color-red">tail: missing operand</span>';
    if (input.error) return `<span class="color-red">${input.error}</span>`;
    const text = typeof input === 'string' ? input : '';
    return this._escapeHtml(text.split('\n').slice(-n).join('\n'));
  }

  _wc(args) {
    const input = this._getInput(args);
    if (input === null) return '<span class="color-red">wc: missing operand</span>';
    if (input.error) return `<span class="color-red">${input.error}</span>`;
    const text = typeof input === 'string' ? input : '';
    const lines = text.split('\n').length;
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const file = args.find(a => !a.startsWith('-')) || '';
    return `  ${lines}  ${words}  ${chars}${file ? ' ' + file : ''}`;
  }

  _grep(args) {
    if (args.length === 0) return '<span class="color-red">usage: grep pattern [file]</span>';

    let caseInsensitive = false;
    let invert = false;
    let countOnly = false;
    const realArgs = [];

    for (const a of args) {
      if (a === '-i') { caseInsensitive = true; continue; }
      if (a === '-v') { invert = true; continue; }
      if (a === '-c') { countOnly = true; continue; }
      realArgs.push(a);
    }

    const pattern = realArgs[0];
    if (!pattern) return '<span class="color-red">usage: grep pattern [file]</span>';

    // Get text from pipe or file
    let text;
    if (this.stdin) {
      text = this.stdin;
    } else if (realArgs[1]) {
      const result = this.fs.readFile(realArgs[1]);
      if (result.error) return `<span class="color-red">${result.error}</span>`;
      text = result.content;
    } else {
      return '<span class="color-red">usage: grep pattern [file]</span>';
    }

    try {
      const flags = caseInsensitive ? 'gi' : 'g';
      const regex = new RegExp(pattern, flags);
      const lines = text.split('\n');
      const matches = lines.filter(line => {
        regex.lastIndex = 0;
        const m = regex.test(line);
        return invert ? !m : m;
      });

      if (countOnly) return String(matches.length);

      return matches.map(l => {
        const escaped = this._escapeHtml(l);
        try {
          const highlightFlags = caseInsensitive ? 'gi' : 'g';
          return escaped.replace(new RegExp(this._escapeHtml(pattern), highlightFlags),
            m => `<span class="color-red bold">${m}</span>`);
        } catch {
          return escaped;
        }
      }).join('\n');
    } catch {
      return '<span class="color-red">grep: invalid regular expression</span>';
    }
  }

  _sort(args) {
    let reverse = args.includes('-r');
    let numeric = args.includes('-n');
    const input = this._getInput(args.filter(a => !a.startsWith('-')));
    if (input === null) return '';
    if (input.error) return `<span class="color-red">${input.error}</span>`;
    const text = typeof input === 'string' ? input : '';
    let lines = text.split('\n');
    if (numeric) {
      lines.sort((a, b) => parseFloat(a) - parseFloat(b));
    } else {
      lines.sort();
    }
    if (reverse) lines.reverse();
    return this._escapeHtml(lines.join('\n'));
  }

  _uniq(args) {
    let countMode = args.includes('-c');
    const input = this._getInput(args.filter(a => !a.startsWith('-')));
    if (input === null) return '';
    if (input.error) return `<span class="color-red">${input.error}</span>`;
    const text = typeof input === 'string' ? input : '';
    const lines = text.split('\n');
    const result = [];

    if (countMode) {
      let count = 1;
      for (let i = 1; i <= lines.length; i++) {
        if (i < lines.length && lines[i] === lines[i - 1]) {
          count++;
        } else {
          result.push(`      ${count} ${lines[i - 1]}`);
          count = 1;
        }
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        if (i === 0 || lines[i] !== lines[i - 1]) {
          result.push(lines[i]);
        }
      }
    }
    return this._escapeHtml(result.join('\n'));
  }

  _find(args) {
    let searchPath = '.';
    let namePattern = null;
    let typeFilter = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-name' && args[i + 1]) {
        namePattern = args[++i];
      } else if (args[i] === '-type' && args[i + 1]) {
        typeFilter = args[++i]; // f or d
        i++;
      } else if (!args[i].startsWith('-')) {
        searchPath = args[i];
      }
    }

    const entries = this.fs.getAllEntries(searchPath, searchPath === '.' ? '.' : searchPath);

    // Always include the root search path
    let results = [{ name: searchPath === '.' ? '.' : searchPath, type: 'dir' }, ...entries];

    if (namePattern) {
      // Convert glob to regex: * -> .*, ? -> .
      const regexStr = '^' + namePattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
      const regex = new RegExp(regexStr);
      results = results.filter(e => {
        const basename = e.name.split('/').pop();
        return regex.test(basename);
      });
    }

    if (typeFilter) {
      if (typeFilter === 'f') results = results.filter(e => e.type === 'file');
      if (typeFilter === 'd') results = results.filter(e => e.type === 'dir');
    }

    return results.map(e => {
      const cls = e.type === 'dir' ? 'color-blue' : '';
      return cls ? `<span class="${cls}">${e.name}</span>` : e.name;
    }).join('\n');
  }

  _sed(args) {
    if (args.length === 0) return '<span class="color-red">usage: sed \'s/pattern/replace/[flags]\' [file]</span>';

    const expr = args[0];
    const inPlace = args.includes('-i');
    const fileArgs = args.filter(a => a !== '-i' && a !== expr);

    // Parse s/pattern/replacement/flags
    const match = expr.match(/^s(.)(.+?)\1(.*?)\1([gi]*)$/);
    if (!match) return '<span class="color-red">sed: invalid expression</span>';

    const [, , pattern, replacement, flags] = match;

    // Get input text
    let text;
    const fileName = fileArgs[0];
    if (this.stdin) {
      text = this.stdin;
    } else if (fileName) {
      const result = this.fs.readFile(fileName);
      if (result.error) return `<span class="color-red">${result.error}</span>`;
      text = result.content;
    } else {
      return '<span class="color-red">sed: no input</span>';
    }

    try {
      const regex = new RegExp(pattern, flags.includes('g') ? 'g' : '');
      const output = text.split('\n').map(line => line.replace(regex, replacement)).join('\n');

      if (inPlace && fileName) {
        this.fs.writeFile(fileName, output, false);
        return '';
      }

      return this._escapeHtml(output);
    } catch {
      return '<span class="color-red">sed: invalid regular expression</span>';
    }
  }

  _chmod(args) {
    if (args.length < 2) return '<span class="color-red">usage: chmod &lt;mode&gt; &lt;file&gt;</span>';
    const mode = args[0];
    const path = args[1];

    // Validate mode (simple: 3 octal digits)
    if (!/^[0-7]{3}$/.test(mode)) {
      return `<span class="color-red">chmod: invalid mode: '${mode}' (use 3 octal digits, e.g. 755)</span>`;
    }

    const result = this.fs.chmod(path, mode);
    return result.error ? `<span class="color-red">${result.error}</span>` : '';
  }

  _alias(args) {
    if (args.length === 0) {
      // List all aliases
      const entries = Object.entries(this.aliases);
      if (entries.length === 0) return '';
      return entries.map(([k, v]) => `alias ${k}='${v}'`).join('\n');
    }

    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq > 0) {
        const name = a.slice(0, eq);
        const value = a.slice(eq + 1);
        this.aliases[name] = value;
      } else {
        // Show single alias
        if (this.aliases[a]) {
          return `alias ${a}='${this.aliases[a]}'`;
        }
        return `<span class="color-red">alias: ${a}: not found</span>`;
      }
    }
    return '';
  }

  _unalias(args) {
    if (args.length === 0) return '<span class="color-red">unalias: usage: unalias name</span>';
    for (const a of args) {
      if (a === '-a') {
        this.aliases = {};
        return '';
      }
      if (!this.aliases[a]) return `<span class="color-red">unalias: ${a}: not found</span>`;
      delete this.aliases[a];
    }
    return '';
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

  _vi(args) {
    if (!this.openVi) return '<span class="color-red">vi: editor not available</span>';
    const err = this.openVi(args[0] || '');
    return err || '';
  }

  _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _stripHtml(text) {
    return text.replace(/<[^>]*>/g, '');
  }
}
